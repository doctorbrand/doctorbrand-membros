/**
 * Kit de marca do cliente na área de membros. O desenho dos carrosséis mora no Canva (um ou mais modelos e uma
 * pasta por cliente); aqui ficam os links para eles, o tom de voz e as regras que o Claude lê antes de escrever, e a
 * pasta de fotos do Drive. O Estúdio de Carrosséis lê este kit pelo conector da área.
 * Guardado no Blob em `marca/<slug>` (leitura e escrita em brandStore.ts). Este arquivo vale também no navegador.
 */

/** Um modelo de carrossel do cliente no Canva (um design): nome (ex.: Editorial) e link. */
export interface ModeloCanva {
  nome: string;
  link: string;
}

export const MAX_MODELOS = 8;

export interface BrandKit {
  /** Link da pasta de fotos no Google Drive (compartilhada por link). Fotos do cliente para os carrosséis. */
  driveFolder?: string;
  /** Regras de texto e de marca, uma por linha. O Claude lê antes de escrever. */
  rules?: string;
  /** Modelos de carrossel do cliente no Canva, na ordem (o primeiro é o padrão). O Estúdio monta cada carrossel com um deles. */
  canvaModelos?: ModeloCanva[];
  /** Formato antigo, um modelo só. Lido por modelosDoKit; ao salvar o kit vira canvaModelos. */
  canvaModelo?: string;
  /** Pasta do cliente no Canva (id), onde o Estúdio guarda os carrosséis montados. */
  canvaPasta?: string;
  updatedAt?: string;
  updatedBy?: string;
}

/** Os modelos do cliente no Canva, do formato novo (lista) ou do antigo (um link só). */
export function modelosDoKit(k: BrandKit): ModeloCanva[] {
  const lista = (k.canvaModelos ?? []).filter((m) => m && m.link);
  if (lista.length) return lista;
  return k.canvaModelo ? [{ nome: "Modelo", link: k.canvaModelo }] : [];
}

/** Quanto do kit está pronto, por item. Usado no topo da página. */
export function brandChecklist(k: BrandKit): { label: string; done: boolean }[] {
  return [
    { label: "Modelo no Canva", done: modelosDoKit(k).length > 0 },
    { label: "Tom de voz e regras", done: !!k.rules?.trim() },
    { label: "Pasta de fotos", done: !!k.driveFolder },
  ];
}

/** Tipo de conteúdo pelo nome do arquivo (para servir arquivos antigos do kit, como logos e fontes). */
export function brandMime(path: string): string | undefined {
  const ext = path.split(".").pop()?.toLowerCase();
  return ({ png: "image/png", svg: "image/svg+xml", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", ttf: "font/ttf", otf: "font/otf", woff2: "font/woff2", woff: "font/woff" } as Record<string, string>)[ext ?? ""];
}
