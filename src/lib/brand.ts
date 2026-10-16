/**
 * Kit de marca do cliente na área de membros: os modelos de carrossel (cores, fontes e base do desenho,
 * usados para montar as lâminas e o arquivo que abre no Canva), as regras de texto que o Claude lê antes
 * de escrever e a pasta de fotos do Drive.
 * Guardado no Blob em `marca/<slug>` (leitura e escrita em brandStore.ts). Este arquivo vale também no navegador.
 */

import type { Estilo } from "./laminas";

export interface BrandKit {
  /** Link da pasta de fotos no Google Drive (compartilhada por link). É dela que saem as fotos das lâminas. */
  driveFolder?: string;
  /** Regras de texto e de marca, uma por linha. O Claude lê antes de escrever. */
  rules?: string;
  /** Modelos de carrossel deste cliente (cores, fontes e base do desenho). */
  estilos?: Estilo[];
  updatedAt?: string;
  updatedBy?: string;
}

/** Quanto do kit está pronto, por item. Usado no topo da página. */
export function brandChecklist(k: BrandKit): { label: string; done: boolean }[] {
  return [
    { label: "Modelo de carrossel", done: (k.estilos ?? []).length > 0 },
    { label: "Regras de texto", done: !!k.rules?.trim() },
    { label: "Pasta de fotos", done: !!k.driveFolder },
  ];
}

/** Tipo de conteúdo pelo nome do arquivo (para servir arquivos antigos do kit, como logos e fontes). */
export function brandMime(path: string): string | undefined {
  const ext = path.split(".").pop()?.toLowerCase();
  return ({ png: "image/png", svg: "image/svg+xml", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", ttf: "font/ttf", otf: "font/otf", woff2: "font/woff2", woff: "font/woff" } as Record<string, string>)[ext ?? ""];
}
