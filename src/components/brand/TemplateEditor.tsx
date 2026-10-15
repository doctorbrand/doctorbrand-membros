"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { uploadMedia } from "@/components/content/upload";
import { SlidePreview, type PreviewAssets } from "@/components/brand/SlidePreview";
import { TrashIcon } from "@/components/Icons";
import {
  BG_ROLES, BOX_KINDS, cleanBox, COLOR_ROLES, roleColor, SLIDE_H, SLIDE_KINDS, SLIDE_W,
  type BoxAlign, type BoxKind, type BrandKit, type CarouselTemplate, type ColorRole, type SlideKind, type TemplateBox,
} from "@/lib/brand";
import type { ActionResult } from "@/lib/types";

const fileUrl = (path: string) => `/api/media?p=${encodeURIComponent(path)}`;
const safe = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").toLowerCase();
const r1 = (v: number) => Math.round(v * 2) / 2;
const ROLE_LABEL = Object.fromEntries(COLOR_ROLES.map((r) => [r.key, r.label])) as Record<ColorRole, string>;
const KIND_LABEL = Object.fromEntries(BOX_KINDS.map((b) => [b.key, b.label])) as Record<BoxKind, string>;

const AlignIcon = ({ a }: { a: BoxAlign }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
    {a === "left" && <path d="M4 6h16M4 10.5h10M4 15h16M4 19.5h10" />}
    {a === "center" && <path d="M4 6h16M7 10.5h10M4 15h16M7 19.5h10" />}
    {a === "right" && <path d="M4 6h16M10 10.5h10M4 15h16M10 19.5h10" />}
  </svg>
);

type Drag = { id: string; mode: "move" | "resize"; sx: number; sy: number; box: TemplateBox; cw: number; ch: number };

export function TemplateEditor({ slug, kit, logos, photo, local, initial, isNew, save, remove, backHref }: {
  slug: string;
  kit: BrandKit;
  logos: PreviewAssets["logos"];
  photo?: string;
  local: boolean;
  initial: CarouselTemplate;
  isNew: boolean;
  save: (json: string) => Promise<ActionResult & { id?: string }>;
  remove?: () => Promise<ActionResult>;
  backHref: string;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [t, setT] = useState<CarouselTemplate>(initial);
  const [kind, setKind] = useState<SlideKind>("capa");
  const [sel, setSel] = useState<string | null>(initial.slides.capa.boxes[0]?.id ?? null);
  const [dirty, setDirty] = useState(isNew);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<ActionResult | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const assets: PreviewAssets = { logos, photo, fileUrl };

  const layout = t.slides[kind];
  const box = layout.boxes.find((b) => b.id === sel) ?? null;

  function patchSlide(fn: (boxes: TemplateBox[]) => TemplateBox[], bg?: CarouselTemplate["slides"][SlideKind]["bg"]) {
    setT((cur) => ({ ...cur, slides: { ...cur.slides, [kind]: { bg: bg ?? cur.slides[kind].bg, boxes: fn(cur.slides[kind].boxes) } } }));
    setDirty(true);
  }
  const patchBox = (id: string, p: Partial<TemplateBox>) => patchSlide((bs) => bs.map((b) => (b.id === id ? cleanBox({ ...b, ...p }) ?? b : b)));

  // Avisa antes de sair com alteração não salva.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    // Trocar de modelo pelos cartões (links dentro da página) também perderia as alterações.
    const c = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a[href]");
      if (a && !window.confirm("Há alterações não salvas neste modelo. Sair mesmo assim?")) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("beforeunload", h);
    document.addEventListener("click", c, true);
    return () => { window.removeEventListener("beforeunload", h); document.removeEventListener("click", c, true); };
  }, [dirty]);

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
    if (d.mode === "move") {
      patchBox(d.id, { x: r1(Math.min(100 - d.box.w, Math.max(0, d.box.x + dx))), y: r1(Math.min(100 - d.box.h, Math.max(0, d.box.y + dy))) });
    } else {
      patchBox(d.id, { w: r1(Math.min(100 - d.box.x, Math.max(3, d.box.w + dx))), h: r1(Math.min(100 - d.box.y, Math.max(3, d.box.h + dy))) });
    }
  }
  const onPointerUp = () => { drag.current = null; };

  function onKey(e: React.KeyboardEvent) {
    if (!box || (e.target as HTMLElement).closest("input,select,textarea")) return;
    const step = e.shiftKey ? 2 : 0.5;
    const mv: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (mv[e.key]) { e.preventDefault(); patchBox(box.id, { x: box.x + mv[e.key][0], y: box.y + mv[e.key][1] }); }
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeBox(box.id); }
  }

  function addBox(k: BoxKind) {
    const nb = cleanBox(k === "logo" ? { kind: k, x: 40, y: 88, w: 20, h: 5 } : k === "imagem" ? { kind: k, x: 20, y: 20, w: 60, h: 40 } : { kind: k, x: 8, y: 40, w: 84, h: k === "titulo" ? 14 : 20 })!;
    patchSlide((bs) => [...bs, nb]);
    setSel(nb.id);
  }
  function removeBox(id: string) {
    patchSlide((bs) => bs.filter((b) => b.id !== id));
    setSel(null);
  }

  async function onBgFile(f: File | undefined) {
    if (!f) return;
    setMsg(null);
    if (!/^image\/(png|jpeg)$/.test(f.type)) { setMsg({ ok: false, message: "Envie PNG ou JPG (exportado do Canva)." }); return; }
    const dims = await new Promise<{ w: number; h: number } | null>((res) => {
      const img = new Image();
      img.onload = () => { res({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(img.src); };
      img.onerror = () => res(null);
      img.src = URL.createObjectURL(f);
    });
    if (!dims) { setMsg({ ok: false, message: "Não consegui ler a imagem." }); return; }
    if (Math.abs(dims.w / dims.h - SLIDE_W / SLIDE_H) > 0.01) { setMsg({ ok: false, message: `A imagem tem ${dims.w} × ${dims.h}. O fundo precisa ser 4:5 (1080 × 1350).` }); return; }
    setBusy(true);
    try {
      const path = await uploadMedia(`content-media/${slug}/brand/modelo-${t.id}-${kind}-${safe(f.name)}`, f, local);
      patchSlide((bs) => bs, { type: "imagem", path, name: f.name });
      setMsg({ ok: true, message: dims.w === SLIDE_W ? "Fundo enviado. Salve o modelo para guardar." : `Fundo enviado (${dims.w} × ${dims.h}, proporção certa). Salve o modelo para guardar.` });
    } catch (e) {
      setMsg({ ok: false, message: e instanceof Error ? e.message : "Falha no envio." });
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }

  async function onSave() {
    setBusy(true);
    setMsg(null);
    const r = await save(JSON.stringify(t)).catch((e) => ({ ok: false, message: e instanceof Error ? e.message : "Falhou." }) as ActionResult);
    setBusy(false);
    setMsg(r);
    if (r.ok) {
      setDirty(false);
      start(() => { if (isNew) router.replace(`?modelo=${t.id}#modelos`, { scroll: false }); else router.refresh(); });
    }
  }
  async function onRemove() {
    if (!remove || !window.confirm(`Apagar o modelo "${t.name}"? Isso não pode ser desfeito.`)) return;
    setBusy(true);
    const r = await remove().catch((e) => ({ ok: false, message: e instanceof Error ? e.message : "Falhou." }));
    setBusy(false);
    if (r.ok) { setDirty(false); start(() => router.replace(backHref, { scroll: false })); } else setMsg(r);
  }

  const textBox = box && (box.kind === "titulo" || box.kind === "texto");
  const missing = COLOR_ROLES.filter((r) => roleColor(kit, r.key).missing).map((r) => r.label.toLowerCase());

  return (
    <div className="te" onKeyDown={onKey}>
      <div className="te-top">
        <label className="flex flex-col gap-1 flex-1 min-w-[220px]">
          <span className="label">Nome do modelo</span>
          <input value={t.name} maxLength={40} onChange={(e) => { setT({ ...t, name: e.target.value }); setDirty(true); }} placeholder="ex.: Editorial escuro" className="ct-input" />
        </label>
        <div className="te-seg" role="tablist" aria-label="Tipo de slide">
          {SLIDE_KINDS.map((s) => (
            <button key={s.key} type="button" role="tab" aria-selected={kind === s.key} className={kind === s.key ? "is-on" : ""} onClick={() => { setKind(s.key); setSel(t.slides[s.key].boxes[0]?.id ?? null); }} title={s.hint}>{s.label}</button>
          ))}
        </div>
      </div>

      <div className="te-body">
        <div className="te-stage">
          <div ref={canvas} className="te-canvas" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onPointerDown={() => setSel(null)} tabIndex={0} aria-label={`Slide ${kind}, 4:5`}>
            <SlidePreview layout={layout} k={kit} assets={assets} index={1} />
            <div className="te-overlay">
              {layout.boxes.map((b) => (
                <div key={b.id} className={`te-handle ${sel === b.id ? "is-sel" : ""}`} style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` }}
                  onPointerDown={(e) => onPointerDown(e, b, "move")} title={`${KIND_LABEL[b.kind]}: arraste para mover`}>
                  <span className="te-tag">{(b.fixed ? `Fixo: ${b.fixed}` : b.auto === "contador" ? "Contador" : b.auto === "numero" ? "Número" : KIND_LABEL[b.kind])}</span>
                  <span className="te-resize" onPointerDown={(e) => onPointerDown(e, b, "resize")} title="Arraste para redimensionar" />
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-[var(--muted)] mt-2">Arraste a caixa para mover e o canto para redimensionar. Setas movem a caixa selecionada (Shift: mais rápido).</p>
          {missing.length > 0 && <p className="text-xs g-warn mt-1">Sem cor de {missing.join(", ")} no kit: a prévia usa outra cor no lugar.</p>}
        </div>

        <div className="te-panel">
          <section>
            <p className="label mb-2">Fundo</p>
            <div className="flex flex-wrap gap-2 items-center">
              {BG_ROLES.map((role) => {
                const c = roleColor(kit, role);
                const on = layout.bg.type === "cor" && layout.bg.role === role;
                return (
                  <button key={role} type="button" className={`te-chip ${on ? "is-on" : ""}`} onClick={() => patchSlide((bs) => bs, { type: "cor", role })}>
                    <span className="te-sw" style={{ background: c.hex, opacity: c.missing ? 0.4 : 1 }} />{ROLE_LABEL[role]}
                  </button>
                );
              })}
              <button type="button" className={`te-chip ${layout.bg.type === "imagem" ? "is-on" : ""}`} disabled={busy} onClick={() => file.current?.click()}>
                {busy ? "Enviando…" : layout.bg.type === "imagem" ? "Trocar imagem" : "Imagem do Canva"}
              </button>
              <input ref={file} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => onBgFile(e.target.files?.[0])} />
            </div>
            {layout.bg.type === "imagem" && <p className="text-xs text-[var(--muted)] mt-2">{layout.bg.name ?? "Imagem enviada"}. <button type="button" className="underline" onClick={() => patchSlide((bs) => bs, { type: "cor", role: "fundo" })}>Voltar para cor</button></p>}
            <p className="text-xs text-[var(--muted)] mt-2">Imagem: PNG ou JPG exportado do Canva em 1080 × 1350, sem os textos (eles entram nas caixas).</p>
          </section>

          <section>
            <p className="label mb-2">Caixas</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {layout.boxes.map((b) => (
                <button key={b.id} type="button" className={`te-chip ${sel === b.id ? "is-on" : ""}`} onClick={() => setSel(b.id)}>{(b.fixed ? `Fixo: ${b.fixed}` : b.auto === "contador" ? "Contador" : b.auto === "numero" ? "Número" : KIND_LABEL[b.kind])}</button>
              ))}
              {layout.boxes.length === 0 && <span className="text-xs text-[var(--muted)]">Nenhuma caixa neste slide.</span>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {BOX_KINDS.map((k) => <button key={k.key} type="button" className="ct-btn te-add" disabled={layout.boxes.length >= 12} onClick={() => addBox(k.key)}>+ {k.label}</button>)}
            </div>
          </section>

          {box && (
            <section className="te-props">
              <div className="flex items-center justify-between">
                <p className="label">{box.fixed ? "Texto fixo" : box.auto === "contador" ? "Contador" : box.auto === "numero" ? "Número do passo" : KIND_LABEL[box.kind]}</p>
                <button type="button" className="ct-icon-btn" onClick={() => removeBox(box.id)} title="Remover caixa" aria-label="Remover caixa"><TrashIcon /></button>
              </div>
              {textBox && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1"><span className="te-l">Fonte</span>
                      <select className="ct-input" value={box.font} onChange={(e) => patchBox(box.id, { font: e.target.value as "titulo" | "texto" })}>
                        <option value="titulo">Título{kit.fonts.titulo?.family ? ` (${kit.fonts.titulo.family})` : ""}</option>
                        <option value="texto">Texto{kit.fonts.texto?.family ? ` (${kit.fonts.texto.family})` : ""}</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1"><span className="te-l">Tamanho máx. (px)</span>
                      <input type="number" min={16} max={240} className="ct-input" value={box.size} onChange={(e) => patchBox(box.id, { size: Number(e.target.value) })} />
                    </label>
                    <label className="flex flex-col gap-1"><span className="te-l">Limite de palavras</span>
                      <input type="number" min={1} max={120} className="ct-input" value={box.maxWords} onChange={(e) => patchBox(box.id, { maxWords: Number(e.target.value) })} />
                    </label>
                    <div className="flex flex-col gap-1"><span className="te-l">Alinhamento</span>
                      <div className="te-seg te-seg-sm">
                        {(["left", "center", "right"] as BoxAlign[]).map((a) => <button key={a} type="button" className={box.align === a ? "is-on" : ""} onClick={() => patchBox(box.id, { align: a })} aria-label={{ left: "À esquerda", center: "Centralizado", right: "À direita" }[a]}><AlignIcon a={a} /></button>)}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1"><span className="te-l">Cor</span>
                    <div className="flex flex-wrap gap-1.5">
                      {COLOR_ROLES.map((r) => {
                        const c = roleColor(kit, r.key);
                        return <button key={r.key} type="button" className={`te-chip ${box.color === r.key ? "is-on" : ""}`} onClick={() => patchBox(box.id, { color: r.key })}><span className="te-sw" style={{ background: c.hex, opacity: c.missing ? 0.4 : 1 }} />{r.label}</button>;
                      })}
                    </div>
                  </div>
                  {box.kind === "titulo" && (
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={box.auto === "numero"} onChange={(e) => patchBox(box.id, { auto: e.target.checked ? "numero" : undefined })} />Número do passo (01, 02…), preenchido sozinho</label>
                  )}
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={box.auto === "contador"} onChange={(e) => patchBox(box.id, { auto: e.target.checked ? "contador" : undefined, fixed: undefined })} />Contador do carrossel (2/7), preenchido sozinho</label>
                  <label className="flex flex-col gap-1"><span className="te-l">Texto fixo (igual em todo carrossel, ex.: @perfil)</span>
                    <input className="ct-input" value={box.fixed ?? ""} maxLength={80} onChange={(e) => patchBox(box.id, { fixed: e.target.value || undefined, auto: e.target.value ? undefined : box.auto })} placeholder="Vazio: o texto vem de cada carrossel" />
                  </label>
                </>
              )}
              <div className="grid grid-cols-4 gap-2">
                {(["x", "y", "w", "h"] as const).map((f) => (
                  <label key={f} className="flex flex-col gap-1"><span className="te-l">{{ x: "X %", y: "Y %", w: "Largura %", h: "Altura %" }[f]}</span>
                    <input type="number" step={0.5} min={0} max={100} className="ct-input" value={box[f]} onChange={(e) => patchBox(box.id, { [f]: Number(e.target.value) })} />
                  </label>
                ))}
              </div>
            </section>
          )}

          <div className="te-actions">
            <button type="button" className="ct-btn ct-btn-dark" disabled={busy || !t.name.trim()} onClick={onSave}>{busy ? "Salvando…" : "Salvar modelo"}</button>
            <Link href={backHref} scroll={false} className="ct-btn">Fechar</Link>
            {remove && <button type="button" className="ct-btn ct-btn-ghost" disabled={busy} onClick={onRemove}>Apagar modelo</button>}
            {dirty && !busy && <span className="text-xs g-warn">Alterações não salvas.</span>}
            {msg && <span className={`text-xs ${msg.ok ? "g-good" : "g-bad"}`}>{msg.message}</span>}
          </div>
        </div>
      </div>

      <div className="te-strip">
        {SLIDE_KINDS.map((s) => (
          <button key={s.key} type="button" className={`te-thumb ${kind === s.key ? "is-on" : ""}`} onClick={() => { setKind(s.key); setSel(t.slides[s.key].boxes[0]?.id ?? null); }}>
            <SlidePreview layout={t.slides[s.key]} k={kit} assets={assets} />
            <span>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
