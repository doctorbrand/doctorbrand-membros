"use client";

import { useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, ImageIcon, PlusIcon, TrashIcon, UploadIcon, XIcon } from "@/components/Icons";
import { mediaKey, mediaUrl } from "@/lib/content-media";
import type { Media } from "@/lib/content";
import { laminaVazia, LIMITE, MAX_LAMINAS, MIN_LAMINAS, nomeLamina, palavras, type Estilo, type Lamina, type ModoFoto, type PosFoto } from "@/lib/laminas";
import { LaminaPreview } from "./LaminaPreview";
import { uploadMedia } from "./upload";

/** Foto do computador vira JPG (o envio só aceita JPG) e é reduzida para no máximo 2400 px. */
async function paraJpeg(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const f = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * f); c.height = Math.round(bmp.height * f);
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Não consegui ler a foto."))), "image/jpeg", 0.9));
}

function Contador({ v, max }: { v: string; max: number }) {
  const n = palavras(v);
  return <span className={`text-xs ${n > max ? "g-bad" : "text-[var(--muted)]"}`}>{n} de {max} palavras</span>;
}

/**
 * Editor das lâminas de um carrossel: a fila de lâminas (capa, slides, tela final) com miniaturas, e a lâmina
 * escolhida com prévia, textos, foto (da pasta do cliente ou do computador) e se a foto vai no fundo ou na moldura.
 */
export function LaminasEditor({ slug, local, itens, estilo, onChange, fotos, carregarFotos, temPasta, desativado }: {
  slug: string;
  local: boolean;
  itens: Lamina[];
  estilo: Estilo;
  onChange: (itens: Lamina[]) => void;
  fotos: Media[] | null;
  carregarFotos: () => Promise<string | null>;
  temPasta: boolean;
  desativado?: boolean;
}) {
  const [sel, setSel] = useState(0);
  const [escolhendo, setEscolhendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const i = Math.min(sel, itens.length - 1);
  const l = itens[i];
  const slides = itens.filter((x) => x.tipo === "slide").length;
  const modo: ModoFoto = l.modoFoto ?? (l.tipo === "capa" ? "fundo" : "moldura");
  const pos: PosFoto = l.posFoto ?? (estilo.base === "revista" ? "baixo" : "cima");

  const mudar = (p: Partial<Lamina>) => onChange(itens.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const adicionar = () => {
    if (itens.length >= MAX_LAMINAS) return;
    const pos = l.tipo === "final" ? itens.length - 1 : i + 1;
    onChange([...itens.slice(0, pos), laminaVazia("slide"), ...itens.slice(pos)]);
    setSel(pos);
  };
  const tirar = () => {
    if (l.tipo !== "slide" || itens.length <= MIN_LAMINAS) return;
    onChange(itens.filter((_, j) => j !== i));
    setSel(Math.max(0, i - 1));
  };
  const mover = (d: -1 | 1) => {
    const j = i + d;
    if (l.tipo !== "slide" || itens[j]?.tipo !== "slide") return;
    const n = [...itens];
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
    setSel(j);
  };
  const porFoto = (foto: Media) => { mudar({ foto, modoFoto: modo }); setEscolhendo(false); };
  const abrirFotos = async () => {
    setEscolhendo(true); setAviso(null);
    if (!fotos && temPasta) { const erro = await carregarFotos(); if (erro) setAviso(erro); }
  };
  const doComputador = async (file: File) => {
    setEnviando(true); setAviso(null);
    try {
      const path = await uploadMedia(`content-media/${slug}/laminas/${Date.now().toString(36)}.jpg`, await paraJpeg(file), local);
      porFoto({ path, kind: "image", mime: "image/jpeg", name: file.name });
    } catch (e) {
      setAviso(e instanceof Error ? e.message : String(e));
    } finally { setEnviando(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Fila de lâminas */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Lâminas">
        {itens.map((x, j) => (
          <button key={j} type="button" role="tab" aria-selected={j === i} onClick={() => { setSel(j); setEscolhendo(false); }}
            className={`flex flex-col items-center gap-1 shrink-0 rounded-lg p-1 ${j === i ? "bg-[#f0efe9]" : ""}`}>
            <LaminaPreview itens={itens} i={j} estilo={estilo} largura={72} className={`rounded-[5px] ${j === i ? "ring-2 ring-[var(--ink)]" : "ring-1 ring-[var(--line)]"}`} />
            <span className={`text-[11px] ${j === i ? "font-semibold" : "text-[var(--muted)]"}`}>{nomeLamina(itens, j)}</span>
          </button>
        ))}
        {itens.length < MAX_LAMINAS && (
          <button type="button" onClick={adicionar} disabled={desativado} className="shrink-0 w-[72px] h-[90px] mt-1 rounded-[5px] border border-dashed border-[var(--line)] grid place-items-center text-[var(--muted)] hover:bg-[#fafaf8]" aria-label="Adicionar slide" title="Adicionar slide">
            <PlusIcon size={18} />
          </button>
        )}
      </div>
      <p className="text-xs text-[var(--muted)] -mt-2">{itens.length} de {MAX_LAMINAS} lâminas · {slides} {slides === 1 ? "slide" : "slides"}</p>

      {/* Lâmina escolhida */}
      <div className="grid sm:grid-cols-[260px_minmax(0,1fr)] gap-4 items-start">
        <div className="flex flex-col gap-2 items-center sm:items-start">
          <LaminaPreview itens={itens} i={i} estilo={estilo} largura={260} className="rounded-lg ring-1 ring-[var(--line)]" />
          {l.tipo === "slide" && (
            <div className="flex items-center gap-1">
              <button type="button" className="ct-icon-btn" onClick={() => mover(-1)} disabled={desativado || itens[i - 1]?.tipo !== "slide"} aria-label="Mover para a esquerda"><ChevronLeftIcon size={16} /></button>
              <button type="button" className="ct-icon-btn" onClick={() => mover(1)} disabled={desativado || itens[i + 1]?.tipo !== "slide"} aria-label="Mover para a direita"><ChevronRightIcon size={16} /></button>
              <button type="button" className="ct-btn ct-btn-ghost text-sm" onClick={tirar} disabled={desativado || itens.length <= MIN_LAMINAS}><TrashIcon size={14} />Tirar slide</button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 min-w-0">
          <p className="font-medium">{nomeLamina(itens, i)}</p>
          <label className="flex flex-col gap-1">
            <span className="flex justify-between gap-2 text-xs"><span className="text-[var(--muted)]">Título</span><Contador v={l.titulo} max={LIMITE.titulo} /></span>
            <textarea className="ct-input" rows={2} value={l.titulo} disabled={desativado} onChange={(e) => mudar({ titulo: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="flex justify-between gap-2 text-xs"><span className="text-[var(--muted)]">Subtítulo</span><Contador v={l.subtitulo} max={LIMITE.subtitulo} /></span>
            <input className="ct-input" value={l.subtitulo} disabled={desativado} onChange={(e) => mudar({ subtitulo: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="flex justify-between gap-2 text-xs"><span className="text-[var(--muted)]">Descrição</span><Contador v={l.descricao} max={LIMITE.descricao} /></span>
            <textarea className="ct-input" rows={4} value={l.descricao} disabled={desativado} onChange={(e) => mudar({ descricao: e.target.value })} />
          </label>
          <p className="text-xs text-[var(--muted)] -mt-1">Para destacar: *assim* sai em itálico e **assim** sai em negrito.</p>

          <div className="flex flex-col gap-2">
            <span className="text-xs text-[var(--muted)]">Foto (opcional)</span>
            {l.foto ? (
              <div className="flex flex-wrap items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(l.foto, 200)} alt="" className="w-12 h-12 object-cover rounded-md border border-[var(--line)]" />
                <div className="flex items-center rounded-full border border-[var(--line)] p-0.5" role="group" aria-label="Onde vai a foto">
                  {(["fundo", "moldura"] as ModoFoto[]).map((m) => (
                    <button key={m} type="button" disabled={desativado} onClick={() => mudar({ modoFoto: m })} aria-pressed={modo === m}
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${modo === m ? "bg-[var(--ink)] text-white" : "text-[var(--muted)]"}`}>{m === "fundo" ? "No fundo" : "Na moldura"}</button>
                  ))}
                </div>
                {modo === "moldura" && (
                  <div className="flex items-center rounded-full border border-[var(--line)] p-0.5" role="group" aria-label="Posição da foto">
                    {(["cima", "baixo", "lado"] as PosFoto[]).map((p) => (
                      <button key={p} type="button" disabled={desativado} onClick={() => mudar({ posFoto: p })} aria-pressed={pos === p}
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${pos === p ? "bg-[var(--ink)] text-white" : "text-[var(--muted)]"}`}>{p === "cima" ? "Em cima" : p === "baixo" ? "Embaixo" : "Ao lado"}</button>
                    ))}
                  </div>
                )}
                <button type="button" className="text-sm underline text-[var(--muted)]" disabled={desativado} onClick={abrirFotos}>Trocar</button>
                <button type="button" className="text-sm underline text-[var(--muted)]" disabled={desativado} onClick={() => mudar({ foto: undefined, modoFoto: undefined })}>Tirar</button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {l.notaFoto && <p className="text-sm rounded-lg bg-[#f5f5f7] px-3 py-2"><span className="text-[var(--muted)]">Foto indicada no roteiro: </span>{l.notaFoto}</p>}
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" className="ct-btn" disabled={desativado} onClick={abrirFotos}><ImageIcon size={16} />Pôr foto</button>
                  {l.notaFoto && <button type="button" className="text-sm underline text-[var(--muted)]" disabled={desativado} onClick={() => mudar({ notaFoto: undefined, modoFoto: undefined, posFoto: undefined })}>Sem foto nesta lâmina</button>}
                </div>
              </div>
            )}

            {escolhendo && (
              <div className="rounded-xl border border-[var(--line)] p-3 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Escolher foto</p>
                  <button type="button" className="ct-icon-btn" aria-label="Fechar" onClick={() => setEscolhendo(false)}><XIcon size={15} /></button>
                </div>
                {temPasta ? (
                  fotos === null ? <p className="text-sm text-[var(--muted)]">Abrindo a pasta do cliente…</p>
                    : fotos.length === 0 ? <p className="text-sm text-[var(--muted)]">A pasta do cliente não tem fotos soltas.</p>
                      : (
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-64 overflow-y-auto">
                          {fotos.map((f) => (
                            <button key={mediaKey(f)} type="button" onClick={() => porFoto(f)} title={f.name} className={`rounded-md overflow-hidden ring-1 ${l.foto && mediaKey(l.foto) === mediaKey(f) ? "ring-2 ring-[var(--ink)]" : "ring-[var(--line)]"}`}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={mediaUrl(f, 240)} alt={f.name ?? ""} loading="lazy" className="w-full aspect-square object-cover" />
                            </button>
                          ))}
                        </div>
                      )
                ) : <p className="text-sm text-[var(--muted)]">Sem pasta de fotos no kit de marca. Envie do computador.</p>}
                <label className={`ct-btn self-start ${enviando ? "opacity-50" : "cursor-pointer"}`}>
                  <UploadIcon size={15} />{enviando ? "Enviando…" : "Do computador"}
                  <input type="file" hidden accept="image/*" disabled={enviando} onChange={(e) => { const f = e.target.files?.[0]; if (f) doComputador(f); e.target.value = ""; }} />
                </label>
                {aviso && <p className="text-sm g-bad">{aviso}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
