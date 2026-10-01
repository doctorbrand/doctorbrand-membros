import type { Media } from "./content";

/** Funções de mídia sem dependência de servidor (usadas também no navegador). */

/** Endereço público do Drive (configurável só para testes locais). */
export const DRIVE_WEB = process.env.NEXT_PUBLIC_DRIVE_WEB_URL ?? "https://drive.google.com";

export const mediaKey = (m: Media) => m.driveId ? `drive:${m.driveId}` : `blob:${m.path}`;

/**
 * URL leve para exibir a mídia como imagem.
 * Drive: miniatura gerada pelo próprio Drive (também para vídeo), no tamanho pedido.
 * Blob: a própria imagem (vídeo do Blob não tem miniatura: use a capa).
 */
export function mediaUrl(m: Media | undefined, width = 1080): string | undefined {
  if (!m) return undefined;
  if (m.driveId) return `${DRIVE_WEB}/thumbnail?id=${encodeURIComponent(m.driveId)}&sz=w${width}`;
  return m.path ? `/api/media?p=${encodeURIComponent(m.path)}` : undefined;
}

/**
 * Vídeo tocável. Drive: player nativo pelo nosso domínio (encaixa no 9:16 como no Instagram);
 * se o arquivo não estiver aberto por link, cai para o player do Drive.
 */
export function videoSource(m: Media): { iframe?: string; src?: string } {
  if (m.driveId) return { src: `/api/drive/stream?id=${encodeURIComponent(m.driveId)}`, iframe: `${DRIVE_WEB}/file/d/${encodeURIComponent(m.driveId)}/preview` };
  return { src: m.path ? `/api/media?p=${encodeURIComponent(m.path)}` : undefined };
}

/** Fonte do vídeo no mesmo domínio (para escolher frame de capa no navegador). */
export function sameOriginVideo(m: Media): string | undefined {
  if (m.driveId) return `/api/drive/stream?id=${encodeURIComponent(m.driveId)}`;
  return m.path ? `/api/media?p=${encodeURIComponent(m.path)}` : undefined;
}

