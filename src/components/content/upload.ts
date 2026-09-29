"use client";

import { upload } from "@vercel/blob/client";

/** Envia um arquivo para o Blob privado (ou para o disco, no teste local) e devolve o caminho. */
export async function uploadMedia(path: string, file: Blob, local: boolean): Promise<string> {
  if (local) {
    const r = await fetch(`/api/content/local-upload?p=${encodeURIComponent(path)}`, { method: "PUT", body: file });
    const j = (await r.json()) as { pathname?: string; error?: string };
    if (!r.ok || !j.pathname) throw new Error(j.error ?? "Falha no envio");
    return j.pathname;
  }
  const b = await upload(path, file, { access: "private", handleUploadUrl: "/api/content/upload", multipart: file.size > 20 * 1024 * 1024 });
  return b.pathname;
}
