"use client";

import JSZip from "jszip";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRightIcon, CheckIcon, FolderIcon } from "@/components/Icons";
import type { CanvaModelo } from "@/lib/brand";
import { agruparDesigns, IMG, type Lote } from "@/lib/canvaLote";
import type { Media } from "@/lib/content";
import type { ActionResult } from "@/lib/types";
import { uploadMedia } from "./upload";

export interface CarrosselLinha {
  id: string;
  title: string;
  date: string;
  status: string;
  media: number;
  canva?: { modeloId: string; campos: Record<string, string> };
}

interface Design { nome: string; paginas: { nome: string; blob: Blob }[]; capa: string }

const natural = (a: string, b: string) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });
const diaMes = (d: string) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "");

/** PNG vira JPG no navegador (o Instagram só publica JPG). JPG passa intacto. */
async function toJpeg(blob: Blob, name: string): Promise<Blob> {
  if (/\.jpe?g$/i.test(name)) return new Blob([blob], { type: "image/jpeg" });
  const bmp = await createImageBitmap(blob);
  const c = document.createElement("canvas");
  c.width = bmp.width; c.height = bmp.height;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bmp, 0, 0);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Falha ao converter PNG"))), "image/jpeg", 0.95));
}

/** Abre o ZIP do Canva (com ZIPs dentro, se for o caso) e devolve os designs, cada um com as lâminas em ordem. */
async function lerZip(file: File): Promise<Design[]> {
  const zip = await JSZip.loadAsync(file);
  const arquivos = new Map<string, JSZip.JSZipObject>();
  for (const e of Object.values(zip.files)) {
    if (e.dir) continue;
    if (/\.zip$/i.test(e.name)) {
      // Alguns downloads trazem um ZIP por design: cada um vira uma pasta.
      const pasta = e.name.replace(/\.zip$/i, "");
      const dentro = await JSZip.loadAsync(await e.async("blob"));
      for (const x of Object.values(dentro.files)) if (!x.dir && IMG.test(x.name)) arquivos.set(`${pasta}/${x.name.split("/").pop()}`, x);
    } else if (IMG.test(e.name)) arquivos.set(e.name, e);
  }
  const grupos = agruparDesigns([...arquivos.keys()]);
  const out: Design[] = [];
  for (const g of grupos) {
    const paginas = await Promise.all(g.arquivos.map(async (n) => ({ nome: n.split("/").pop() ?? n, blob: await arquivos.get(n)!.async("blob") })));
    out.push({ nome: g.nome, paginas, capa: URL.createObjectURL(paginas[0].blob) });
  }
  return out;
}

/**
 * Carrosséis no Canva, em lote: o Claude escreve o texto das lâminas nas colunas do modelo, a área baixa a
 * planilha do "Criar em massa", e o ZIP que volta do Canva é anexado a cada post.
 */
export function CanvaLote({ slug, local, modelos, carrosseis, lotes, driveFolder, kitHref, escrever, salvarCampo, planilha, anexar }: {
  slug: string;
  local: boolean;
  modelos: CanvaModelo[];
  carrosseis: CarrosselLinha[];
  lotes: Lote[];
  driveFolder?: string;
  kitHref: string;
  escrever: (postId: string, modeloId: string) => Promise<ActionResult & { campos?: Record<string, string> }>;
  salvarCampo: (postId: string, campo: string, valor: string) => Promise<ActionResult>;
  planilha: (modeloId: string, postIds: string[]) => Promise<ActionResult & { csv?: string; nome?: string; lote?: Lote }>;
  anexar: (postId: string, media: Media[]) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [modeloId, setModeloId] = useState(modelos[0]?.id ?? "");
  const [sel, setSel] = useState<string[]>(() => carrosseis.filter((c) => c.media === 0).map((c) => c.id));
  const [textos, setTextos] = useState<Record<string, Record<string, string>>>(() => Object.fromEntries(carrosseis.filter((c) => c.canva).map((c) => [`${c.id}:${c.canva!.modeloId}`, c.canva!.campos])));
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<ActionResult | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [destino, setDestino] = useState<string[]>([]);
  const [loteId, setLoteId] = useState(lotes[0]?.id ?? "");

  const modelo = modelos.find((m) => m.id === modeloId);
  const colunas = useMemo(() => modelo?.campos.filter((c) => c.tipo === "text") ?? [], [modelo]);
  const fotos = modelo?.campos.filter((c) => c.tipo === "image") ?? [];
  const pronto = (id: string) => !!textos[`${id}:${modeloId}`];
  const escolhidos = carrosseis.filter((c) => sel.includes(c.id));
  const faltam = escolhidos.filter((c) => !pronto(c.id));
  const lote = lotes.find((l) => l.id === loteId);

  // Solta as miniaturas quando o ZIP muda ou o painel fecha.
  useEffect(() => () => designs.forEach((d) => URL.revokeObjectURL(d.capa)), [designs]);

  async function escreverTodos(ids: string[]) {
    if (!modelo) return;
    setMsg(null);
    let ok = 0;
    for (const [i, id] of ids.entries()) {
      const c = carrosseis.find((x) => x.id === id);
      setBusy(`Escrevendo ${i + 1} de ${ids.length}: ${c?.title ?? ""}`);
      const r = await escrever(id, modelo.id).catch((e) => ({ ok: false, message: e instanceof Error ? e.message : String(e) }) as ActionResult & { campos?: Record<string, string> });
      if (!r.ok || !r.campos) { setMsg({ ok: false, message: `${c?.title ?? id}: ${r.message}` }); break; }
      setTextos((t) => ({ ...t, [`${id}:${modelo.id}`]: r.campos! }));
      ok++;
    }
    setBusy(null);
    if (ok === ids.length) setMsg({ ok: true, message: `${ok} ${ok === 1 ? "texto pronto" : "textos prontos"}. Confira e baixe a planilha.` });
    router.refresh();
  }

  async function baixar() {
    if (!modelo) return;
    setBusy("Montando a planilha…"); setMsg(null);
    const ordem = carrosseis.filter((c) => sel.includes(c.id)).map((c) => c.id);
    const r = await planilha(modelo.id, ordem).catch((e) => ({ ok: false, message: e instanceof Error ? e.message : String(e) }) as ActionResult);
    setBusy(null);
    if (!r.ok || !("csv" in r) || !r.csv) { setMsg(r); return; }
    const url = URL.createObjectURL(new Blob([r.csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = r.nome ?? "planilha.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    if (r.lote) setLoteId(r.lote.id);
    setMsg({ ok: true, message: `${r.message} Agora, no Canva: Criar em massa com este arquivo.` });
    router.refresh();
  }

  async function onZip(file: File) {
    setMsg(null); setBusy("Lendo o ZIP do Canva…");
    try {
      const ds = await lerZip(file);
      if (!ds.length) throw new Error("Não encontrei imagens (PNG ou JPG) no ZIP.");
      setDesigns(ds);
      const ordem = lote?.postIds ?? escolhidos.map((c) => c.id);
      setDestino(ds.map((_, i) => ordem[i] ?? ""));
    } catch (e) {
      setMsg({ ok: false, message: e instanceof Error ? e.message : String(e) });
    } finally { setBusy(null); }
  }

  async function anexarTodos() {
    setMsg(null);
    const usados = destino.filter(Boolean);
    if (new Set(usados).size !== usados.length) { setMsg({ ok: false, message: "Dois designs estão indo para o mesmo post. Confira a coluna Post." }); return; }
    let ok = 0;
    const total = designs.reduce((a, d, i) => a + (destino[i] ? d.paginas.length : 0), 0);
    let n = 0;
    try {
      for (const [i, d] of designs.entries()) {
        const postId = destino[i];
        if (!postId) continue;
        if (d.paginas.length > 10) throw new Error(`${d.nome}: ${d.paginas.length} lâminas. O Instagram aceita até 10.`);
        const pasta = `content-media/${slug}/canva/${postId}-${Date.now().toString(36)}`;
        const media: Media[] = [];
        for (const [j, p] of d.paginas.entries()) {
          n++; setBusy(`Enviando ${n} de ${total}: ${d.nome} · lâmina ${j + 1}`);
          const path = await uploadMedia(`${pasta}/${String(j + 1).padStart(2, "0")}.jpg`, await toJpeg(p.blob, p.nome), local);
          media.push({ path, kind: "image", name: `${String(j + 1).padStart(2, "0")}.jpg`, mime: "image/jpeg" });
        }
        const r = await anexar(postId, media);
        if (!r.ok) throw new Error(r.message);
        ok++;
      }
      setMsg({ ok: true, message: `${ok} ${ok === 1 ? "carrossel recebeu" : "carrosséis receberam"} as lâminas. Confira cada um e envie para aprovação.` });
      setDesigns([]); setDestino([]);
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, message: e instanceof Error ? e.message : String(e) });
    } finally { setBusy(null); }
  }

  if (!open) return <button type="button" className="ct-btn" onClick={() => setOpen(true)}>Carrosséis no Canva</button>;

  return (
    <section className="card p-4 flex flex-col gap-4 w-full">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <p className="font-medium">Carrosséis no Canva</p>
        <button type="button" className="text-sm text-[var(--muted)]" onClick={() => { setOpen(false); setDesigns([]); }}>Fechar</button>
      </div>

      {!modelos.length ? (
        <p className="text-sm">Este cliente ainda não tem modelo do Canva. <a href={kitHref} className="underline">Cadastre no kit de marca</a> as colunas do modelo.</p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <span className="label">1. Modelo</span>
            <div className="flex flex-wrap items-center gap-2">
              <select className="ct-input max-w-xs" value={modeloId} onChange={(e) => setModeloId(e.target.value)} disabled={!!busy}>
                {modelos.map((m) => <option key={m.id} value={m.id}>{m.titulo}</option>)}
              </select>
              {modelo?.link && <a href={modelo.link} target="_blank" rel="noreferrer" className="ct-btn">Abrir no Canva<ArrowUpRightIcon size={14} /></a>}
              <span className="text-xs text-[var(--muted)]">{colunas.length} colunas de texto{fotos.length ? ` · ${fotos.length} de foto` : ""}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="label">2. Carrosséis e texto das lâminas</span>
            {!carrosseis.length ? <p className="text-sm text-[var(--muted)]">Nenhum carrossel no planejamento ainda.</p> : (
              <div className="scroll-x">
                <table className="data">
                  <thead><tr><th></th><th>Data</th><th style={{ textAlign: "left" }}>Carrossel</th><th>Lâminas</th><th>Texto</th><th></th></tr></thead>
                  <tbody>
                    {carrosseis.map((c) => {
                      const t = textos[`${c.id}:${modeloId}`];
                      return (
                        <tr key={c.id}>
                          <td><input type="checkbox" aria-label={`Incluir ${c.title}`} checked={sel.includes(c.id)} disabled={!!busy} onChange={(e) => setSel((s) => (e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id)))} /></td>
                          <td>{diaMes(c.date)}</td>
                          <td className="max-w-[300px] truncate" style={{ textAlign: "left" }} title={c.title}>{c.title}</td>
                          <td>{c.media || "-"}</td>
                          <td>{t ? <span className="inline-flex items-center gap-1 g-good"><CheckIcon size={13} />pronto</span> : <span className="text-[var(--muted)]">falta</span>}</td>
                          <td className="whitespace-nowrap">
                            {t && <button type="button" className="text-sm underline" onClick={() => setAberto(aberto === c.id ? null : c.id)}>{aberto === c.id ? "Fechar" : "Ver"}</button>}
                            {" "}<button type="button" className="text-sm underline" disabled={!!busy} onClick={() => escreverTodos([c.id])}>{t ? "Refazer" : "Escrever"}</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {aberto && textos[`${aberto}:${modeloId}`] && (
              <div className="rounded-xl border border-[var(--line)] p-3 flex flex-col gap-2">
                <p className="text-sm font-medium">{carrosseis.find((c) => c.id === aberto)?.title}</p>
                {colunas.map((col) => {
                  const v = textos[`${aberto}:${modeloId}`][col.nome] ?? "";
                  const n = v.trim() ? v.trim().split(/\s+/).length : 0;
                  return (
                    <label key={col.nome} className="grid sm:grid-cols-[180px_minmax(0,1fr)_70px] gap-2 items-center">
                      <span className="mono text-[12px] text-[var(--muted)]">{col.nome}</span>
                      <input className="ct-input" defaultValue={v} onBlur={async (e) => {
                        if (e.target.value === v) return;
                        const r = await salvarCampo(aberto, col.nome, e.target.value);
                        if (r.ok) setTextos((t) => ({ ...t, [`${aberto}:${modeloId}`]: { ...t[`${aberto}:${modeloId}`], [col.nome]: e.target.value } }));
                        else setMsg(r);
                      }} />
                      <span className={`text-xs ${col.limite && n > col.limite ? "g-bad" : "text-[var(--muted)]"}`}>{n}{col.limite ? `/${col.limite}` : ""} pal.</span>
                    </label>
                  );
                })}
              </div>
            )}
            <div className="flex flex-wrap gap-2 items-center">
              <button type="button" className="ct-btn ct-btn-dark" disabled={!!busy || !faltam.length} onClick={() => escreverTodos(faltam.map((c) => c.id))}>{faltam.length ? `Escrever os textos (${faltam.length})` : "Textos prontos"}</button>
              <button type="button" className="ct-btn" disabled={!!busy || !escolhidos.length || faltam.length > 0} onClick={baixar}>3. Baixar planilha ({escolhidos.length})</button>
            </div>
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer label">Como fazer no Canva</summary>
            <ol className="list-decimal pl-5 mt-2 flex flex-col gap-1">
              <li>Abra o modelo no Canva e vá em Apps › Criar em massa.</li>
              <li>Envie a planilha baixada. A coluna &quot;post&quot; é só para conferir; não precisa ligar.</li>
              <li>Ligue cada coluna à caixa certa: clique com o botão direito na caixa › Conectar dados.</li>
              {fotos.length > 0 && <li>Fotos ({fotos.map((f) => f.nome).join(", ")}): adicione na tabela do Canva, da pasta do cliente{driveFolder ? <> (<a href={driveFolder} target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1"><FolderIcon size={13} />abrir pasta</a>)</> : ""}.</li>}
              <li>Gere os designs, selecione todos e baixe em PNG ou JPG (sai um ZIP).</li>
            </ol>
          </details>

          <div className="flex flex-col gap-2">
            <span className="label">4. Trazer as lâminas de volta</span>
            <div className="flex flex-wrap items-center gap-2">
              {lotes.length > 0 && (
                <select className="ct-input w-auto" value={loteId} onChange={(e) => setLoteId(e.target.value)} disabled={!!busy} aria-label="Lote">
                  {lotes.map((l) => <option key={l.id} value={l.id}>{l.modeloTitulo} · {l.postIds.length} carrosséis · {new Date(l.at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</option>)}
                </select>
              )}
              <label className={`ct-btn ${busy ? "opacity-50" : "cursor-pointer"}`}>Escolher o ZIP do Canva
                <input type="file" hidden accept=".zip,application/zip" disabled={!!busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) onZip(f); e.target.value = ""; }} />
              </label>
            </div>
            {designs.length > 0 && (
              <>
                <div className="scroll-x">
                  <table className="data">
                    <thead><tr><th>Capa</th><th style={{ textAlign: "left" }}>Design no ZIP</th><th>Lâminas</th><th style={{ textAlign: "left" }}>Post</th></tr></thead>
                    <tbody>
                      {designs.map((d, i) => (
                        <tr key={`${d.nome}-${i}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <td><img src={d.capa} alt="" className="w-12 aspect-[4/5] object-cover rounded-md border border-[var(--line)]" /></td>
                          <td className="max-w-[220px] truncate" style={{ textAlign: "left" }} title={d.nome}>{d.nome}</td>
                          <td className={d.paginas.length > 10 ? "g-bad" : ""}>{d.paginas.length}</td>
                          <td style={{ textAlign: "left" }}>
                            <select className="ct-input w-auto max-w-[280px]" value={destino[i] ?? ""} onChange={(e) => setDestino((x) => x.map((v, j) => (j === i ? e.target.value : v)))} aria-label={`Post para ${d.nome}`}>
                              <option value="">Não anexar</option>
                              {[...carrosseis].sort((a, b) => natural(a.date, b.date)).map((c) => <option key={c.id} value={c.id}>{diaMes(c.date)} · {c.title}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-[var(--muted)]">A ordem segue a planilha do lote escolhido. Confira pela capa antes de anexar: as lâminas de cada post são trocadas pelas do Canva.</p>
                <div><button type="button" className="ct-btn ct-btn-dark" disabled={!!busy || !destino.some(Boolean)} onClick={anexarTodos}>Anexar aos posts</button></div>
              </>
            )}
          </div>
        </>
      )}
      {busy && <p className="text-sm text-[var(--muted)]" role="status">{busy}</p>}
      {msg && <p className={`text-sm ${msg.ok ? "g-good" : "g-bad"}`} role="status">{msg.message}</p>}
    </section>
  );
}
