import { cleanBox, SLIDE_KINDS, type BrandKit, type CarouselTemplate, type SlideKind, type SlideLayout } from "./brand";

/**
 * Texto dos slides de um carrossel e as regras de leitura. Os modelos (caixas, fundos) ficam em brand.ts;
 * a montagem em JPG fica em carouselRender.tsx. Sem dependência de servidor.
 */

export const MAX_SLIDES = 10;

export interface CarouselSlide {
  kind: SlideKind;
  title: string;
  body: string;
  /** Foto: link/id do Drive, caminho no Blob, ou "auto" (próxima foto da pasta do kit). */
  image?: string;
}

/**
 * Texto dos slides num formato simples, que a equipe digita e o Claude gera:
 *
 *   # Título da capa com *destaque*
 *   Texto de apoio.
 *   ---
 *   # Segundo slide
 *   Texto.
 *   [foto]                      ← usa a próxima foto da pasta do kit
 *   [foto: link do Drive]       ← usa essa foto
 *   ---
 *   # Comenta ANALISE
 *
 * O primeiro slide é a capa, o último é o final; os do meio são texto, ou "com foto" quando têm [foto].
 */
export function parseSlides(text: string): CarouselSlide[] {
  const blocks = text.replace(/\r\n?/g, "\n").split(/\n\s*---+\s*\n/).map((b) => b.trim()).filter(Boolean).slice(0, MAX_SLIDES);
  return blocks.map((b, i) => {
    let image: string | undefined;
    const lines: string[] = [];
    for (const raw of b.split("\n")) {
      const m = raw.trim().match(/^\[(?:foto|imagem)(?::\s*(.+))?\]$/i);
      if (m) { image = m[1]?.trim() || "auto"; continue; }
      lines.push(raw);
    }
    const tIdx = lines.findIndex((l) => l.trim().startsWith("#"));
    const title = tIdx >= 0 ? lines[tIdx].replace(/^\s*#+\s*/, "").trim() : (lines.find((l) => l.trim()) ?? "").trim();
    const rest = lines.filter((_, j) => j !== (tIdx >= 0 ? tIdx : lines.findIndex((l) => l.trim()))).join("\n").trim();
    const kind: SlideKind = i === 0 ? "capa" : i === blocks.length - 1 && blocks.length > 1 ? "final" : image ? "imagem" : "texto";
    return { kind, title, body: rest, ...(image ? { image } : {}) };
  });
}

/** Volta os slides para o formato de texto (para editar de novo). */
export function slidesToText(slides: CarouselSlide[]): string {
  return slides.map((s) => [`# ${s.title}`, s.body, s.image ? (s.image === "auto" ? "[foto]" : `[foto: ${s.image}]`) : ""].filter(Boolean).join("\n")).join("\n---\n");
}

/** Divide "texto com *destaque*" em partes, marcando o que vai na cor de destaque. */
export function highlightParts(s: string): { text: string; accent: boolean }[] {
  const out: { text: string; accent: boolean }[] = [];
  const re = /\*([^*]+)\*/g;
  let last = 0;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    if (m.index > last) out.push({ text: s.slice(last, m.index), accent: false });
    out.push({ text: m[1], accent: true });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last), accent: false });
  return out;
}

/**
 * Tamanho que cabe na caixa: o Satori não mede texto antes de desenhar, então estimamos linhas pela
 * largura média dos caracteres e reduzimos a fonte até caber na altura da caixa.
 */
export function fitSize(text: string, size: number, wPx: number, hPx: number, title: boolean) {
  const plain = text.replace(/\*/g, "");
  const lh = title ? 1.12 : 1.35;
  let s = size;
  for (let k = 0; k < 30 && s > 14; k++) {
    const cpl = Math.max(1, Math.floor(wPx / (s * (title ? 0.56 : 0.52))));
    const lines = plain.split(/\n+/).reduce((n, p) => n + Math.max(1, Math.ceil(p.length / cpl)), 0);
    if (lines * s * lh <= hPx) break;
    s = Math.floor(s * 0.93);
  }
  return s;
}


export const words = (s: string) => s.replace(/\*/g, "").split(/\s+/).filter(Boolean).length;

/** Limite de palavras do título e do texto num tipo de slide do modelo (soma das caixas daquele tipo). */
export function slideLimits(t: CarouselTemplate, kind: SlideKind): { titulo: number; texto: number; imagem: boolean } {
  const boxes = t.slides[kind]?.boxes ?? [];
  const sum = (k: "titulo" | "texto") => boxes.filter((b) => b.kind === k && b.auto !== "numero").reduce((n, b) => n + (b.maxWords ?? 0), 0);
  return { titulo: sum("titulo"), texto: sum("texto"), imagem: boxes.some((b) => b.kind === "imagem") };
}

/** Avisos antes de montar: slides demais, texto acima do limite das caixas, foto pedida sem pasta. */
export function slideWarnings(slides: CarouselSlide[], t: CarouselTemplate, kit: BrandKit): string[] {
  const w: string[] = [];
  if (slides.length < 2) w.push("O Instagram pede pelo menos 2 slides no carrossel.");
  slides.forEach((s, i) => {
    const lim = slideLimits(t, s.kind);
    if (!s.title.trim()) w.push(`Slide ${i + 1}: sem título.`);
    if (lim.titulo && words(s.title) > lim.titulo) w.push(`Slide ${i + 1}: título com ${words(s.title)} palavras (o modelo pede até ${lim.titulo}).`);
    if (s.body && !lim.texto) w.push(`Slide ${i + 1}: o modelo não tem caixa de texto neste tipo de slide; o texto de apoio não aparece.`);
    else if (lim.texto && words(s.body) > lim.texto) w.push(`Slide ${i + 1}: texto com ${words(s.body)} palavras (o modelo pede até ${lim.texto}).`);
    if (lim.imagem && !kit.driveFolder && !(s.image && s.image !== "auto")) w.push(`Slide ${i + 1}: o modelo tem foto aqui, mas o kit não tem pasta de fotos.`);
  });
  return w;
}

// ─── Carrossel editável (cada slide guarda o próprio layout, textos e fotos) ───────────

/** Um slide do carrossel: cópia do layout do modelo (que a equipe pode ajustar só aqui), textos e fotos por caixa. */
export interface EditSlide {
  id: string;
  kind: SlideKind;
  layout: SlideLayout;
  /** Texto de cada caixa de título/texto, pelo id da caixa. Aceita *destaque*. */
  text: Record<string, string>;
  /** Foto de cada caixa de imagem: id do Drive ou caminho no Blob. */
  images: Record<string, string>;
}

export interface CarouselDoc {
  templateId: string;
  templateName: string;
  slides: EditSlide[];
}

const sid = () => Math.random().toString(36).slice(2, 10);
const copyLayout = (l: SlideLayout): SlideLayout => JSON.parse(JSON.stringify(l));

/** Caixas de texto que recebem o título e o texto de apoio do slide (a maior caixa de texto recebe o apoio). */
function targets(l: SlideLayout) {
  const tit = l.boxes.filter((b) => b.kind === "titulo" && b.auto !== "numero").sort((a, b) => a.y - b.y);
  const tex = l.boxes.filter((b) => b.kind === "texto").sort((a, b) => (b.maxWords ?? 0) - (a.maxWords ?? 0) || b.h - a.h);
  return { title: tit[0], body: tex[0] };
}

/** Monta o carrossel editável a partir do texto (formato com ---) e do modelo. `pool`: fotos da pasta do kit, em ordem. */
export function docFromSlides(t: CarouselTemplate, slides: CarouselSlide[], pool: string[]): CarouselDoc {
  let next = 0;
  return {
    templateId: t.id, templateName: t.name,
    slides: slides.map((s) => {
      const layout = copyLayout(t.slides[s.kind]);
      const { title, body } = targets(layout);
      const text: Record<string, string> = {};
      if (title) text[title.id] = s.title;
      if (body) text[body.id] = s.body;
      const images: Record<string, string> = {};
      for (const b of layout.boxes.filter((x) => x.kind === "imagem")) {
        const ref = s.image && s.image !== "auto" ? s.image : pool[next++];
        if (ref) images[b.id] = ref;
      }
      return { id: sid(), kind: s.kind, layout, text, images };
    }),
  };
}

/** Slide novo (duplicado do modelo) para o botão "Adicionar slide". */
export function blankSlide(t: CarouselTemplate, kind: SlideKind): EditSlide {
  return { id: sid(), kind, layout: copyLayout(t.slides[kind]), text: {}, images: {} };
}

/** Texto plano do carrossel (para legenda, histórico e para o Claude). */
export function docText(d: CarouselDoc): string {
  return d.slides.map((s) => s.layout.boxes.filter((b) => s.text[b.id]).sort((a, b) => a.y - b.y).map((b) => (b.kind === "titulo" ? `# ${s.text[b.id]}` : s.text[b.id])).join("\n")).join("\n---\n");
}

/** Limpa o carrossel vindo do navegador: caixas válidas, textos e fotos com limite, fotos só do próprio cliente ou do Drive. */
export function cleanDoc(raw: unknown, slug: string): CarouselDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Partial<CarouselDoc>;
  if (!Array.isArray(d.slides) || d.slides.length === 0) return null;
  const kinds = new Set(SLIDE_KINDS.map((k) => k.key));
  const slides: EditSlide[] = [];
  for (const s of d.slides.slice(0, MAX_SLIDES)) {
    if (!s || !kinds.has(s.kind)) continue;
    const bgRaw = s.layout?.bg;
    const bg: SlideLayout["bg"] = bgRaw?.type === "imagem" && typeof bgRaw.path === "string" && bgRaw.path.startsWith(`content-media/${slug}/`) && !bgRaw.path.includes("..")
      ? { type: "imagem", path: bgRaw.path } : { type: "cor", role: bgRaw?.type === "cor" && ["fundo", "destaque", "apoio", "texto"].includes(bgRaw.role) ? bgRaw.role : "fundo" };
    const boxes = (Array.isArray(s.layout?.boxes) ? s.layout.boxes : []).slice(0, 12).map((b) => cleanBox(b)).filter((b): b is NonNullable<typeof b> => !!b);
    const ids = new Set(boxes.map((b) => b.id));
    const text: Record<string, string> = {};
    for (const [k, v] of Object.entries(s.text ?? {})) if (ids.has(k) && typeof v === "string") text[k] = v.slice(0, 600);
    const images: Record<string, string> = {};
    for (const [k, v] of Object.entries(s.images ?? {})) {
      if (!ids.has(k) || typeof v !== "string") continue;
      if ((v.startsWith(`content-media/${slug}/`) && !v.includes("..")) || /^[\w-]{20,80}$/.test(v)) images[k] = v;
    }
    slides.push({ id: typeof s.id === "string" && /^[\w-]{1,24}$/.test(s.id) ? s.id : sid(), kind: s.kind, layout: { bg, boxes }, text, images });
  }
  if (!slides.length) return null;
  return { templateId: String(d.templateId ?? "").slice(0, 24), templateName: String(d.templateName ?? "").slice(0, 40), slides };
}
