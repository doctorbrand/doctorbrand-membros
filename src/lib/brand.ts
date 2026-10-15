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
  /** Caminho do arquivo no Blob, quando source = arquivo. */
  path?: string;
  /** Peso usado nos slides (400, 500, 600, 700…). */
  weight?: number;
}

export interface BrandKit {
  logos: Partial<Record<LogoKey, { path: string; name?: string }>>;
  colors: BrandColor[];
  fonts: { titulo?: BrandFont; texto?: BrandFont };
  /** Link da pasta de fotos no Google Drive (compartilhada por link). */
  driveFolder?: string;
  /** Regras visuais e de conteúdo, uma por linha. O Claude respeita na hora de gerar. */
  rules?: string;
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
    { label: "Fontes", done: !!k.fonts.titulo?.family && !!k.fonts.texto?.family },
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
