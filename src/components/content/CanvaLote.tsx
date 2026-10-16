"use client";

import JSZip from "jszip";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, ArrowUpRightIcon, CheckIcon, ChevronDownIcon, ChevronLeftIcon, DownloadIcon, FolderIcon, LayersIcon, RefreshIcon, UploadIcon, XIcon } from "@/components/Icons";
import { secoesTexto, type CanvaModelo } from "@/lib/brand";
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
type Passo = 1 | 2 | 3 | 4;

const PASSOS: { n: Passo; nome: string }[] = [
  { n: 1, nome: "Escolher" },
  { n: 2, nome: "Texto" },
  { n: 3, nome: "No Canva" },
  { n: 4, nome: "Trazer de volta" },
];

const natural = (a: string, b: string) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });
const diaMes = (d: string) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "sem data");
const palavras = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const erro = (e: unknown) => ({ ok: false, message: e instanceof Error ? e.message : String(e) });

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
 * Carrosséis no Canva, em lote, num passo a passo: escolher os carrosséis, o Claude escrever o texto das
 * lâminas, baixar a planilha do "Criar em massa" e, na volta, anexar a cada post as lâminas do ZIP do Canva.
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
  const [passo, setPasso] = useState<Passo>(1);
  const [modeloId, setModeloId] = useState(modelos[0]?.id ?? "");
  const [sel, setSel] = useState<string[]>(() => carrosseis.filter((c) => c.media === 0 && c.status !== "agendado").map((c) => c.id));
  const [textos, setTextos] = useState<Record<string, Record<string, string>>>(() => Object.fromEntries(carrosseis.filter((c) => c.canva).map((c) => [`${c.id}:${c.canva!.modeloId}`, c.canva!.campos])));
  const [busy, setBusy] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<{ n: number; total: number } | null>(null);
  const [msg, setMsg] = useState<ActionResult | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [baixada, setBaixada] = useState(false);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [destino, setDestino] = useState<string[]>([]);
  const [loteNovo, setLoteNovo] = useState<Lote | null>(null);
  const [loteId, setLoteId] = useState(lotes[0]?.id ?? "");
  const [arrastando, setArrastando] = useState(false);
  const [feito, setFeito] = useState<string | null>(null);
  const zipInput = useRef<HTMLInputElement>(null);

  const modelo = modelos.find((m) => m.id === modeloId);
  const secoes = useMemo(() => secoesTexto(modelo?.campos ?? []), [modelo]);
  const fotos = modelo?.campos.filter((c) => c.tipo === "image") ?? [];
  const texto = (id: string) => textos[`${id}:${modeloId}`];
  const escolhidos = carrosseis.filter((c) => sel.includes(c.id));
  const faltam = escolhidos.filter((c) => !texto(c.id));
  const todosLotes = loteNovo && !lotes.some((l) => l.id === loteNovo.id) ? [loteNovo, ...lotes] : lotes;
  const lote = todosLotes.find((l) => l.id === loteId);
  const recente = lotes[0] && Date.now() - new Date(lotes[0].at).getTime() < 7 * 864e5 ? lotes[0] : undefined;
  const porId = new Map(carrosseis.map((c) => [c.id, c]));
  const podeIr = (p: Passo) => !busy && (p === 1 || p === 4 || (p === 2 && escolhidos.length > 0) || (p === 3 && escolhidos.length > 0 && faltam.length === 0));

  // Solta as miniaturas quando o ZIP muda ou o painel fecha.
  useEffect(() => () => designs.forEach((d) => URL.revokeObjectURL(d.capa)), [designs]);

  // Painel aberto: a página atrás não rola e Esc fecha.
  useEffect(() => {
    if (!open) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) fechar(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = antes; window.removeEventListener("keydown", onKey); };
  }, [open, busy]);

  function fechar() {
    setOpen(false); setDesigns([]); setDestino([]); setMsg(null); setFeito(null);
  }
  function ir(p: Passo) {
    if (!podeIr(p)) return;
    setMsg(null); setFeito(null); setPasso(p);
  }

  async function escreverTodos(ids: string[]) {
    if (!modelo || !ids.length) return;
    setMsg(null);
    let ok = 0;
    for (const [i, id] of ids.entries()) {
      const c = porId.get(id);
      setProgresso({ n: i, total: ids.length });
      setBusy(ids.length === 1 ? `Escrevendo: ${c?.title ?? ""}` : `Escrevendo ${i + 1} de ${ids.length}: ${c?.title ?? ""}`);
      const r = await escrever(id, modelo.id).catch((e) => erro(e) as ActionResult & { campos?: Record<string, string> });
      if (!r.ok || !r.campos) { setMsg({ ok: false, message: `${c?.title ?? id}: ${r.message}` }); break; }
      setTextos((t) => ({ ...t, [`${id}:${modelo.id}`]: r.campos! }));
      ok++;
    }
    setBusy(null); setProgresso(null);
    if (ok === ids.length && ids.length > 1) setMsg({ ok: true, message: `${plural(ok, "texto pronto", "textos prontos")}. Abra cada um para conferir.` });
    if (ok === ids.length && ids.length === 1) setAberto(ids[0]);
    router.refresh();
  }

  async function baixar() {
    if (!modelo) return;
    setBusy("Montando a planilha…"); setMsg(null);
    const ordem = escolhidos.map((c) => c.id);
    const r = await planilha(modelo.id, ordem).catch((e) => erro(e) as ActionResult);
    setBusy(null);
    if (!r.ok || !("csv" in r) || !r.csv) { setMsg(r); return; }
    const url = URL.createObjectURL(new Blob([r.csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = r.nome ?? "planilha.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    if (r.lote) { setLoteNovo(r.lote); setLoteId(r.lote.id); }
    setBaixada(true);
    router.refresh();
  }

  function ordemDoLote(l: Lote | undefined, n: number) {
    const ordem = l?.postIds ?? escolhidos.map((c) => c.id);
    return Array.from({ length: n }, (_, i) => ordem[i] ?? "");
  }

  async function onZip(file: File) {
    setMsg(null); setFeito(null); setBusy("Abrindo o ZIP…");
    try {
      if (!/\.zip$/i.test(file.name)) throw new Error("Esse arquivo não é um ZIP. No Canva, baixe os designs em JPG: vem um arquivo .zip.");
      let ds = await lerZip(file);
      if (!ds.length) throw new Error("Não achei imagens (JPG ou PNG) nesse ZIP.");
      // Tudo num design só (o Canva gerou "um design com várias páginas"): divide em partes iguais, uma por carrossel da planilha.
      const n = (lote?.postIds ?? escolhidos.map((c) => c.id)).length;
      if (ds.length === 1 && n > 1 && ds[0].paginas.length > 10 && ds[0].paginas.length % n === 0) {
        const unico = ds[0];
        const cada = unico.paginas.length / n;
        URL.revokeObjectURL(unico.capa);
        ds = Array.from({ length: n }, (_, i) => {
          const paginas = unico.paginas.slice(i * cada, (i + 1) * cada);
          return { nome: `Carrossel ${i + 1}`, paginas, capa: URL.createObjectURL(paginas[0].blob) };
        });
      }
      setDesigns(ds);
      setDestino(ordemDoLote(lote, ds.length));
    } catch (e) {
      setMsg(erro(e));
    } finally { setBusy(null); }
  }

  async function anexarTodos() {
    setMsg(null);
    const usados = destino.filter(Boolean);
    if (new Set(usados).size !== usados.length) { setMsg({ ok: false, message: "Dois designs estão indo para o mesmo carrossel. Confira a lista de cada design." }); return; }
    const grande = designs.find((d, i) => destino[i] && d.paginas.length > 10);
    if (grande) { setMsg({ ok: false, message: `${grande.nome} tem ${grande.paginas.length} lâminas. O Instagram aceita até 10.` }); return; }
    let ok = 0;
    const total = designs.reduce((a, d, i) => a + (destino[i] ? d.paginas.length : 0), 0);
    let n = 0;
    try {
      for (const [i, d] of designs.entries()) {
        const postId = destino[i];
        if (!postId) continue;
        const titulo = porId.get(postId)?.title ?? d.nome;
        const pasta = `content-media/${slug}/canva/${postId}-${Date.now().toString(36)}`;
        const media: Media[] = [];
        for (const [j, p] of d.paginas.entries()) {
          setProgresso({ n, total }); n++;
          setBusy(`Enviando ${titulo}: lâmina ${j + 1} de ${d.paginas.length}`);
          const path = await uploadMedia(`${pasta}/${String(j + 1).padStart(2, "0")}.jpg`, await toJpeg(p.blob, p.nome), local);
          media.push({ path, kind: "image", name: `${String(j + 1).padStart(2, "0")}.jpg`, mime: "image/jpeg" });
        }
        const r = await anexar(postId, media);
        if (!r.ok) throw new Error(r.message);
        ok++;
      }
      setFeito(`${ok === 1 ? "1 carrossel recebeu" : `${ok} carrosséis receberam`} as lâminas do Canva. Agora é conferir cada um no feed e mandar para aprovação.`);
      setDesigns([]); setDestino([]);
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, message: `${ok ? `${plural(ok, "carrossel anexado", "carrosséis anexados")}. ` : ""}${erro(e).message}` });
      router.refresh();
    } finally { setBusy(null); setProgresso(null); }
  }

  if (!open) {
    return (
      <button type="button" className="ct-btn" onClick={() => { setOpen(true); setPasso(1); }}>
        <LayersIcon size={16} />Carrosséis no Canva
      </button>
    );
  }

  const barra = progresso && (
    <div className="h-1.5 rounded-full bg-[var(--line)] overflow-hidden" aria-hidden>
      <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${Math.max(4, (progresso.n / Math.max(1, progresso.total)) * 100)}%` }} />
    </div>
  );

  // Rodapé de cada passo: voltar à esquerda, próxima ação à direita.
  let voltar: Passo | null = null;
  let acao: { label: ReactNode; onClick: () => void; disabled?: boolean } | null = null;
  if (passo === 1) acao = { label: <>Continuar com {plural(escolhidos.length, "carrossel", "carrosséis")}<ArrowRightIcon size={15} /></>, onClick: () => ir(2), disabled: !podeIr(2) };
  if (passo === 2) { voltar = 1; acao = faltam.length ? { label: <>Escrever {faltam.length === 1 ? "o texto" : `os ${faltam.length} textos`}</>, onClick: () => escreverTodos(faltam.map((c) => c.id)), disabled: !!busy } : { label: <>Continuar<ArrowRightIcon size={15} /></>, onClick: () => ir(3), disabled: !podeIr(3) }; }
  if (passo === 3) { voltar = 2; acao = { label: <>Já baixei o ZIP do Canva<ArrowRightIcon size={15} /></>, onClick: () => ir(4) }; }
  if (passo === 4 && !feito) { voltar = 3; acao = designs.length ? { label: <>Anexar {destino.filter(Boolean).length === 1 ? "ao carrossel" : `aos ${destino.filter(Boolean).length} carrosséis`}</>, onClick: anexarTodos, disabled: !!busy || !destino.some(Boolean) } : null; }

  return (
    <div className="fixed inset-0 z-50 bg-black/35 overflow-y-auto sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) fechar(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="canva-titulo" className="bg-[var(--card)] w-full sm:max-w-3xl sm:mx-auto min-h-full sm:min-h-0 sm:rounded-[18px] shadow-xl flex flex-col">
        <header className="px-5 pt-5 pb-4 border-b border-[var(--line)] flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="canva-titulo" className="text-lg font-semibold tracking-tight">Carrosséis no Canva</h2>
              <p className="text-sm text-[var(--muted)]">O texto sai daqui, o desenho sai do Canva.</p>
            </div>
            <button type="button" className="ct-icon-btn" aria-label="Fechar" onClick={fechar} disabled={!!busy}><XIcon size={18} /></button>
          </div>
          {modelos.length > 0 && (
            <ol className="grid grid-cols-4 gap-1" aria-label="Passos">
              {PASSOS.map((p) => {
                const atual = p.n === passo;
                const antes = p.n < passo;
                return (
                  <li key={p.n} className="flex flex-col items-center gap-1 min-w-0">
                    <button type="button" onClick={() => ir(p.n)} disabled={!atual && !podeIr(p.n)} aria-current={atual ? "step" : undefined}
                      className={`w-7 h-7 rounded-full grid place-items-center text-[13px] font-semibold border transition-colors ${atual ? "bg-[var(--ink)] border-[var(--ink)] text-white" : antes ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "bg-white border-[var(--line)] text-[var(--muted)]"} disabled:cursor-default`}>
                      {antes ? <CheckIcon size={14} /> : p.n}
                    </button>
                    <span className={`text-[11px] text-center leading-tight ${atual ? "font-semibold" : "text-[var(--muted)]"}`}>{p.nome}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </header>

        <div className="px-5 py-5 flex-1 flex flex-col gap-5">
          {!modelos.length ? (
            <div className="flex flex-col items-start gap-3 py-6">
              <p className="font-medium">Falta o modelo do Canva deste cliente</p>
              <p className="text-sm text-[var(--muted)] max-w-md">Cadastre no kit de marca o modelo que vai ser usado e quais textos ele tem. Depois é só voltar aqui.</p>
              <a href={kitHref} className="ct-btn ct-btn-dark">Ir para o kit de marca<ArrowRightIcon size={15} /></a>
            </div>
          ) : passo === 1 ? (
            <>
              {recente && (
                <div className="rounded-xl bg-[#f5f5f7] p-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm">Voltou do Canva? A última planilha foi de {quando(recente.at)} ({plural(recente.postIds.length, "carrossel", "carrosséis")}, {recente.modeloTitulo}).</p>
                  <button type="button" className="ct-btn" onClick={() => { setLoteId(recente.id); ir(4); }}>Trazer as lâminas</button>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <p className="font-medium">Qual modelo?</p>
                {modelos.length === 1 ? (
                  <p className="text-sm text-[var(--muted)]">{modelos[0].titulo}</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {modelos.map((m) => (
                      <button key={m.id} type="button" onClick={() => setModeloId(m.id)} className={`tm-card text-left ${m.id === modeloId ? "is-on" : ""}`} aria-pressed={m.id === modeloId}>
                        <span className="font-medium truncate">{m.titulo}</span>
                        <span className="text-xs text-[var(--muted)]">{m.campos.some((c) => c.tipo === "image") ? "com fotos" : "só texto"}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium">Quais carrosséis?</p>
                  {carrosseis.length > 1 && (
                    <button type="button" className="text-sm text-[var(--muted)] underline" onClick={() => setSel(sel.length === carrosseis.length ? [] : carrosseis.map((c) => c.id))}>
                      {sel.length === carrosseis.length ? "Desmarcar todos" : "Marcar todos"}
                    </button>
                  )}
                </div>
                {!carrosseis.length ? (
                  <p className="text-sm text-[var(--muted)]">Nenhum carrossel no planejamento ainda. Crie os posts do tipo carrossel, com o roteiro, e volte aqui.</p>
                ) : (
                  <ul className="flex flex-col rounded-xl border border-[var(--line)] divide-y divide-[var(--line)] overflow-hidden">
                    {carrosseis.map((c) => {
                      const on = sel.includes(c.id);
                      return (
                        <li key={c.id}>
                          <label className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer ${on ? "bg-[#fafaf8]" : ""}`}>
                            <input type="checkbox" className="w-4 h-4 accent-[var(--accent)] shrink-0" checked={on} onChange={(e) => setSel((s) => (e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id)))} />
                            <span className="flex flex-col min-w-0 flex-1">
                              <span className="truncate text-sm font-medium">{c.title}</span>
                              <span className="text-xs text-[var(--muted)]">
                                {diaMes(c.date)} · {c.media ? plural(c.media, "lâmina", "lâminas") : "sem lâminas"}
                                {texto(c.id) ? " · texto pronto" : ""}{c.status === "agendado" ? " · agendado" : ""}
                              </span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          ) : passo === 2 ? (
            <>
              <p className="text-sm text-[var(--muted)]">O Claude escreve o texto de cada lâmina a partir do roteiro do post, no tamanho que cabe no modelo {modelo?.titulo}. Abra cada carrossel para conferir; o que você mudar fica salvo.</p>
              <ul className="flex flex-col gap-2">
                {escolhidos.map((c) => {
                  const t = texto(c.id);
                  const exp = aberto === c.id && !!t;
                  const passou = t ? secoes.some((s) => s.campos.some((f) => f.limite && palavras(t[f.nome] ?? "") > f.limite)) : false;
                  return (
                    <li key={c.id} className="rounded-xl border border-[var(--line)]">
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        <button type="button" className="flex items-center gap-2 min-w-0 flex-1 text-left disabled:cursor-default" disabled={!t} onClick={() => setAberto(exp ? null : c.id)} aria-expanded={exp}>
                          <span className="truncate text-sm font-medium">{c.title}</span>
                          {t && <ChevronDownIcon size={15} className={`shrink-0 text-[var(--muted)] transition-transform ${exp ? "rotate-180" : ""}`} />}
                        </button>
                        {t ? <span className={`pill ${passou ? "pill-yellow" : "pill-green"}`}>{passou ? "Texto longo" : <><CheckIcon size={11} />Pronto</>}</span> : <span className="pill">Falta</span>}
                        <button type="button" className="ct-icon-btn" disabled={!!busy} onClick={() => escreverTodos([c.id])} title={t ? "Escrever de novo" : "Escrever"} aria-label={t ? `Escrever de novo: ${c.title}` : `Escrever: ${c.title}`}><RefreshIcon size={15} /></button>
                      </div>
                      {exp && t && (
                        <div className="border-t border-[var(--line)] px-3 py-3 flex flex-col gap-4">
                          {secoes.map((s) => (
                            <div key={s.secao} className="flex flex-col gap-2">
                              <p className="label">{s.secao}</p>
                              {s.campos.map((f) => {
                                const v = t[f.nome] ?? "";
                                const n = palavras(v);
                                const longo = (f.limite ?? 0) > 16;
                                const salvar = async (novo: string) => {
                                  if (novo === v) return;
                                  const r = await salvarCampo(c.id, f.nome, novo).catch((e) => erro(e));
                                  if (r.ok) setTextos((x) => ({ ...x, [`${c.id}:${modeloId}`]: { ...x[`${c.id}:${modeloId}`], [f.nome]: novo } }));
                                  else setMsg(r);
                                };
                                return (
                                  <label key={`${f.nome}:${v}`} className="flex flex-col gap-1">
                                    <span className="flex justify-between gap-2 text-xs">
                                      <span className="text-[var(--muted)]">{f.papel.charAt(0).toUpperCase() + f.papel.slice(1)}</span>
                                      <span className={f.limite && n > f.limite ? "g-bad" : "text-[var(--muted)]"}>{f.limite ? `${n} de ${f.limite} palavras` : plural(n, "palavra", "palavras")}</span>
                                    </span>
                                    {longo
                                      ? <textarea className="ct-input" rows={3} defaultValue={v} onBlur={(e) => salvar(e.target.value)} />
                                      : <input className="ct-input" defaultValue={v} onBlur={(e) => salvar(e.target.value)} />}
                                  </label>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {!faltam.length && <p className="text-sm g-good inline-flex items-center gap-1.5"><CheckIcon size={14} />Todos os textos prontos.</p>}
            </>
          ) : passo === 3 ? (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-[var(--line)] p-4 flex flex-col gap-3">
                  <p className="label">1 · Planilha</p>
                  <p className="text-sm">O texto dos {plural(escolhidos.length, "carrossel", "carrosséis")}, um por linha, na ordem.</p>
                  <div className="mt-auto flex items-center gap-2">
                    <button type="button" className={`ct-btn ${baixada ? "" : "ct-btn-dark"}`} disabled={!!busy} onClick={baixar}><DownloadIcon size={16} />{baixada ? "Baixar de novo" : "Baixar planilha"}</button>
                    {baixada && <span className="text-sm g-good inline-flex items-center gap-1"><CheckIcon size={14} />Baixada</span>}
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--line)] p-4 flex flex-col gap-3">
                  <p className="label">2 · Modelo</p>
                  <p className="text-sm">Abra o modelo {modelo?.titulo} no Canva.</p>
                  <div className="mt-auto">
                    {modelo?.link
                      ? <a href={modelo.link} target="_blank" rel="noreferrer" className={`ct-btn ${baixada ? "ct-btn-dark" : ""}`}>Abrir no Canva<ArrowUpRightIcon size={14} /></a>
                      : <a href={kitHref} className="text-sm underline g-warn">Falta o link do modelo no kit de marca</a>}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <p className="font-medium">No Canva</p>
                <ol className="flex flex-col gap-2 text-sm">
                  {[
                    <>No modelo, abra <b>Apps</b> e escolha <b>Criar em massa</b>. Envie a planilha que você baixou.</>,
                    <>Ligue cada caixa de texto à coluna de mesmo nome: selecione a caixa e use <b>Conectar dados</b>. A coluna “post” é só para você conferir.</>,
                    ...(fotos.length ? [<>Coloque as fotos na tabela do Canva{driveFolder ? <>, a partir da <a href={driveFolder} target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1"><FolderIcon size={13} />pasta do cliente</a></> : ""}.</>] : []),
                    <>Toque em <b>Continuar</b>. Em <b>Opções avançadas</b>, deixe <b>um design com várias páginas</b> e gere.</>,
                    <>No design gerado: <b>Compartilhar</b>, <b>Baixar</b>, formato <b>JPG</b>, todas as páginas. Vem um arquivo ZIP, e a área separa os carrosséis sozinha.</>,
                  ].map((li, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="w-6 h-6 shrink-0 rounded-full bg-[#f5f5f7] grid place-items-center text-xs font-semibold">{i + 1}</span>
                      <span className="pt-0.5">{li}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          ) : feito ? (
            <div className="flex flex-col items-center text-center gap-3 py-8">
              <span className="w-12 h-12 rounded-full bg-[var(--accent)] text-white grid place-items-center"><CheckIcon size={22} /></span>
              <p className="font-medium">Pronto</p>
              <p className="text-sm text-[var(--muted)] max-w-sm">{feito}</p>
              <button type="button" className="ct-btn ct-btn-dark mt-2" onClick={fechar}>Fechar</button>
            </div>
          ) : (
            <>
              {!designs.length ? (
                <>
                  <button type="button" disabled={!!busy}
                    onClick={() => zipInput.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
                    onDragLeave={() => setArrastando(false)}
                    onDrop={(e) => { e.preventDefault(); setArrastando(false); const f = e.dataTransfer.files?.[0]; if (f) onZip(f); }}
                    className={`rounded-2xl border-2 border-dashed px-6 py-10 flex flex-col items-center gap-2 text-center transition-colors ${arrastando ? "border-[var(--accent)] bg-[#eef5f1]" : "border-[var(--line)] hover:bg-[#fafaf8]"}`}>
                    <UploadIcon size={26} className="text-[var(--muted)]" />
                    <span className="font-medium">Arraste aqui o ZIP do Canva</span>
                    <span className="text-sm text-[var(--muted)]">ou clique para escolher o arquivo</span>
                  </button>
                  <input ref={zipInput} type="file" hidden accept=".zip,application/zip" onChange={(e) => { const f = e.target.files?.[0]; if (f) onZip(f); e.target.value = ""; }} />
                  {todosLotes.length > 0 && (
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="text-[var(--muted)]">Os designs entram na ordem desta planilha:</span>
                      <select className="ct-input" value={loteId} onChange={(e) => setLoteId(e.target.value)} disabled={!!busy}>
                        {todosLotes.map((l) => <option key={l.id} value={l.id}>{l.modeloTitulo} · {quando(l.at)} · {plural(l.postIds.length, "carrossel", "carrosséis")}</option>)}
                      </select>
                    </label>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-[var(--muted)]">Confira pela capa se cada design vai para o carrossel certo. Se precisar, troque o carrossel na lista de cada um. As lâminas atuais desses posts são substituídas.</p>
                  <ul className="flex flex-col gap-2">
                    {designs.map((d, i) => {
                      const muitas = d.paginas.length > 10;
                      return (
                        <li key={`${d.nome}-${i}`} className="rounded-xl border border-[var(--line)] p-2.5 flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={d.capa} alt={`Capa de ${d.nome}`} className="w-14 aspect-[4/5] object-cover rounded-lg border border-[var(--line)] shrink-0" />
                          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                            <span className={`text-xs ${muitas ? "g-bad" : "text-[var(--muted)]"}`}>{plural(d.paginas.length, "lâmina", "lâminas")}{muitas ? " (o Instagram aceita até 10)" : ""}</span>
                            <select className="ct-input" value={destino[i] ?? ""} onChange={(e) => setDestino((x) => x.map((v, j) => (j === i ? e.target.value : v)))} aria-label={`Carrossel para o design ${i + 1}`}>
                              <option value="">Não usar este design</option>
                              {[...carrosseis].sort((a, b) => natural(a.date, b.date)).map((c) => <option key={c.id} value={c.id} disabled={c.status === "agendado"}>{diaMes(c.date)} · {c.title}{c.status === "agendado" ? " (agendado)" : ""}</option>)}
                            </select>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <div><button type="button" className="text-sm text-[var(--muted)] underline" disabled={!!busy} onClick={() => { setDesigns([]); setDestino([]); }}>Escolher outro ZIP</button></div>
                </>
              )}
            </>
          )}

          {(busy || msg) && (
            <div className="flex flex-col gap-2" role="status">
              {busy && <p className="text-sm text-[var(--muted)]">{busy}</p>}
              {barra}
              {msg && <p className={`text-sm ${msg.ok ? "g-good" : "g-bad"}`}>{msg.message}</p>}
            </div>
          )}
        </div>

        {modelos.length > 0 && (voltar || acao) && (
          <footer className="sticky bottom-0 bg-[var(--card)] border-t border-[var(--line)] px-5 py-3 flex items-center justify-between gap-2 sm:rounded-b-[18px]">
            {voltar ? <button type="button" className="ct-btn ct-btn-ghost" disabled={!!busy} onClick={() => ir(voltar!)}><ChevronLeftIcon size={15} />Voltar</button> : <span />}
            {acao && <button type="button" className="ct-btn ct-btn-dark" disabled={acao.disabled} onClick={acao.onClick}>{acao.label}</button>}
          </footer>
        )}
      </div>
    </div>
  );
}
