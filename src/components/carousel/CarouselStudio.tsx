"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { uploadMedia } from "@/components/content/upload";
import { isDarkHex } from "@/components/brand/SlidePreview";
import { ChevronLeftIcon, ChevronRightIcon, TrashIcon } from "@/components/Icons";
import {
  BG_ROLES, BOX_KINDS, cleanBox, COLOR_ROLES, roleColor, SLIDE_H, SLIDE_KINDS, SLIDE_W,
  type BoxAlign, type BoxKind, type BrandKit, type CarouselTemplate, type ColorRole, type SlideKind, type TemplateBox,
} from "@/lib/brand";
import { blankSlide, docFromSlides, fitSize, highlightParts, MAX_SLIDES, parseSlides, words, type CarouselDoc, type EditSlide } from "@/lib/carousel";
import type { BuildResult } from "@/app/cliente/[slug]/carrossel/actions";

/** Mesma fonte do JPG: a do kit, ou Inter (que vem embutida na montagem). */
const fontStack = (k: BrandKit, w: "titulo" | "texto") => { const f = k.fonts[w]?.family; return f ? `"${f.replace(/"/g, "")}", Inter, system-ui, sans-serif` : "Inter, system-ui, sans-serif"; };
const fileUrl = (p: string) => `/api/media?p=${encodeURIComponent(p)}`;
const driveThumb = (id: string, w = 400) => `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${w}`;
const imgUrl = (ref: string, w = 400) => (ref.startsWith("content-media/") ? fileUrl(ref) : driveThumb(ref, w));
const safe = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").toLowerCase();
const r1 = (v: number) => Math.round(v * 2) / 2;
const KIND_LABEL = Object.fromEntries(BOX_KINDS.map((b) => [b.key, b.label])) as Record<BoxKind, string>;
const SLIDE_LABEL = Object.fromEntries(SLIDE_KINDS.map((k) => [k.key, k.label])) as Record<SlideKind, string>;
const ROLE_LABEL = Object.fromEntries(COLOR_ROLES.map((r) => [r.key, r.label])) as Record<ColorRole, string>;

type Write = (slug: string, templateId: string, tema: string) => Promise<BuildResult & { text?: string; caption?: string }>;
type Preview = (slug: string, json: string) => Promise<BuildResult>;
type Save = (slug: string, json: string, opts: { postId?: string; caption: string; date: string; time: string }) => Promise<BuildResult>;

/** Slide com o conteúdo de verdade, em HTML (mesma composição do JPG; o JPG final sai pelo botão Conferir). */
function SlideView({ s, i, total, kit, logos }: { s: EditSlide; i: number; total: number; kit: BrandKit; logos: { principal?: string; claro?: string; escuro?: string } }) {
  const bg = s.layout.bg;
  const bgHex = bg.type === "cor" ? roleColor(kit, bg.role).hex : "#1a1a1a";
  return (
    <div className="sp-slide" style={{ background: bgHex }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {bg.type === "imagem" && <img src={fileUrl(bg.path)} alt="" className="sp-bg" draggable={false} />}
      {s.layout.boxes.map((b) => {
        const pos = { left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` };
        if (b.kind === "imagem") {
          const ref = s.images[b.id];
          return (
            <div key={b.id} className="sp-box sp-imagem" style={pos}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {ref ? <img src={imgUrl(ref, 800)} alt="" className="sp-photo" draggable={false} /> : <span className="sp-ph">Sem foto</span>}
            </div>
          );
        }
        if (b.kind === "logo") {
          const url = (isDarkHex(bgHex) ? logos.escuro : logos.claro) ?? logos.principal;
          return (
            <div key={b.id} className="sp-box sp-logo" style={pos}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {url ? <img src={url} alt="" className="sp-logo" draggable={false} /> : null}
            </div>
          );
        }
        const raw = b.fixo !== undefined ? b.fixo.trim() : b.auto === "contador" ? `${i + 1}/${total}` : b.auto === "numero" ? String(i).padStart(2, "0") : (s.text[b.id] ?? "");
        const title = (b.font ?? (b.kind === "titulo" ? "titulo" : "texto")) === "titulo";
        const size = fitSize(raw || " ", b.size ?? 40, (b.w / 100) * SLIDE_W, (b.h / 100) * SLIDE_H, title);
        const color = roleColor(kit, b.color ?? "texto").hex;
        let accent = roleColor(kit, "destaque").hex;
        if (accent.toLowerCase() === bgHex.toLowerCase() || accent.toLowerCase() === color.toLowerCase()) accent = isDarkHex(bgHex) ? "#ffffff" : "#111111";
        return (
          <div key={b.id} className={`sp-box sp-${b.kind}`} style={pos}>
            <span className="sp-text" style={{ display: "block", color, fontFamily: fontStack(kit, title ? "titulo" : "texto"), fontWeight: title ? (kit.fonts.titulo?.weight ?? 700) : 400, fontSize: `${(size / SLIDE_W) * 100}cqw`, lineHeight: title ? 1.12 : 1.35, textAlign: b.align ?? "left", whiteSpace: "pre-line", opacity: b.opacity ? b.opacity / 100 : undefined, fontStyle: b.italic ? "italic" : undefined, textTransform: b.caps ? "uppercase" : undefined, letterSpacing: b.caps ? "0.2em" : undefined }}>
              {raw ? highlightParts(raw).map((p, k) => <span key={k} style={p.accent ? { color: accent } : undefined}>{p.text}</span>) : <span style={{ opacity: 0.35 }}>{KIND_LABEL[b.kind]}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

type Drag = { id: string; mode: "move" | "resize"; sx: number; sy: number; box: TemplateBox; cw: number; ch: number };

export function CarouselStudio(props: {
  slug: string;
  kit: BrandKit;
  templates: CarouselTemplate[];
  pool: string[];
  logos: { principal?: string; claro?: string; escuro?: string };
  local: boolean;
  claude: boolean;
  initialDoc?: CarouselDoc;
  initialText: string;
  initialCaption: string;
  postId?: string;
  defaultDate: string;
  defaultTime: string;
  write: Write;
  preview: Preview;
  save: Save;
}) {
  const { slug, kit, templates, pool, logos, local } = props;
  const [templateId, setTemplateId] = useState(props.initialDoc?.templateId ?? templates[0]?.id ?? "");
  const [tema, setTema] = useState("");
  const [text, setText] = useState(props.initialText);
  const [doc, setDoc] = useState<CarouselDoc | null>(props.initialDoc ?? null);
  const [cur, setCur] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [caption, setCaption] = useState(props.initialCaption);
  const [date, setDate] = useState(props.defaultDate);
  const [time, setTime] = useState(props.defaultTime);
  const [postId, setPostId] = useState(props.postId);
  const [res, setRes] = useState<BuildResult | null>(null);
  const [busy, setBusy] = useState("");
  const [dirty, setDirty] = useState(false);
  const [, start] = useTransition();
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const photoFile = useRef<HTMLInputElement>(null);
  const bgFile = useRef<HTMLInputElement>(null);

  const template = templates.find((t) => t.id === templateId);
  const parsed = useMemo(() => parseSlides(text), [text]);
  const slide = doc?.slides[cur];
  const box = slide?.layout.boxes.find((b) => b.id === sel) ?? null;

  const run = (k: string, fn: () => Promise<void>) => { setBusy(k); start(async () => { try { await fn(); } finally { setBusy(""); } }); };

  // ─── edição do documento ─────────────────────────
  function patchSlide(fn: (s: EditSlide) => EditSlide) {
    setDoc((d) => (d ? { ...d, slides: d.slides.map((s, i) => (i === cur ? fn(s) : s)) } : d));
    setDirty(true);
  }
  const patchBox = (id: string, p: Partial<TemplateBox>) => patchSlide((s) => ({ ...s, layout: { ...s.layout, boxes: s.layout.boxes.map((b) => (b.id === id ? cleanBox({ ...b, ...p }) ?? b : b)) } }));
  const setBoxText = (id: string, v: string) => patchSlide((s) => ({ ...s, text: { ...s.text, [id]: v } }));
  const setBoxImage = (id: string, ref: string | null) => patchSlide((s) => {
    const images = { ...s.images };
    if (ref) images[id] = ref; else delete images[id];
    return { ...s, images };
  });
  function addBox(k: BoxKind) {
    const nb = cleanBox(k === "logo" ? { kind: k, x: 40, y: 88, w: 20, h: 5 } : k === "imagem" ? { kind: k, x: 20, y: 20, w: 60, h: 40 } : { kind: k, x: 8, y: 40, w: 84, h: k === "titulo" ? 14 : 20 })!;
    patchSlide((s) => ({ ...s, layout: { ...s.layout, boxes: [...s.layout.boxes, nb] } }));
    setSel(nb.id);
  }
  function removeBox(id: string) {
    patchSlide((s) => {
      const text = { ...s.text }, images = { ...s.images };
      delete text[id]; delete images[id];
      return { ...s, text, images, layout: { ...s.layout, boxes: s.layout.boxes.filter((b) => b.id !== id) } };
    });
    setSel(null);
  }
  function moveSlide(dir: -1 | 1) {
    if (!doc) return;
    const j = cur + dir;
    if (j < 0 || j >= doc.slides.length) return;
    const slides = [...doc.slides];
    [slides[cur], slides[j]] = [slides[j], slides[cur]];
    setDoc({ ...doc, slides });
    setCur(j);
    setDirty(true);
  }
  function addSlide(kind: SlideKind) {
    if (!doc || !template || doc.slides.length >= MAX_SLIDES) return;
    const slides = [...doc.slides];
    slides.splice(cur + 1, 0, blankSlide(template, kind));
    setDoc({ ...doc, slides });
    setCur(cur + 1);
    setSel(null);
    setDirty(true);
  }
  function removeSlide() {
    if (!doc || doc.slides.length <= 2 || !window.confirm(`Tirar o slide ${cur + 1}?`)) return;
    setDoc({ ...doc, slides: doc.slides.filter((_, i) => i !== cur) });
    setCur(Math.max(0, cur - 1));
    setSel(null);
    setDirty(true);
  }

  // ─── arrastar e redimensionar ─────────────────────
  function onPointerDown(e: React.PointerEvent, b: TemplateBox, mode: Drag["mode"]) {
    e.stopPropagation();
    e.preventDefault();
    setSel(b.id);
    const r = canvas.current?.getBoundingClientRect();
    if (!r) return;
    drag.current = { id: b.id, mode, sx: e.clientX, sy: e.clientY, box: b, cw: r.width, ch: r.height };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = ((e.clientX - d.sx) / d.cw) * 100, dy = ((e.clientY - d.sy) / d.ch) * 100;
    if (d.mode === "move") patchBox(d.id, { x: r1(Math.min(100 - d.box.w, Math.max(0, d.box.x + dx))), y: r1(Math.min(100 - d.box.h, Math.max(0, d.box.y + dy))) });
    else patchBox(d.id, { w: r1(Math.min(100 - d.box.x, Math.max(3, d.box.w + dx))), h: r1(Math.min(100 - d.box.y, Math.max(3, d.box.h + dy))) });
  }
  const onPointerUp = () => { drag.current = null; };
  function onKey(e: React.KeyboardEvent) {
    if (!box || (e.target as HTMLElement).closest("input,select,textarea")) return;
    const step = e.shiftKey ? 2 : 0.5;
    const mv: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (mv[e.key]) { e.preventDefault(); patchBox(box.id, { x: box.x + mv[e.key][0], y: box.y + mv[e.key][1] }); }
  }

  // ─── envios ───────────────────────────────────────
  async function onPhoto(f: File | undefined) {
    if (!f || !box) return;
    if (!/^image\/(png|jpeg)$/.test(f.type)) { setRes({ ok: false, message: "Envie a foto em JPG ou PNG." }); return; }
    setBusy("foto");
    try {
      const path = await uploadMedia(`content-media/${slug}/brand/foto-${safe(f.name)}`, f, local);
      setBoxImage(box.id, path);
    } catch (e) {
      setRes({ ok: false, message: e instanceof Error ? e.message : "Falha no envio." });
    } finally {
      setBusy("");
      if (photoFile.current) photoFile.current.value = "";
    }
  }
  async function onBg(f: File | undefined) {
    if (!f) return;
    if (!/^image\/(png|jpeg)$/.test(f.type)) { setRes({ ok: false, message: "Envie o fundo em JPG ou PNG (1080 × 1350)." }); return; }
    setBusy("fundo");
    try {
      const path = await uploadMedia(`content-media/${slug}/brand/fundo-${safe(f.name)}`, f, local);
      patchSlide((s) => ({ ...s, layout: { ...s.layout, bg: { type: "imagem", path } } }));
    } catch (e) {
      setRes({ ok: false, message: e instanceof Error ? e.message : "Falha no envio." });
    } finally {
      setBusy("");
      if (bgFile.current) bgFile.current.value = "";
    }
  }

  // ─── passo 1: texto ──────────────────────────────
  if (!doc) {
    return (
      <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 items-start">
        <div className="flex flex-col gap-4">
          <section className="card p-5 flex flex-col gap-3">
            <span className="label">1. Modelo</span>
            <div className="flex flex-wrap gap-2">
              {templates.map((t) => <button key={t.id} type="button" onClick={() => setTemplateId(t.id)} className={`ct-btn ${t.id === templateId ? "ct-btn-dark" : ""}`}>{t.name}</button>)}
            </div>
          </section>
          <section className="card p-5 flex flex-col gap-3">
            <span className="label">2. Texto: escreva ou peça ao Claude</span>
            <textarea value={tema} onChange={(e) => setTema(e.target.value)} rows={3} placeholder="Tema, tese ou o roteiro de um Reels para virar carrossel." className="ct-input" />
            <div className="flex items-center gap-2">
              <button type="button" className="ct-btn" disabled={!props.claude || !!busy || !tema.trim() || !templateId} onClick={() => run("write", async () => {
                const r = await props.write(slug, templateId, tema);
                setRes(r);
                if (r.ok && r.text) { setText(r.text); if (r.caption) setCaption(r.caption); }
              })}>{busy === "write" ? "Escrevendo…" : "Escrever com o Claude"}</button>
              {!props.claude && <span className="text-xs text-[var(--muted)]">A chave da API do Claude não está configurada no painel: escreva os slides abaixo.</span>}
            </div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={16} className="ct-input mono text-[13px]" placeholder={"# Título da capa com *destaque*\nTexto de apoio.\n---\n# Segundo slide\nTexto.\n[foto]\n---\n# Comenta PALAVRA\nO que a pessoa recebe."} />
            <p className="text-xs text-[var(--muted)]">Um slide por bloco, separados por uma linha ---. # marca o título; *asteriscos* marcam o destaque; [foto] usa o tipo de slide com foto. O primeiro é a capa e o último é o final.</p>
          </section>
          <section className="card p-5 flex flex-col gap-3">
            <span className="label">Legenda</span>
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={5} className="ct-input" />
          </section>
        </div>
        <div className="flex flex-col gap-4 xl:sticky xl:top-4">
          <section className="card p-5 flex flex-col gap-3">
            <span className="label">3. Abrir no editor</span>
            <ol className="flex flex-col gap-1 text-sm">
              {parsed.map((s, i) => <li key={i} className="flex gap-2"><span className="text-[var(--muted)] w-5">{i + 1}.</span><span className="flex-1 truncate">{s.title.replace(/\*/g, "") || "(sem título)"}</span><span className="text-xs text-[var(--muted)]">{SLIDE_LABEL[s.kind]} · {words(s.title) + words(s.body)} pal.</span></li>)}
              {parsed.length === 0 && <li className="text-[var(--muted)]">Nenhum slide ainda.</li>}
            </ol>
            <button type="button" className="ct-btn ct-btn-dark self-start" disabled={!template || parsed.length < 2} onClick={() => { setDoc(docFromSlides(template!, parsed, pool)); setCur(0); setSel(null); setDirty(true); setRes(null); }}>Abrir no editor</button>
            {res && <p className={`text-sm ${res.ok ? "g-good" : "g-bad"}`}>{res.message}</p>}
            <p className="text-xs text-[var(--muted)]">No editor você troca textos e fotos, muda tamanho de letra, move e redimensiona elementos e adiciona ou tira slides.</p>
          </section>
        </div>
      </div>
    );
  }

  // ─── passo 2: editor ─────────────────────────────
  const s = slide!;
  const textBox = box && (box.kind === "titulo" || box.kind === "texto") && !box.auto && box.fixo === undefined;

  return (
    <div className="te" onKeyDown={onKey} style={{ borderTop: 0, paddingTop: 0 }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="pill">{doc.templateName}</span>
          <span className="text-[var(--muted)]">{doc.slides.length} slides</span>
          {dirty && <span className="text-xs g-warn">Alterações não salvas</span>}
        </div>
        {!postId && <button type="button" className="ct-btn ct-btn-ghost" onClick={() => { if (!dirty || window.confirm("Voltar ao texto descarta as edições feitas no editor. Continuar?")) { setDoc(null); setDirty(false); } }}>Voltar ao texto</button>}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {doc.slides.map((x, i) => (
          <button key={x.id} type="button" className={`te-thumb shrink-0 ${i === cur ? "is-on" : ""}`} style={{ width: 104 }} onClick={() => { setCur(i); setSel(null); }}>
            <SlideView s={x} i={i} total={doc.slides.length} kit={kit} logos={logos} />
            <span>{i + 1}. {SLIDE_LABEL[x.kind]}</span>
          </button>
        ))}
      </div>

      <div className="te-body">
        <div className="te-stage">
          <div ref={canvas} className="te-canvas" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onPointerDown={() => setSel(null)} tabIndex={0} aria-label={`Slide ${cur + 1}`}>
            <SlideView s={s} i={cur} total={doc.slides.length} kit={kit} logos={logos} />
            <div className="te-overlay">
              {s.layout.boxes.map((b) => (
                <div key={b.id} className={`te-handle ${sel === b.id ? "is-sel" : ""}`} style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` }}
                  onPointerDown={(e) => onPointerDown(e, b, "move")} title={`${KIND_LABEL[b.kind]}: clique para editar, arraste para mover`}>
                  <span className="te-tag">{b.fixo !== undefined ? b.fixo.trim() : b.auto === "contador" ? "Contador" : b.auto === "numero" ? "Número" : KIND_LABEL[b.kind]}</span>
                  <span className="te-resize" onPointerDown={(e) => onPointerDown(e, b, "resize")} title="Arraste para redimensionar" />
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button type="button" className="ct-icon-btn" disabled={cur === 0} onClick={() => moveSlide(-1)} title="Mover para a esquerda" aria-label="Mover slide para a esquerda"><ChevronLeftIcon /></button>
            <button type="button" className="ct-icon-btn" disabled={cur === doc.slides.length - 1} onClick={() => moveSlide(1)} title="Mover para a direita" aria-label="Mover slide para a direita"><ChevronRightIcon /></button>
            <select className="ct-input" value="" onChange={(e) => { if (e.target.value) addSlide(e.target.value as SlideKind); }} disabled={doc.slides.length >= MAX_SLIDES} aria-label="Adicionar slide">
              <option value="">Adicionar slide depois deste…</option>
              {SLIDE_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
            <button type="button" className="ct-btn ct-btn-ghost" disabled={doc.slides.length <= 2} onClick={removeSlide}>Tirar slide</button>
          </div>
          <p className="text-xs text-[var(--muted)] mt-2">Clique num elemento para editar. Arraste para mover, puxe o canto para redimensionar; as setas do teclado ajustam fino.</p>
        </div>

        <div className="te-panel">
          {!box && (
            <section>
              <p className="label mb-1">Slide {cur + 1} · {SLIDE_LABEL[s.kind]}</p>
              <p className="text-sm text-[var(--muted)]">Clique num título, texto ou foto no slide para editar.</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {s.layout.boxes.map((b) => <button key={b.id} type="button" className="te-chip" onClick={() => setSel(b.id)}>{b.fixo !== undefined ? b.fixo.trim() : b.auto === "contador" ? "Contador" : b.auto === "numero" ? "Número" : KIND_LABEL[b.kind]}{b.kind !== "imagem" && b.kind !== "logo" && s.text[b.id] ? `: ${s.text[b.id].replace(/\*/g, "").slice(0, 18)}…` : ""}</button>)}
              </div>
            </section>
          )}

          {box && (
            <section className="te-props">
              <div className="flex items-center justify-between">
                <p className="label">{box.fixo !== undefined ? "Texto fixo do modelo" : box.auto === "contador" ? "Contador" : box.auto === "numero" ? "Número do passo" : KIND_LABEL[box.kind]}</p>
                <div className="flex gap-1">
                  <button type="button" className="ct-btn ct-btn-ghost" onClick={() => setSel(null)}>Pronto</button>
                  <button type="button" className="ct-icon-btn" onClick={() => removeBox(box.id)} title="Tirar do slide" aria-label="Tirar do slide"><TrashIcon /></button>
                </div>
              </div>
              {textBox && (
                <>
                  <textarea className="ct-input" rows={box.kind === "titulo" ? 3 : 5} value={s.text[box.id] ?? ""} onChange={(e) => setBoxText(box.id, e.target.value)} placeholder={box.kind === "titulo" ? "Título (use *asteriscos* para o destaque)" : "Texto"} autoFocus />
                  <p className="text-xs text-[var(--muted)]">{words(s.text[box.id] ?? "")} de {box.maxWords} palavras. *Asteriscos* deixam a palavra na cor de destaque.</p>
                </>
              )}
              {(box.kind === "titulo" || box.kind === "texto") && (
                <>
                  <div className="flex flex-col gap-1"><span className="te-l">Tamanho da letra</span>
                    <div className="flex items-center gap-2">
                      <button type="button" className="ct-btn" onClick={() => patchBox(box.id, { size: (box.size ?? 40) - 4 })} aria-label="Diminuir letra">A−</button>
                      <input type="range" min={16} max={240} value={box.size ?? 40} onChange={(e) => patchBox(box.id, { size: Number(e.target.value) })} className="flex-1" aria-label="Tamanho da letra" />
                      <button type="button" className="ct-btn" onClick={() => patchBox(box.id, { size: (box.size ?? 40) + 4 })} aria-label="Aumentar letra">A+</button>
                      <span className="mono text-xs w-12 text-right">{box.size}px</span>
                    </div>
                    <span className="text-xs text-[var(--muted)]">É o tamanho máximo: se o texto não couber na caixa, a letra diminui sozinha. Aumente a caixa para a letra crescer.</span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <div className="flex flex-col gap-1"><span className="te-l">Alinhamento</span>
                      <div className="te-seg te-seg-sm">
                        {(["left", "center", "right"] as BoxAlign[]).map((a) => <button key={a} type="button" className={box.align === a ? "is-on" : ""} onClick={() => patchBox(box.id, { align: a })}>{{ left: "Esquerda", center: "Centro", right: "Direita" }[a]}</button>)}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1"><span className="te-l">Cor</span>
                      <div className="flex flex-wrap gap-1.5">
                        {COLOR_ROLES.map((r) => <button key={r.key} type="button" className={`te-chip ${box.color === r.key ? "is-on" : ""}`} onClick={() => patchBox(box.id, { color: r.key })}><span className="te-sw" style={{ background: roleColor(kit, r.key).hex }} />{r.label}</button>)}
                      </div>
                    </div>
                  </div>
                </>
              )}
              {box.kind === "imagem" && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="ct-btn" disabled={busy === "foto"} onClick={() => photoFile.current?.click()}>{busy === "foto" ? "Enviando…" : s.images[box.id] ? "Trocar por foto do computador" : "Enviar foto do computador"}</button>
                    {s.images[box.id] && <button type="button" className="ct-btn ct-btn-ghost" onClick={() => setBoxImage(box.id, null)}>Tirar foto</button>}
                    <input ref={photoFile} type="file" accept="image/jpeg,image/png" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
                  </div>
                  <span className="te-l">Fotos da pasta do kit</span>
                  {pool.length ? (
                    <div className="grid grid-cols-4 gap-1.5 max-h-64 overflow-y-auto">
                      {pool.map((id) => (
                        <button key={id} type="button" onClick={() => setBoxImage(box.id, id)} className={`rounded-md overflow-hidden ${s.images[box.id] === id ? "ring-2 ring-[#0a84ff]" : ""}`} title="Usar esta foto">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={driveThumb(id, 200)} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  ) : <p className="text-xs text-[var(--muted)]">O kit não tem pasta de fotos. <Link href={`/cliente/${slug}/marca`} className="underline">Cadastrar no Kit de marca</Link>.</p>}
                </>
              )}
              {box.kind === "logo" && <p className="text-xs text-[var(--muted)]">O logo vem do kit; a versão clara ou escura é escolhida pela cor do fundo.</p>}
            </section>
          )}

          <section>
            <p className="label mb-2">Elementos do slide</p>
            <div className="flex flex-wrap gap-1.5">
              {BOX_KINDS.map((k) => <button key={k.key} type="button" className="ct-btn te-add" disabled={s.layout.boxes.length >= 12} onClick={() => addBox(k.key)}>+ {k.label}</button>)}
            </div>
          </section>

          <section>
            <p className="label mb-2">Fundo deste slide</p>
            <div className="flex flex-wrap gap-2 items-center">
              {BG_ROLES.map((role) => (
                <button key={role} type="button" className={`te-chip ${s.layout.bg.type === "cor" && s.layout.bg.role === role ? "is-on" : ""}`} onClick={() => patchSlide((x) => ({ ...x, layout: { ...x.layout, bg: { type: "cor", role } } }))}>
                  <span className="te-sw" style={{ background: roleColor(kit, role).hex }} />{ROLE_LABEL[role]}
                </button>
              ))}
              <button type="button" className={`te-chip ${s.layout.bg.type === "imagem" ? "is-on" : ""}`} disabled={busy === "fundo"} onClick={() => bgFile.current?.click()}>{busy === "fundo" ? "Enviando…" : s.layout.bg.type === "imagem" ? "Trocar imagem" : "Imagem"}</button>
              <input ref={bgFile} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => onBg(e.target.files?.[0])} />
            </div>
          </section>
        </div>
      </div>

      <section className="card p-5 flex flex-col gap-3">
        <div className="grid md:grid-cols-[1fr_auto] gap-4 items-start">
          <label className="flex flex-col gap-1"><span className="label">Legenda</span><textarea value={caption} onChange={(e) => { setCaption(e.target.value); setDirty(true); }} rows={4} className="ct-input" /></label>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="flex flex-col gap-1"><span className="label">Data</span><input type="date" value={date} onChange={(e) => { setDate(e.target.value); setDirty(true); }} className="ct-input" /></label>
            <label className="flex flex-col gap-1"><span className="label">Horário</span><input type="time" value={time} onChange={(e) => { setTime(e.target.value); setDirty(true); }} className="ct-input" /></label>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="ct-btn" disabled={!!busy} onClick={() => run("preview", async () => setRes(await props.preview(slug, JSON.stringify(doc))))}>{busy === "preview" ? "Montando…" : "Conferir JPGs"}</button>
          <button type="button" className="ct-btn ct-btn-dark" disabled={!!busy || doc.slides.length < 2} onClick={() => run("save", async () => {
            const r = await props.save(slug, JSON.stringify(doc), { postId, caption, date, time });
            setRes((prev) => ({ ...r, previews: prev?.previews }));
            if (r.ok && r.postId) { setPostId(r.postId); setDirty(false); }
          })}>{busy === "save" ? "Salvando…" : postId ? "Atualizar slides do post" : "Salvar no planejamento"}</button>
          {postId && <Link href={`/cliente/${slug}/conteudo`} className="ct-btn ct-btn-ghost">Abrir no Conteúdo</Link>}
        </div>
        {res && <p className={`text-sm ${res.ok ? "g-good" : "g-bad"}`}>{res.message}</p>}
        {!!res?.warnings?.length && <ul className="text-xs list-disc pl-5 flex flex-col gap-1">{res.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
        <p className="text-xs text-[var(--muted)]">Salvar cria o post como rascunho (ou troca os slides do post, se ele já existe). Se o cliente já tinha aprovado, ele volta para aprovação. Post publicado não muda.</p>
        {res?.previews && (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {res.previews.map((src, i) => <img key={i} src={src} alt={`Slide ${i + 1}`} className="w-full rounded-lg border border-[var(--line)]" />)}
          </div>
        )}
      </section>
    </div>
  );
}
