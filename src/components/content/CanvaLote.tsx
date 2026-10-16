"use client";

import JSZip from "jszip";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, CheckIcon, ChevronDownIcon, ChevronLeftIcon, DownloadIcon, LayersIcon, RefreshIcon, UploadIcon, XIcon } from "@/components/Icons";
import { agruparDesigns, IMG, type Lote } from "@/lib/canvaLote";
import type { Media } from "@/lib/content";
import { ESTILO_PADRAO, nomeArquivo, novasLaminas, type Estilo, type Lamina, type LaminasPost } from "@/lib/laminas";
import type { ActionResult } from "@/lib/types";
import { LaminaPreview } from "./LaminaPreview";
import { LaminasEditor } from "./LaminasEditor";
import { uploadMedia } from "./upload";

export interface CarrosselLinha {
  id: string;
  title: string;
  date: string;
  status: string;
  media: number;
  laminas?: LaminasPost;
}

interface Design { nome: string; paginas: { nome: string; blob: Blob }[]; capa: string }
type Passo = 1 | 2 | 3 | 4;
type Salvo = "salvando" | "salvo" | "erro";

const PASSOS: { n: Passo; nome: string }[] = [
  { n: 1, nome: "Escolher" },
  { n: 2, nome: "Lâminas" },
  { n: 3, nome: "No Canva" },
  { n: 4, nome: "Trazer de volta" },
];

const natural = (a: string, b: string) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });
const diaMes = (d: string) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "sem data");
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const erro = (e: unknown) => ({ ok: false, message: e instanceof Error ? e.message : String(e) });

function baixarArquivo(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

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

/** Abre um ZIP do Canva (com ZIPs dentro, se for o caso) e devolve os designs, cada um com as páginas em ordem. */
async function lerZip(file: File): Promise<Design[]> {
  const zip = await JSZip.loadAsync(file);
  const arquivos = new Map<string, JSZip.JSZipObject>();
  for (const e of Object.values(zip.files)) {
    if (e.dir) continue;
    if (/\.zip$/i.test(e.name)) {
      // Download de vários designs: um ZIP por design, cada um vira uma pasta com o nome do design.
      const pasta = e.name.replace(/\.zip$/i, "");
      const dentro = await JSZip.loadAsync(await e.async("blob"));
      for (const x of Object.values(dentro.files)) if (!x.dir && IMG.test(x.name)) arquivos.set(`${pasta}/${x.name.split("/").pop()}`, x);
    } else if (IMG.test(e.name)) arquivos.set(e.name, e);
  }
  const grupos = agruparDesigns([...arquivos.keys()]);
  // Um design só, com as páginas soltas: o nome é o do próprio ZIP (o Canva usa o nome do design, ex.: "01 Título").
  const soltos = [...arquivos.keys()].every((n) => !n.includes("/"));
  const out: Design[] = [];
  for (const g of grupos) {
    const paginas = await Promise.all(g.arquivos.map(async (n) => ({ nome: n.split("/").pop() ?? n, blob: await arquivos.get(n)!.async("blob") })));
    out.push({ nome: grupos.length === 1 && soltos ? file.name.replace(/\.zip$/i, "") : g.nome, paginas, capa: URL.createObjectURL(paginas[0].blob) });
  }
  return out;
}

/**
 * Carrosséis no Canva, num passo a passo: escolher os carrosséis e o modelo, montar as lâminas (o Claude
 * escreve, a equipe ajusta textos e fotos), baixar os arquivos que abrem editáveis no Canva e, na volta,
 * anexar a cada post as lâminas dos ZIPs baixados do Canva.
 */
export function CanvaLote({ slug, local, estilos, carrosseis, lotes, temPasta, kitHref, escrever, salvar, fotosDaPasta, criarLote, anexar }: {
  slug: string;
  local: boolean;
  estilos: Estilo[];
  carrosseis: CarrosselLinha[];
  lotes: Lote[];
  temPasta: boolean;
  kitHref: string;
  escrever: (postId: string, estiloId: string) => Promise<ActionResult & { laminas?: LaminasPost }>;
  salvar: (postId: string, estiloId: string, itens: Lamina[]) => Promise<ActionResult & { laminas?: LaminasPost }>;
  fotosDaPasta: () => Promise<ActionResult & { fotos?: Media[] }>;
  criarLote: (estiloTitulo: string, postIds: string[]) => Promise<ActionResult & { lote?: Lote }>;
  anexar: (postId: string, media: Media[]) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const lista = estilos.length ? estilos : [ESTILO_PADRAO];
  const [open, setOpen] = useState(false);
  const [passo, setPasso] = useState<Passo>(1);
  const [estiloId, setEstiloId] = useState(() => carrosseis.find((c) => c.laminas)?.laminas?.estiloId ?? lista[0].id);
  const [sel, setSel] = useState<string[]>(() => carrosseis.filter((c) => c.media === 0 && c.status !== "agendado").map((c) => c.id));
  const [laminas, setLaminas] = useState<Record<string, Lamina[]>>(() => Object.fromEntries(carrosseis.filter((c) => c.laminas).map((c) => [c.id, c.laminas!.itens])));
  const [salvo, setSalvo] = useState<Record<string, Salvo>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<{ n: number; total: number } | null>(null);
  const [msg, setMsg] = useState<ActionResult | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [fotos, setFotos] = useState<Media[] | null>(null);
  const [baixado, setBaixado] = useState(false);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [destino, setDestino] = useState<string[]>([]);
  const [loteNovo, setLoteNovo] = useState<Lote | null>(null);
  const [loteId, setLoteId] = useState(lotes[0]?.id ?? "");
  const [arrastando, setArrastando] = useState(false);
  const [feito, setFeito] = useState<string | null>(null);
  const zipInput = useRef<HTMLInputElement>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const estilo = lista.find((e) => e.id === estiloId) ?? lista[0];
  const escolhidos = carrosseis.filter((c) => sel.includes(c.id));
  const faltam = escolhidos.filter((c) => !laminas[c.id]);
  const todosLotes = loteNovo && !lotes.some((l) => l.id === loteNovo.id) ? [loteNovo, ...lotes] : lotes;
  const lote = todosLotes.find((l) => l.id === loteId);
  const recente = lotes[0] && Date.now() - new Date(lotes[0].at).getTime() < 7 * 864e5 ? lotes[0] : undefined;
  const porId = new Map(carrosseis.map((c) => [c.id, c]));
  const salvando = Object.values(salvo).includes("salvando");
  const podeIr = (p: Passo) => !busy && (p === 1 || p === 4 || (p === 2 && escolhidos.length > 0) || (p === 3 && escolhidos.length > 0 && faltam.length === 0));

  // Solta as miniaturas quando o ZIP muda ou o painel fecha.
  useEffect(() => () => designs.forEach((d) => URL.revokeObjectURL(d.capa)), [designs]);

  // Painel aberto: a página atrás não rola e Esc fecha.
  useEffect(() => {
    if (!open) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) fechar(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = antes; window.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, busy]);

  function fechar() {
    if (salvando) return;
    setOpen(false); setDesigns([]); setDestino([]); setMsg(null); setFeito(null);
    router.refresh();
  }
  function ir(p: Passo) {
    if (!podeIr(p)) return;
    setMsg(null); setFeito(null); setPasso(p);
    if (p === 2 && !aberto && escolhidos.length === 1) setAberto(escolhidos[0].id);
  }

  /** Mudança no editor: atualiza na hora e grava um instante depois de parar de digitar. */
  function mudarLaminas(postId: string, itens: Lamina[], imediato = false) {
    setLaminas((x) => ({ ...x, [postId]: itens }));
    clearTimeout(timers.current[postId]);
    setSalvo((x) => ({ ...x, [postId]: "salvando" }));
    timers.current[postId] = setTimeout(async () => {
      const r = await salvar(postId, estilo.id, itens).catch((e) => erro(e));
      setSalvo((x) => ({ ...x, [postId]: r.ok ? "salvo" : "erro" }));
      if (!r.ok) setMsg(r);
    }, imediato ? 0 : 900);
  }

  // Trocar o modelo grava o novo modelo nos carrosséis que já têm lâminas.
  function trocarEstilo(id: string) {
    setEstiloId(id);
    for (const c of escolhidos) if (laminas[c.id]) void salvar(c.id, id, laminas[c.id]);
  }

  async function escreverTodos(ids: string[]) {
    if (!ids.length) return;
    setMsg(null);
    let ok = 0;
    for (const [i, id] of ids.entries()) {
      const c = porId.get(id);
      setProgresso({ n: i, total: ids.length });
      setBusy(ids.length === 1 ? `O Claude está escrevendo: ${c?.title ?? ""}` : `O Claude está escrevendo ${i + 1} de ${ids.length}: ${c?.title ?? ""}`);
      const r = await escrever(id, estilo.id).catch((e) => erro(e) as ActionResult & { laminas?: LaminasPost });
      if (!r.ok || !r.laminas) { setMsg({ ok: false, message: `${c?.title ?? id}: ${r.message}` }); break; }
      setLaminas((t) => ({ ...t, [id]: r.laminas!.itens }));
      ok++;
    }
    setBusy(null); setProgresso(null);
    if (ok === ids.length) setAberto(ids[0]);
    if (ok === ids.length && ids.length > 1) setMsg({ ok: true, message: `${plural(ok, "carrossel pronto", "carrosséis prontos")}. Abra cada um para conferir textos e fotos.` });
  }

  async function baixarArquivos() {
    setMsg(null); setBaixado(false);
    const ids = escolhidos.map((c) => c.id);
    const l = await criarLote(estilo.titulo, ids).catch((e) => erro(e) as ActionResult & { lote?: Lote });
    if (!l.ok || !l.lote) { setMsg(l); return; }
    setLoteNovo(l.lote); setLoteId(l.lote.id);
    const arquivos: { nome: string; blob: Blob }[] = [];
    let semFoto = 0;
    try {
      for (const [i, id] of ids.entries()) {
        const c = porId.get(id);
        setProgresso({ n: i, total: ids.length });
        setBusy(`Montando ${i + 1} de ${ids.length}: ${c?.title ?? ""}`);
        const r = await fetch(`/api/content/laminas?slug=${encodeURIComponent(slug)}&post=${encodeURIComponent(id)}&n=${i + 1}`);
        if (!r.ok) throw new Error(`${c?.title ?? id}: ${(await r.text().catch(() => "")) || `erro ${r.status}`}`);
        semFoto += Number(r.headers.get("X-Fotos-Faltando") ?? 0);
        arquivos.push({ nome: `${nomeArquivo(i + 1, c?.title ?? "")}.pptx`, blob: await r.blob() });
      }
      if (arquivos.length === 1) baixarArquivo(arquivos[0].blob, arquivos[0].nome);
      else {
        setBusy("Juntando os arquivos…");
        const z = new JSZip();
        for (const a of arquivos) z.file(a.nome, a.blob);
        const dia = new Date().toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 10);
        baixarArquivo(await z.generateAsync({ type: "blob" }), `carrosseis-${slug}-${dia}.zip`);
      }
      setBaixado(true);
      if (semFoto) setMsg({ ok: false, message: `${plural(semFoto, "foto não abriu", "fotos não abriram")} (confira o compartilhamento no Drive). O resto do arquivo saiu normal.` });
    } catch (e) {
      setMsg(erro(e));
    } finally { setBusy(null); setProgresso(null); }
  }

  /** Lê os arquivos que voltaram do Canva (um ou vários ZIPs, ou as imagens soltas). */
  async function onArquivos(files: File[]) {
    setMsg(null); setFeito(null); setBusy("Abrindo os arquivos…");
    try {
      let ds: Design[] = [];
      const imgs = files.filter((f) => IMG.test(f.name)).sort((a, b) => natural(a.name, b.name));
      for (const f of files.filter((x) => /\.zip$/i.test(x.name))) ds.push(...(await lerZip(f)));
      if (imgs.length) ds.push({ nome: "Imagens", paginas: imgs.map((f) => ({ nome: f.name, blob: f })), capa: URL.createObjectURL(imgs[0]) });
      if (!ds.length) throw new Error("Não achei imagens. No Canva, baixe cada design em JPG: vem um arquivo .zip.");
      const ordem = lote?.postIds ?? escolhidos.map((c) => c.id);
      // Tudo num design só, com páginas de mais: divide em partes iguais, uma por carrossel do lote.
      if (ds.length === 1 && ordem.length > 1 && ds[0].paginas.length > 10 && ds[0].paginas.length % ordem.length === 0) {
        const unico = ds[0];
        const cada = unico.paginas.length / ordem.length;
        URL.revokeObjectURL(unico.capa);
        ds = ordem.map((_, i) => { const paginas = unico.paginas.slice(i * cada, (i + 1) * cada); return { nome: `${String(i + 1).padStart(2, "0")} Carrossel`, paginas, capa: URL.createObjectURL(paginas[0].blob) }; });
      }
      ds.sort((a, b) => natural(a.nome, b.nome));
      // O número no nome do design ("01 Título") diz o carrossel; sem número, vai na ordem.
      const usados = new Set<string>();
      const alvo = ds.map((d) => { const n = Number(d.nome.match(/^(\d{1,2})(?!\d)/)?.[1]); const id = n ? ordem[n - 1] : undefined; if (id && !usados.has(id)) { usados.add(id); return id; } return ""; });
      const livres = ordem.filter((id) => !usados.has(id));
      setDesigns(ds);
      setDestino(alvo.map((id) => id || livres.shift() || ""));
    } catch (e) {
      setMsg(erro(e));
    } finally { setBusy(null); }
  }

  async function anexarTodos() {
    setMsg(null);
    const usados = destino.filter(Boolean);
    if (new Set(usados).size !== usados.length) { setMsg({ ok: false, message: "Dois designs estão indo para o mesmo carrossel. Confira a lista de cada um." }); return; }
    const grande = designs.find((d, i) => destino[i] && d.paginas.length > 10);
    if (grande) { setMsg({ ok: false, message: `${grande.nome} tem ${grande.paginas.length} páginas. O Instagram aceita até 10.` }); return; }
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

  async function carregarFotos(): Promise<string | null> {
    const r = await fotosDaPasta().catch((e) => erro(e) as ActionResult & { fotos?: Media[] });
    if (!r.ok || !r.fotos) { setFotos([]); return r.message; }
    setFotos(r.fotos);
    return null;
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
  if (passo === 2) { voltar = 1; acao = faltam.length ? { label: <>Escrever {faltam.length === 1 ? "as lâminas" : `as lâminas dos ${faltam.length}`} com o Claude</>, onClick: () => escreverTodos(faltam.map((c) => c.id)), disabled: !!busy } : { label: <>Continuar<ArrowRightIcon size={15} /></>, onClick: () => ir(3), disabled: !podeIr(3) || salvando }; }
  if (passo === 3) { voltar = 2; acao = { label: <>Já baixei os ZIPs do Canva<ArrowRightIcon size={15} /></>, onClick: () => ir(4) }; }
  if (passo === 4 && !feito) { voltar = 3; acao = designs.length ? { label: <>Anexar {destino.filter(Boolean).length === 1 ? "ao carrossel" : `aos ${destino.filter(Boolean).length} carrosséis`}</>, onClick: anexarTodos, disabled: !!busy || !destino.some(Boolean) } : null; }

  return (
    <div className="fixed inset-0 z-50 bg-black/35 overflow-y-auto sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) fechar(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="canva-titulo" className="bg-[var(--card)] w-full sm:max-w-4xl sm:mx-auto min-h-full sm:min-h-0 sm:rounded-[18px] shadow-xl flex flex-col">
        <header className="px-5 pt-5 pb-4 border-b border-[var(--line)] flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="canva-titulo" className="text-lg font-semibold tracking-tight">Carrosséis no Canva</h2>
              <p className="text-sm text-[var(--muted)]">As lâminas saem montadas daqui e abrem editáveis no Canva.</p>
            </div>
            <button type="button" className="ct-icon-btn" aria-label="Fechar" onClick={fechar} disabled={!!busy || salvando}><XIcon size={18} /></button>
          </div>
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
        </header>

        <div className="px-5 py-5 flex-1 flex flex-col gap-5">
          {passo === 1 ? (
            <>
              {recente && (
                <div className="rounded-xl bg-[#f5f5f7] p-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm">Voltou do Canva? O último lote foi de {quando(recente.at)} ({plural(recente.postIds.length, "carrossel", "carrosséis")}).</p>
                  <button type="button" className="ct-btn" onClick={() => { setLoteId(recente.id); ir(4); }}>Trazer as lâminas</button>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium">Qual modelo?</p>
                  <a href={kitHref} className="text-sm text-[var(--muted)] underline">Editar modelos</a>
                </div>
                {!estilos.length && <p className="text-sm text-[var(--muted)]">Este cliente ainda não tem modelo no kit de marca. Dá para seguir com o modelo padrão e ajustar no Canva.</p>}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {lista.map((e) => {
                    const exemplo = novasLaminas(3).map((l, j) => (j === 0 ? { ...l, titulo: e.titulo, subtitulo: "subtítulo" } : l));
                    return (
                      <button key={e.id} type="button" onClick={() => trocarEstilo(e.id)} aria-pressed={e.id === estilo.id}
                        className={`rounded-xl border p-2 flex flex-col gap-2 items-center text-left transition-colors ${e.id === estilo.id ? "border-[var(--ink)] ring-1 ring-[var(--ink)]" : "border-[var(--line)] hover:bg-[#fafaf8]"}`}>
                        <LaminaPreview itens={exemplo} i={0} estilo={e} largura={120} className="rounded-md" />
                        <span className="text-sm font-medium truncate w-full text-center">{e.titulo}</span>
                      </button>
                    );
                  })}
                </div>
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
                      const n = laminas[c.id]?.length;
                      return (
                        <li key={c.id}>
                          <label className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer ${on ? "bg-[#fafaf8]" : ""}`}>
                            <input type="checkbox" className="w-4 h-4 accent-[var(--accent)] shrink-0" checked={on} onChange={(e) => setSel((s) => (e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id)))} />
                            <span className="flex flex-col min-w-0 flex-1">
                              <span className="truncate text-sm font-medium">{c.title}</span>
                              <span className="text-xs text-[var(--muted)]">
                                {diaMes(c.date)}{n ? ` · ${plural(n, "lâmina montada", "lâminas montadas")}` : ""}{c.media ? ` · ${plural(c.media, "imagem anexada", "imagens anexadas")}` : ""}{c.status === "agendado" ? " · agendado" : ""}
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
              <p className="text-sm text-[var(--muted)]">O Claude escreve as lâminas a partir do roteiro de cada post. Depois é só abrir o carrossel para ajustar os textos, pôr fotos e somar ou tirar slides (até 10 lâminas). Tudo fica salvo sozinho.</p>
              <ul className="flex flex-col gap-2">
                {escolhidos.map((c) => {
                  const itens = laminas[c.id];
                  const exp = aberto === c.id && !!itens;
                  const st = salvo[c.id];
                  return (
                    <li key={c.id} className="rounded-xl border border-[var(--line)]">
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        {itens ? <LaminaPreview itens={itens} i={0} estilo={estilo} largura={40} className="rounded-[4px] ring-1 ring-[var(--line)]" /> : <span className="w-10 h-[50px] rounded-[4px] bg-[#f0efe9] shrink-0" />}
                        <button type="button" className="flex items-center gap-2 min-w-0 flex-1 text-left disabled:cursor-default" disabled={!itens} onClick={() => setAberto(exp ? null : c.id)} aria-expanded={exp}>
                          <span className="flex flex-col min-w-0">
                            <span className="truncate text-sm font-medium">{c.title}</span>
                            <span className="text-xs text-[var(--muted)]">{itens ? `${plural(itens.length, "lâmina", "lâminas")}${st === "salvando" ? " · salvando…" : st === "erro" ? " · não salvou" : ""}` : "Falta escrever"}</span>
                          </span>
                          {itens && <ChevronDownIcon size={15} className={`shrink-0 text-[var(--muted)] transition-transform ${exp ? "rotate-180" : ""}`} />}
                        </button>
                        {itens ? <span className="pill pill-green"><CheckIcon size={11} />Pronto</span> : <span className="pill">Falta</span>}
                        <button type="button" className="ct-icon-btn" disabled={!!busy} onClick={() => { if (!itens || window.confirm("Escrever de novo os textos deste carrossel? As fotos ficam.")) escreverTodos([c.id]); }} title={itens ? "Escrever de novo" : "Escrever"} aria-label={itens ? `Escrever de novo: ${c.title}` : `Escrever: ${c.title}`}><RefreshIcon size={15} /></button>
                      </div>
                      {exp && itens && (
                        <div className="border-t border-[var(--line)] p-3">
                          <LaminasEditor slug={slug} local={local} itens={itens} estilo={estilo} onChange={(x) => mudarLaminas(c.id, x)} fotos={fotos} carregarFotos={carregarFotos} temPasta={temPasta} desativado={!!busy} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {!faltam.length && <p className="text-sm g-good inline-flex items-center gap-1.5"><CheckIcon size={14} />Lâminas prontas. Confira cada carrossel e continue.</p>}
            </>
          ) : passo === 3 ? (
            <>
              <div className="rounded-xl border border-[var(--line)] p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <p className="font-medium">{escolhidos.length === 1 ? "Arquivo do carrossel" : `Arquivos dos ${escolhidos.length} carrosséis`}</p>
                  <p className="text-sm text-[var(--muted)]">{escolhidos.length === 1 ? "Um arquivo .pptx, já no modelo e com as fotos." : "Um ZIP com um arquivo .pptx por carrossel, numerados 01, 02…, já no modelo e com as fotos."}</p>
                </div>
                <div className="flex items-center gap-2">
                  {baixado && <span className="text-sm g-good inline-flex items-center gap-1"><CheckIcon size={14} />Baixado</span>}
                  <button type="button" className={`ct-btn ${baixado ? "" : "ct-btn-dark"}`} disabled={!!busy} onClick={baixarArquivos}><DownloadIcon size={16} />{baixado ? "Baixar de novo" : "Baixar para o Canva"}</button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <p className="font-medium">No Canva</p>
                <ol className="flex flex-col gap-2 text-sm">
                  {[
                    ...(escolhidos.length > 1 ? [<>Abra o ZIP baixado: dentro estão os arquivos .pptx.</>] : []),
                    <>Na página inicial do Canva, arraste os arquivos .pptx para a tela (ou use <b>Enviar</b>). Cada arquivo vira um design editável, com o mesmo nome.</>,
                    <>As fontes do modelo ({estilo.fontes.titulo} e {estilo.fontes.texto}) precisam estar no Brand Kit do Canva com esse nome. Se aparecer outra letra, é isso.</>,
                    <>Ajuste o que quiser no design: posição, tamanho, foto, cor.</>,
                    <>Em cada design: <b>Compartilhar</b>, <b>Baixar</b>, formato <b>JPG</b>, todas as páginas. Vem um ZIP com o nome do design (01, 02…).</>,
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
                    onDrop={(e) => { e.preventDefault(); setArrastando(false); const fs = [...(e.dataTransfer.files ?? [])]; if (fs.length) onArquivos(fs); }}
                    className={`rounded-2xl border-2 border-dashed px-6 py-10 flex flex-col items-center gap-2 text-center transition-colors ${arrastando ? "border-[var(--accent)] bg-[#eef5f1]" : "border-[var(--line)] hover:bg-[#fafaf8]"}`}>
                    <UploadIcon size={26} className="text-[var(--muted)]" />
                    <span className="font-medium">Arraste aqui os ZIPs do Canva</span>
                    <span className="text-sm text-[var(--muted)]">Pode soltar todos de uma vez, ou clicar para escolher</span>
                  </button>
                  <input ref={zipInput} type="file" hidden multiple accept=".zip,application/zip,image/jpeg,image/png" onChange={(e) => { const fs = [...(e.target.files ?? [])]; if (fs.length) onArquivos(fs); e.target.value = ""; }} />
                  {todosLotes.length > 1 && (
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="text-[var(--muted)]">Lote (para casar os números 01, 02…):</span>
                      <select className="ct-input" value={loteId} onChange={(e) => setLoteId(e.target.value)} disabled={!!busy}>
                        {todosLotes.map((l) => <option key={l.id} value={l.id}>{quando(l.at)} · {plural(l.postIds.length, "carrossel", "carrosséis")}{l.modeloTitulo ? ` · ${l.modeloTitulo}` : ""}</option>)}
                      </select>
                    </label>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-[var(--muted)]">Confira pela capa se cada design vai para o carrossel certo. Se precisar, troque na lista de cada um. As imagens atuais desses posts são substituídas.</p>
                  <ul className="flex flex-col gap-2">
                    {designs.map((d, i) => {
                      const muitas = d.paginas.length > 10;
                      const esperado = destino[i] ? laminas[destino[i]]?.length : undefined;
                      const difere = esperado && esperado !== d.paginas.length;
                      return (
                        <li key={`${d.nome}-${i}`} className="rounded-xl border border-[var(--line)] p-2.5 flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={d.capa} alt={`Capa de ${d.nome}`} className="w-14 aspect-[4/5] object-cover rounded-lg border border-[var(--line)] shrink-0" />
                          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                            <span className={`text-xs truncate ${muitas ? "g-bad" : difere ? "g-warn" : "text-[var(--muted)]"}`}>
                              {d.nome} · {plural(d.paginas.length, "página", "páginas")}{muitas ? " (o Instagram aceita até 10)" : difere ? ` (o carrossel tem ${esperado} lâminas)` : ""}
                            </span>
                            <select className="ct-input" value={destino[i] ?? ""} onChange={(e) => setDestino((x) => x.map((v, j) => (j === i ? e.target.value : v)))} aria-label={`Carrossel para o design ${i + 1}`}>
                              <option value="">Não usar este design</option>
                              {[...carrosseis].sort((a, b) => natural(a.date, b.date)).map((c) => <option key={c.id} value={c.id} disabled={c.status === "agendado"}>{diaMes(c.date)} · {c.title}{c.status === "agendado" ? " (agendado)" : ""}</option>)}
                            </select>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <div><button type="button" className="text-sm text-[var(--muted)] underline" disabled={!!busy} onClick={() => { setDesigns([]); setDestino([]); }}>Escolher outros arquivos</button></div>
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

        {(voltar || acao) && (
          <footer className="sticky bottom-0 bg-[var(--card)] border-t border-[var(--line)] px-5 py-3 flex items-center justify-between gap-2 sm:rounded-b-[18px]">
            {voltar ? <button type="button" className="ct-btn ct-btn-ghost" disabled={!!busy} onClick={() => ir(voltar!)}><ChevronLeftIcon size={15} />Voltar</button> : <span />}
            {acao && <button type="button" className="ct-btn ct-btn-dark" disabled={acao.disabled} onClick={acao.onClick}>{acao.label}</button>}
          </footer>
        )}
      </div>
    </div>
  );
}
