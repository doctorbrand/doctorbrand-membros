/* eslint-disable @next/next/no-img-element -- imagens do Satori (desenho do slide), não da página */
import { readFile } from "fs/promises";
import path from "path";
import { get } from "@vercel/blob";
import type { ReactNode } from "react";
import { roleColor, SLIDE_H, SLIDE_W, type BrandFont, type BrandKit, type TemplateBox } from "./brand";
import { fitSize, highlightParts, type CarouselDoc, type EditSlide } from "./carousel";
import { driveFetch, parseDriveLinks } from "./drive";
import { localDir } from "./store";

/**
 * Monta os slides do carrossel em JPG 1080x1350, a partir do kit de marca e de um modelo.
 * Satori desenha (texto vira vetor, sem depender de fonte instalada) e o sharp converte para JPG.
 * Fontes: as do kit quando dá para carregar (arquivo TTF/OTF/WOFF ou Google Fonts); senão Inter, que vem no projeto.
 */

type FontEntry = { name: string; data: ArrayBuffer; weight: 400 | 500 | 600 | 700; style: "normal" };

const FALLBACK = "Inter";
const fontDir = () => path.join(process.cwd(), "src/assets/fonts");

async function readPrivate(p: string): Promise<Buffer | null> {
  const dir = localDir();
  if (dir) return readFile(`${dir}/${p}`).catch(() => null);
  const r = await get(p, { access: "private" }).catch(() => null);
  if (!r || r.statusCode !== 200 || !r.stream) return null;
  return Buffer.from(await new Response(r.stream).arrayBuffer());
}

const ab = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

/** Satori lê TTF, OTF e WOFF (não WOFF2). */
const satoriFont = (b: Buffer) => {
  const sig = b.subarray(0, 4).toString("latin1");
  return sig === "wOFF" || sig === "OTTO" || sig === "true" || b.readUInt32BE(0) === 0x00010000;
};

async function googleFont(family: string, weight: number): Promise<Buffer | null> {
  // Navegador antigo: o Google devolve TTF em vez de WOFF2.
  const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1";
  const css = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family.trim()).replace(/%20/g, "+")}:wght@${weight}`, { headers: { "user-agent": ua }, cache: "force-cache" }).then((r) => (r.ok ? r.text() : "")).catch(() => "");
  const url = css.match(/src:\s*url\(([^)]+)\)/)?.[1];
  if (!url) return null;
  const r = await fetch(url, { cache: "force-cache" }).catch(() => null);
  return r?.ok ? Buffer.from(await r.arrayBuffer()) : null;
}

async function loadKitFont(f: BrandFont | undefined, weight: number): Promise<Buffer | null> {
  if (!f?.family) return null;
  if (f.source === "google" && f.family.trim().toLowerCase() === "inter") return readFile(path.join(fontDir(), `inter-latin-${weight >= 650 ? 700 : weight >= 550 ? 600 : 400}-normal.woff`));
  const b = f.source === "arquivo" && f.path ? await readPrivate(f.path) : await googleFont(f.family, weight);
  return b && satoriFont(b) ? b : null;
}

/** Fontes para o Satori e os nomes de família a usar no título e no texto. */
async function fonts(kit: BrandKit): Promise<{ list: FontEntry[]; title: string; text: string; titleWeight: 400 | 500 | 600 | 700 }> {
  const [r, sb, b] = await Promise.all(["400", "600", "700"].map((w) => readFile(path.join(fontDir(), `inter-latin-${w}-normal.woff`))));
  const list: FontEntry[] = [
    { name: FALLBACK, data: ab(r), weight: 400, style: "normal" },
    { name: FALLBACK, data: ab(sb), weight: 600, style: "normal" },
    { name: FALLBACK, data: ab(b), weight: 700, style: "normal" },
  ];
  const tw = (Math.min(700, Math.max(400, Math.round((kit.fonts.titulo?.weight ?? 700) / 100) * 100)) as 400 | 500 | 600 | 700);
  const [tf, xf] = await Promise.all([loadKitFont(kit.fonts.titulo, tw), loadKitFont(kit.fonts.texto, 400)]);
  let title = FALLBACK, text = FALLBACK;
  if (tf) { list.push({ name: "KitTitulo", data: ab(tf), weight: tw, style: "normal" }); title = "KitTitulo"; }
  if (xf) { list.push({ name: "KitTexto", data: ab(xf), weight: 400, style: "normal" }); text = "KitTexto"; }
  return { list, title, text, titleWeight: tf ? tw : 700 };
}

/** Foto do slide em data URI (JPG reduzido para 1080 de largura). */
async function imageData(ref: string, slug: string): Promise<string | null> {
  const sharp = (await import("sharp")).default;
  let buf: Buffer | null = null;
  if (ref.startsWith(`content-media/${slug}/`)) buf = await readPrivate(ref);
  else {
    const id = parseDriveLinks(ref).files[0] ?? (/^[\w-]{20,}$/.test(ref) ? ref : null);
    if (id) {
      const r = await driveFetch(id).catch(() => null);
      const type = r?.headers.get("content-type") ?? "";
      if (r?.ok && !type.includes("text/html")) buf = Buffer.from(await r.arrayBuffer());
    }
  }
  if (!buf) return null;
  const jpg = await sharp(buf).rotate().resize({ width: SLIDE_W, height: SLIDE_W, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
  return `data:image/jpeg;base64,${jpg.toString("base64")}`;
}

/**
 * Texto com *destaque*. O Satori não faz texto corrido com trechos de cor diferente,
 * então cada palavra vira um item de uma linha que quebra sozinha (flex-wrap).
 */
function Rich({ text, accent, size, center, right }: { text: string; accent: string; size: number; center: boolean; right?: boolean }) {
  const paras = text.split(/\n+/).filter((p) => p.trim());
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: center ? "center" : right ? "flex-end" : "flex-start" }}>
      {paras.map((para, pi) => {
        // glue: a palavra encosta na anterior (ex.: pontuação logo depois de um *destaque*).
        const ws: { w: string; accent: boolean; glue: boolean }[] = [];
        let prev = "";
        for (const part of highlightParts(para)) {
          const glued = ws.length > 0 && !/\s$/.test(prev) && !/^\s/.test(part.text);
          part.text.split(/\s+/).filter(Boolean).forEach((w, k) => ws.push({ w, accent: part.accent, glue: k === 0 && glued }));
          prev = part.text;
        }
        return (
          <div key={pi} style={{ display: "flex", flexWrap: "wrap", justifyContent: center ? "center" : right ? "flex-end" : "flex-start", marginTop: pi ? size * 0.5 : 0 }}>
            {ws.map((x, i) => <span key={i} style={{ color: x.accent ? accent : undefined, marginRight: i < ws.length - 1 && !ws[i + 1].glue ? size * 0.26 : 0 }}>{x.w}</span>)}
          </div>
        );
      })}
    </div>
  );
}

function isDark(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255) < 140;
}

interface Assets { titleFont: string; textFont: string; titleWeight: number; logo: { light?: string; dark?: string }; images: Map<string, string | null>; bg: Map<string, string | null> }

function Box({ b, slide, i, total, kit, a, bgHex }: { b: TemplateBox; slide: EditSlide; i: number; total: number; kit: BrandKit; a: Assets; bgHex: string }) {
  const pos = { position: "absolute" as const, left: (b.x / 100) * SLIDE_W, top: (b.y / 100) * SLIDE_H, width: (b.w / 100) * SLIDE_W, height: (b.h / 100) * SLIDE_H, display: "flex" };
  if (b.kind === "imagem") {
    const src = slide.images[b.id] ? a.images.get(slide.images[b.id]) : null;
    return src ? <img alt="" src={src} width={pos.width} height={pos.height} style={{ ...pos, objectFit: "cover" }} /> : null;
  }
  if (b.kind === "logo") {
    const src = isDark(bgHex) ? (a.logo.dark ?? a.logo.light) : (a.logo.light ?? a.logo.dark);
    return src ? <div style={{ ...pos, justifyContent: "center", alignItems: "center" }}><img alt="" src={src} style={{ maxWidth: pos.width, maxHeight: pos.height, objectFit: "contain" }} /></div> : null;
  }
  const raw = b.fixo !== undefined ? b.fixo.trim() : b.auto === "contador" ? `${i + 1}/${total}` : b.auto === "numero" ? String(i).padStart(2, "0") : (slide.text[b.id] ?? "").trim();
  if (!raw) return null;
  const title = (b.font ?? (b.kind === "titulo" ? "titulo" : "texto")) === "titulo";
  const size = fitSize(raw, b.size ?? 40, pos.width, pos.height, title);
  const color = roleColor(kit, b.color ?? "texto").hex;
  let accent = roleColor(kit, "destaque").hex;
  if (accent.toLowerCase() === bgHex.toLowerCase() || accent.toLowerCase() === color.toLowerCase()) accent = isDark(bgHex) ? "#ffffff" : "#111111";
  if (accent.toLowerCase() === color.toLowerCase()) accent = color;
  const center = b.align === "center";
  return (
    <div style={{ ...pos, flexDirection: "column", alignItems: center ? "center" : b.align === "right" ? "flex-end" : "flex-start", color, fontFamily: title ? a.titleFont : a.textFont, fontWeight: title ? a.titleWeight : 400, fontSize: size, lineHeight: title ? 1.12 : 1.35, letterSpacing: b.caps ? "0.2em" : title ? "-0.01em" : "0", ...(b.opacity ? { opacity: b.opacity / 100 } : {}), ...(b.italic ? { fontStyle: "italic" as const } : {}), ...(b.caps ? { textTransform: "uppercase" as const } : {}) }}>
      <Rich text={raw} accent={accent} size={size} center={center} right={b.align === "right"} />
    </div>
  );
}

function Slide({ slide, i, total, kit, a }: { slide: EditSlide; i: number; total: number; kit: BrandKit; a: Assets }): ReactNode {
  const bg = slide.layout.bg;
  const bgHex = bg.type === "cor" ? roleColor(kit, bg.role).hex : "#1a1a1a";
  const bgImg = bg.type === "imagem" ? a.bg.get(bg.path) : null;
  return (
    <div style={{ width: SLIDE_W, height: SLIDE_H, display: "flex", position: "relative", background: bgHex }}>
      {bgImg && <img alt="" src={bgImg} width={SLIDE_W} height={SLIDE_H} style={{ position: "absolute", left: 0, top: 0, width: SLIDE_W, height: SLIDE_H, objectFit: "cover" }} />}
      {slide.layout.boxes.map((b) => <Box key={b.id} b={b} slide={slide} i={i} total={total} kit={kit} a={a} bgHex={bgImg ? "#1a1a1a" : bgHex} />)}
    </div>
  );
}

/** Data URI de um logo do kit, convertido para PNG (o Satori não lê SVG embutido de forma confiável). */
async function logoData(p?: string): Promise<string | undefined> {
  if (!p) return undefined;
  const buf = await readPrivate(p);
  if (!buf) return undefined;
  const sharp = (await import("sharp")).default;
  const png = await sharp(buf, { density: 300 }).resize({ height: 200, withoutEnlargement: false }).png().toBuffer().catch(() => null);
  return png ? `data:image/png;base64,${png.toString("base64")}` : undefined;
}

export interface RenderResult { jpgs: Buffer[]; warnings: string[] }

/** Monta os slides do carrossel em JPG. `width` menor serve para conferir na tela. */
export async function renderDoc(slug: string, kit: BrandKit, doc: CarouselDoc, opts: { width?: number } = {}): Promise<RenderResult> {
  const satori = (await import("satori")).default;
  const sharp = (await import("sharp")).default;
  const warnings: string[] = [];
  const f = await fonts(kit);
  if (kit.fonts.titulo?.family && f.title === FALLBACK && kit.fonts.titulo.family.trim().toLowerCase() !== "inter") warnings.push(`Não consegui carregar a fonte “${kit.fonts.titulo.family}”: usei Inter nos títulos. Envie o arquivo TTF ou OTF da fonte no kit.`);
  if (kit.fonts.texto?.family && f.text === FALLBACK && kit.fonts.texto.family.trim().toLowerCase() !== "inter") warnings.push(`Não consegui carregar a fonte “${kit.fonts.texto.family}”: usei Inter no texto.`);

  const [light, dark] = await Promise.all([logoData((kit.logos.claro ?? kit.logos.principal)?.path), logoData((kit.logos.escuro ?? kit.logos.principal)?.path)]);
  const refs = [...new Set(doc.slides.flatMap((s) => Object.values(s.images)))];
  const images = new Map(await Promise.all(refs.map(async (r) => [r, await imageData(r, slug).catch(() => null)] as const)));
  for (const [r, v] of images) if (!v) warnings.push(`Não consegui carregar a foto ${r.startsWith("content-media/") ? r.split("/").pop() : `do Drive (${r})`}. Confira o compartilhamento.`);
  const bgPaths = [...new Set(doc.slides.flatMap((s) => (s.layout.bg.type === "imagem" ? [s.layout.bg.path] : [])))];
  const bg = new Map(await Promise.all(bgPaths.map(async (p) => {
    const buf = await readPrivate(p);
    const jpg = buf ? await sharp(buf).resize({ width: SLIDE_W, height: SLIDE_H, fit: "cover" }).jpeg({ quality: 90 }).toBuffer() : null;
    return [p, jpg ? `data:image/jpeg;base64,${jpg.toString("base64")}` : null] as const;
  })));
  const a: Assets = { titleFont: f.title, textFont: f.text, titleWeight: f.titleWeight, logo: { light, dark }, images, bg };

  const jpgs: Buffer[] = [];
  for (const [i, s] of doc.slides.entries()) {
    const svg = await satori(<Slide slide={s} i={i} total={doc.slides.length} kit={kit} a={a} />, { width: SLIDE_W, height: SLIDE_H, fonts: f.list });
    let img = sharp(Buffer.from(svg));
    if (opts.width && opts.width < SLIDE_W) img = img.resize({ width: opts.width });
    jpgs.push(await img.flatten({ background: "#ffffff" }).jpeg({ quality: 92, mozjpeg: true }).toBuffer());
  }
  return { jpgs, warnings };
}
