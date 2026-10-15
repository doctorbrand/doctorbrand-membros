/**
 * Kit de marca do cliente: a fonte única do visual. Logos, cores com papel definido, fontes,
 * pasta de fotos no Drive e regras. É o que os modelos de carrossel (e depois capas e stories) usam.
 * Guardado no Blob em `marca/<slug>` (leitura e escrita em brandStore.ts); os arquivos (logos, fontes)
 * ficam em content-media/<slug>/brand/. Este arquivo não depende do servidor: vale também no navegador.
 */

export type LogoKey = "principal" | "claro" | "escuro";
export const LOGO_SLOTS: { key: LogoKey; label: string; hint: string }[] = [
  { key: "principal", label: "Logo principal", hint: "A versão que o cliente mais usa." },
  { key: "claro", label: "Para fundo claro", hint: "Versão escura do logo, para aplicar sobre branco ou bege." },
  { key: "escuro", label: "Para fundo escuro", hint: "Versão clara do logo, para aplicar sobre preto ou cores fortes." },
];

export type ColorRole = "fundo" | "texto" | "destaque" | "apoio";
export const COLOR_ROLES: { key: ColorRole; label: string }[] = [
  { key: "fundo", label: "Fundo" },
  { key: "texto", label: "Texto" },
  { key: "destaque", label: "Destaque" },
  { key: "apoio", label: "Apoio" },
];
export const MAX_COLORS = 6;

export interface BrandColor { name: string; hex: string; role: ColorRole }

export interface BrandFont {
  family: string;
  /** google: carrega do Google Fonts pelo nome. arquivo: fonte enviada (TTF, OTF ou WOFF2). */
  source: "google" | "arquivo";
  /** Caminho do arquivo no Blob, quando source = arquivo (o regular, ou o primeiro enviado). */
  path?: string;
  /** Peso usado nos slides (400, 500, 600, 700…). */
  weight?: number;
  /** Todos os arquivos enviados da família (light, regular, itálico, bold…), cada um com peso e estilo. */
  files?: FontFile[];
}

export interface FontFile { path: string; weight: number; italic?: boolean }

export type FontSlot = "titulo" | "texto" | "script";

const WEIGHT_WORDS: [RegExp, number][] = [
  [/hairline|thin/i, 100], [/extra-?light|ultra-?light/i, 200], [/light/i, 300], [/semi-?bold|demi-?bold/i, 600],
  [/extra-?bold|ultra-?bold|heavy/i, 800], [/black/i, 900], [/bold/i, 700], [/medium/i, 500],
];

/** Peso e estilo pelo nome do arquivo: "Denton-LightItalic.otf" = 300 itálico; sem palavra de peso = 400. */
export function fontFileStyle(name: string): { weight: number; italic: boolean } {
  const base = name.replace(/\.[^.]+$/, "");
  const style = base.split(/[-_ ]/).slice(1).join("-") || "";
  const weight = WEIGHT_WORDS.find(([re]) => re.test(style))?.[1] ?? 400;
  return { weight, italic: /italic|oblique/i.test(style) };
}

/** Nome da família pelo arquivo: "AktivGrotesk-Light.ttf" vira "Aktiv Grotesk". */
export function fontFamilyFromFile(name: string): string {
  return name.replace(/\.[^.]+$/, "").split(/[-_]/)[0].replace(/([a-z])([A-Z])/g, "$1 $2").trim() || name;
}

/** Nome legível de uma variante: "Light itálico", "Regular". */
export function fontVariantLabel(weight: number, italic?: boolean): string {
  const n = ({ 100: "Thin", 200: "ExtraLight", 300: "Light", 400: "Regular", 500: "Medium", 600: "SemiBold", 700: "Bold", 800: "ExtraBold", 900: "Black" } as Record<number, string>)[weight] ?? String(weight);
  return italic ? `${n} itálico` : n;
}

/** Arquivos de uma família (inclui o `path` antigo, de antes de aceitar vários arquivos). */
export function fontFiles(f?: BrandFont): FontFile[] {
  if (!f || f.source !== "arquivo") return [];
  if (f.files?.length) return f.files;
  return f.path ? [{ path: f.path, weight: f.weight ?? 400 }] : [];
}

export interface BrandKit {
  logos: Partial<Record<LogoKey, { path: string; name?: string }>>;
  colors: BrandColor[];
  /** titulo e texto valem para todos os modelos; script só para os modelos fixos que pedem (ex.: Sloop no Editorial). */
  fonts: { titulo?: BrandFont; texto?: BrandFont; script?: BrandFont };
  /** Link da pasta de fotos no Google Drive (compartilhada por link). */
  driveFolder?: string;
  /** Regras visuais e de conteúdo, uma por linha. O Claude respeita na hora de gerar. */
  rules?: string;
  /** Modelos de carrossel (até MAX_TEMPLATES). */
  templates?: CarouselTemplate[];
  /**
   * Modelos fixos, desenhados em código, no lugar dos modelos de caixas. "doctorbrand": os 5 modelos da
   * skill carrossel-fernandofontees (lib/carrossel/doctorbrand.ts). Hoje só o kit do Fernando usa.
   */
  modelosFixos?: "doctorbrand";
  /** @ do Instagram, para a moldura dos modelos (ex.: @fernandofontees). */
  handle?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export const HEX = /^#[0-9a-f]{6}$/i;

/** Normaliza "#ABC", "abc123", "#AbC123" para "#abc123". Devolve null se não for cor. */
export function normalizeHex(v: string): string | null {
  let s = v.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(s)) s = s.split("").map((c) => c + c).join("");
  return /^[0-9a-f]{6}$/.test(s) ? `#${s}` : null;
}

/** Cor pelo papel (a primeira cadastrada com aquele papel). */
export const colorFor = (k: BrandKit, role: ColorRole) => k.colors.find((c) => c.role === role)?.hex;

/** Quanto do kit está pronto, por item. Usado no topo da página. */
export function brandChecklist(k: BrandKit): { label: string; done: boolean }[] {
  return [
    { label: "Logo", done: !!k.logos.principal },
    { label: "Cores de fundo, texto e destaque", done: (["fundo", "texto", "destaque"] as ColorRole[]).every((r) => !!colorFor(k, r)) },
    { label: "Fontes", done: !!k.fonts.titulo?.family && !!k.fonts.texto?.family && (!k.modelosFixos || !!k.fonts.script?.family) },
    { label: "Pasta de fotos", done: !!k.driveFolder },
    { label: "Regras", done: !!k.rules?.trim() },
  ];
}

/** Arquivos aceitos no kit (o envio vai direto do navegador para o Blob). */
export const BRAND_UPLOAD_TYPES = [
  "image/png", "image/svg+xml", "image/jpeg", "image/webp",
  "font/ttf", "font/otf", "font/woff2", "font/woff", "application/font-woff", "application/x-font-ttf", "application/x-font-otf", "application/octet-stream",
];

/** Tipo de conteúdo pelo nome do arquivo (para servir logos e fontes). */
export function brandMime(path: string): string | undefined {
  const ext = path.split(".").pop()?.toLowerCase();
  return ({ png: "image/png", svg: "image/svg+xml", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", ttf: "font/ttf", otf: "font/otf", woff2: "font/woff2", woff: "font/woff" } as Record<string, string>)[ext ?? ""];
}

/** Google Fonts: URL do CSS de uma família (para a prévia na página). */
export function googleFontCss(family: string, weight?: number): string {
  const fam = family.trim().replace(/\s+/g, "+");
  // Sem peso, o Google devolve o regular (que toda família tem). Com peso, só aquele.
  return `https://fonts.googleapis.com/css2?family=${fam}${weight && weight !== 400 ? `:wght@${weight}` : ""}&display=swap`;
}

// ─── Modelos de carrossel ────────────────────────────────────────────────
// Cada modelo tem 4 tipos de slide. Cada slide tem um fundo (cor do kit pelo papel ou imagem enviada)
// e caixas posicionadas em % do slide 1080 × 1350. O texto entra na etapa de geração; aqui fica só o desenho.

export const MAX_TEMPLATES = 3;
export const SLIDE_W = 1080;
export const SLIDE_H = 1350;

export type SlideKind = "capa" | "texto" | "imagem" | "final";
export const SLIDE_KINDS: { key: SlideKind; label: string; hint: string }[] = [
  { key: "capa", label: "Capa", hint: "Primeiro slide: o gancho." },
  { key: "texto", label: "Texto", hint: "Slides do meio, só com texto." },
  { key: "imagem", label: "Imagem", hint: "Slides do meio com foto." },
  { key: "final", label: "Final", hint: "Último slide: chamada para ação." },
];

export type BoxKind = "titulo" | "texto" | "imagem" | "logo";
export const BOX_KINDS: { key: BoxKind; label: string }[] = [
  { key: "titulo", label: "Título" },
  { key: "texto", label: "Texto" },
  { key: "imagem", label: "Imagem" },
  { key: "logo", label: "Logo" },
];
export type BoxAlign = "left" | "center" | "right";
/** Papéis de cor que um fundo de cor pode usar. */
export const BG_ROLES: ColorRole[] = ["fundo", "destaque", "apoio"];

export interface TemplateBox {
  id: string;
  kind: BoxKind;
  /** Posição e tamanho em % do slide (0–100). */
  x: number; y: number; w: number; h: number;
  /** Só título e texto: fonte do kit, tamanho máximo em px (no slide de 1080), alinhamento, cor e limite de palavras. */
  font?: "titulo" | "texto";
  size?: number;
  align?: BoxAlign;
  color?: ColorRole;
  maxWords?: number;
  /** Preenchido sozinho na geração: "numero" = número do passo (01, 02…); "contador" = posição no carrossel (3/7). */
  auto?: "numero" | "contador";
  /** Texto fixo, igual em todo carrossel (moldura: nome da marca, @ do perfil). O Claude não escreve nesta caixa. */
  fixo?: string;
  /** Opacidade do texto em % (100, 80 ou 60): texto de apoio no tom da marca. */
  opacity?: number;
  /** Texto em itálico (ênfase: a frase do título continua em itálico). */
  italic?: boolean;
  /** Caixa alta com espaçamento largo entre letras (sobretítulo, chamada curta). */
  caps?: boolean;
}

export type SlideBg = { type: "cor"; role: ColorRole } | { type: "imagem"; path: string; name?: string };
export interface SlideLayout { bg: SlideBg; boxes: TemplateBox[] }

export interface CarouselTemplate {
  id: string;
  name: string;
  slides: Record<SlideKind, SlideLayout>;
  /** Modelo-base de origem, quando criado pelo botão. */
  base?: "editorial" | "lista" | "foto";
  updatedAt?: string;
}

const clamp = (v: unknown, min: number, max: number, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 10) / 10)) : def;
};
const ROLE_SET = new Set<ColorRole>(["fundo", "texto", "destaque", "apoio"]);
const isTextBox = (k: BoxKind) => k === "titulo" || k === "texto";
export const newId = () => Math.random().toString(36).slice(2, 10);

/** Limpa uma caixa vinda do navegador: tipos válidos, posição dentro do slide, tamanhos com limite. */
export function cleanBox(raw: Partial<TemplateBox>): TemplateBox | null {
  const kind = raw.kind;
  if (!kind || !BOX_KINDS.some((b) => b.key === kind)) return null;
  const w = clamp(raw.w, 3, 100, 40), h = clamp(raw.h, 3, 100, 10);
  const box: TemplateBox = {
    id: typeof raw.id === "string" && /^[\w-]{1,24}$/.test(raw.id) ? raw.id : newId(),
    kind, w, h, x: clamp(raw.x, 0, 100 - w, 0), y: clamp(raw.y, 0, 100 - h, 0),
  };
  if (isTextBox(kind)) {
    box.font = raw.font === "titulo" || raw.font === "texto" ? raw.font : kind === "titulo" ? "titulo" : "texto";
    box.size = Math.round(clamp(raw.size, 16, 240, kind === "titulo" ? 72 : 40));
    box.align = raw.align === "center" || raw.align === "right" ? raw.align : "left";
    box.color = raw.color && ROLE_SET.has(raw.color) ? raw.color : kind === "titulo" ? "texto" : "texto";
    box.maxWords = Math.round(clamp(raw.maxWords, 1, 120, kind === "titulo" ? 12 : 40));
    if (raw.auto === "numero" || raw.auto === "contador") box.auto = raw.auto;
    else if (typeof raw.fixo === "string") box.fixo = raw.fixo.slice(0, 40);
    const op = Math.round(Number(raw.opacity));
    if ([60, 80].includes(op)) box.opacity = op;
    if (raw.italic === true) box.italic = true;
    if (raw.caps === true) box.caps = true;
  }
  return box;
}

/** Limpa um modelo inteiro. `slug` garante que imagem de fundo é do próprio cliente. */
export function cleanTemplate(raw: unknown, slug: string): CarouselTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Partial<CarouselTemplate>;
  const name = String(t.name ?? "").trim().slice(0, 40);
  if (!name) return null;
  const slides = {} as Record<SlideKind, SlideLayout>;
  for (const { key } of SLIDE_KINDS) {
    const s = (t.slides as Partial<Record<SlideKind, Partial<SlideLayout>>> | undefined)?.[key] ?? {};
    const bgRaw = s.bg as SlideBg | undefined;
    let bg: SlideBg = { type: "cor", role: "fundo" };
    if (bgRaw?.type === "imagem" && typeof bgRaw.path === "string" && bgRaw.path.startsWith(`content-media/${slug}/brand/`) && !bgRaw.path.includes("..")) {
      bg = { type: "imagem", path: bgRaw.path, ...(bgRaw.name ? { name: String(bgRaw.name).slice(0, 120) } : {}) };
    } else if (bgRaw?.type === "cor" && BG_ROLES.includes(bgRaw.role)) {
      bg = { type: "cor", role: bgRaw.role };
    }
    const boxes = (Array.isArray(s.boxes) ? s.boxes : []).slice(0, 12).map((b) => cleanBox(b as Partial<TemplateBox>)).filter((b): b is TemplateBox => !!b);
    slides[key] = { bg, boxes };
  }
  const base = t.base === "editorial" || t.base === "lista" || t.base === "foto" ? t.base : undefined;
  return { id: typeof t.id === "string" && /^[\w-]{1,24}$/.test(t.id) ? t.id : newId(), name, slides, ...(base ? { base } : {}) };
}

/** Cor de um papel para desenhar. Sem a cor no kit, usa a de outro papel e avisa (`missing`). */
export function roleColor(k: BrandKit, role: ColorRole): { hex: string; missing: boolean } {
  const hex = colorFor(k, role);
  if (hex) return { hex, missing: false };
  const alt = role === "apoio" ? colorFor(k, "destaque") ?? colorFor(k, "texto") : role === "texto" ? colorFor(k, "destaque") : undefined;
  return { hex: alt ?? (role === "fundo" ? "#e9e9ec" : "#8e8e93"), missing: true };
}

const box = (kind: BoxKind, x: number, y: number, w: number, h: number, extra: Partial<TemplateBox> = {}): TemplateBox => cleanBox({ id: newId(), kind, x, y, w, h, ...extra })!;

/**
 * Os 3 modelos-base, montados só com as cores e fontes do kit. São ponto de partida: a equipe ajusta no editor.
 * Editorial: só texto. Lista: passos numerados. Com foto: foto da pasta do Drive + texto.
 */
export function baseTemplates(): CarouselTemplate[] {
  const logo = (y = 90) => box("logo", 40, y, 20, 5);
  const editorial: CarouselTemplate = {
    id: newId(), name: "Editorial", base: "editorial",
    slides: {
      capa: { bg: { type: "cor", role: "fundo" }, boxes: [
        box("texto", 8, 10, 60, 5, { size: 30, color: "destaque", maxWords: 4 }),
        box("titulo", 8, 34, 84, 34, { size: 104, color: "texto", maxWords: 10 }),
        logo(),
      ] },
      texto: { bg: { type: "cor", role: "fundo" }, boxes: [
        box("titulo", 8, 12, 84, 18, { size: 64, color: "destaque", maxWords: 8 }),
        box("texto", 8, 36, 84, 46, { size: 42, color: "texto", maxWords: 45 }),
        logo(91),
      ] },
      imagem: { bg: { type: "cor", role: "fundo" }, boxes: [
        box("imagem", 8, 8, 84, 52),
        box("titulo", 8, 64, 84, 10, { size: 56, color: "destaque", maxWords: 8 }),
        box("texto", 8, 75, 84, 13, { size: 36, color: "texto", maxWords: 25 }),
      ] },
      final: { bg: { type: "cor", role: "destaque" }, boxes: [
        box("titulo", 8, 30, 84, 24, { size: 88, color: "fundo", align: "center", maxWords: 8 }),
        box("texto", 12, 56, 76, 12, { size: 38, color: "fundo", align: "center", maxWords: 18 }),
        logo(86),
      ] },
    },
  };
  const lista: CarouselTemplate = {
    id: newId(), name: "Lista", base: "lista",
    slides: {
      capa: { bg: { type: "cor", role: "fundo" }, boxes: [
        box("titulo", 8, 26, 84, 36, { size: 100, color: "texto", maxWords: 10 }),
        box("texto", 8, 66, 84, 8, { size: 36, color: "destaque", maxWords: 10 }),
        logo(),
      ] },
      texto: { bg: { type: "cor", role: "fundo" }, boxes: [
        box("titulo", 8, 8, 40, 16, { size: 150, color: "destaque", maxWords: 1, auto: "numero" }),
        box("titulo", 8, 30, 84, 16, { size: 64, color: "texto", maxWords: 8 }),
        box("texto", 8, 50, 84, 34, { size: 40, color: "texto", maxWords: 40 }),
        logo(91),
      ] },
      imagem: { bg: { type: "cor", role: "fundo" }, boxes: [
        box("titulo", 8, 6, 30, 12, { size: 120, color: "destaque", maxWords: 1, auto: "numero" }),
        box("imagem", 8, 22, 84, 44),
        box("titulo", 8, 70, 84, 9, { size: 54, color: "texto", maxWords: 8 }),
        box("texto", 8, 80, 84, 11, { size: 34, color: "texto", maxWords: 25 }),
      ] },
      final: { bg: { type: "cor", role: "destaque" }, boxes: [
        box("titulo", 8, 32, 84, 22, { size: 84, color: "fundo", maxWords: 8 }),
        box("texto", 8, 56, 84, 12, { size: 38, color: "fundo", maxWords: 18 }),
        logo(86),
      ] },
    },
  };
  const foto: CarouselTemplate = {
    id: newId(), name: "Com foto", base: "foto",
    slides: {
      capa: { bg: { type: "cor", role: "fundo" }, boxes: [
        box("imagem", 0, 0, 100, 62),
        box("titulo", 8, 66, 84, 22, { size: 84, color: "texto", maxWords: 10 }),
        logo(91),
      ] },
      texto: { bg: { type: "cor", role: "fundo" }, boxes: [
        box("imagem", 8, 8, 32, 26),
        box("titulo", 8, 40, 84, 14, { size: 60, color: "destaque", maxWords: 8 }),
        box("texto", 8, 56, 84, 30, { size: 40, color: "texto", maxWords: 40 }),
      ] },
      imagem: { bg: { type: "cor", role: "fundo" }, boxes: [
        box("imagem", 0, 0, 100, 72),
        box("texto", 8, 76, 84, 15, { size: 38, color: "texto", maxWords: 25 }),
      ] },
      final: { bg: { type: "cor", role: "destaque" }, boxes: [
        box("imagem", 30, 12, 40, 32),
        box("titulo", 8, 50, 84, 16, { size: 76, color: "fundo", align: "center", maxWords: 8 }),
        box("texto", 12, 68, 76, 10, { size: 36, color: "fundo", align: "center", maxWords: 18 }),
        logo(86),
      ] },
    },
  };
  return [editorial, lista, foto];
}

/** Modelo novo: um ponto de partida simples em cada tipo de slide. */
export function blankTemplate(): CarouselTemplate {
  const b = (kind: BoxKind, x: number, y: number, w: number, h: number, extra: Partial<TemplateBox> = {}) => cleanBox({ kind, x, y, w, h, ...extra })!;
  return {
    id: newId(), name: "",
    slides: {
      capa: { bg: { type: "cor", role: "fundo" }, boxes: [b("titulo", 8, 34, 84, 30, { size: 96 }), b("logo", 40, 90, 20, 5)] },
      texto: { bg: { type: "cor", role: "fundo" }, boxes: [b("titulo", 8, 12, 84, 16, { size: 60, color: "destaque" }), b("texto", 8, 34, 84, 48, { size: 40 })] },
      imagem: { bg: { type: "cor", role: "fundo" }, boxes: [b("imagem", 8, 8, 84, 54), b("texto", 8, 68, 84, 20, { size: 38 })] },
      final: { bg: { type: "cor", role: "destaque" }, boxes: [b("titulo", 8, 34, 84, 20, { size: 80, color: "fundo", align: "center" }), b("logo", 40, 86, 20, 5)] },
    },
  };
}
