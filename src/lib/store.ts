import { del, get, list, put } from "@vercel/blob";

/**
 * Armazenamento do painel: documentos JSON no Vercel Blob (store privado).
 * Coleções: clients, users, content/<slug>, locks/publish.
 */
const enabled = () => !!process.env.BLOB_READ_WRITE_TOKEN || !!localDir();

/** Só para desenvolvimento local: `LOCAL_STORE_DIR=.data npm run dev` grava os documentos em disco em vez do Blob. */
export const localDir = () => (process.env.NODE_ENV !== "production" && !process.env.BLOB_READ_WRITE_TOKEN ? process.env.LOCAL_STORE_DIR : undefined);

async function localRead(path: string): Promise<string | null> {
  const fs = await import("fs/promises");
  return fs.readFile(`${localDir()}/${path}`, "utf8").catch(() => null);
}

async function localWrite(path: string, body: string): Promise<void> {
  const fs = await import("fs/promises");
  const full = `${localDir()}/${path}`;
  await fs.mkdir(full.slice(0, full.lastIndexOf("/")), { recursive: true });
  await fs.writeFile(full, body);
}

export async function readDoc<T>(path: string, fallback: T): Promise<T> {
  if (!enabled()) return fallback;
  if (localDir()) { const t = await localRead(`${path}.json`); return t ? (JSON.parse(t) as T) : fallback; }
  try {
    const res = await get(`${path}.json`, { access: "private", useCache: false });
    if (!res || res.statusCode !== 200 || !res.stream) return fallback;
    const text = await new Response(res.stream).text();
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export async function writeDoc<T>(path: string, data: T): Promise<void> {
  if (!enabled()) throw new Error("Armazenamento não configurado (BLOB_READ_WRITE_TOKEN).");
  if (localDir()) return localWrite(`${path}.json`, JSON.stringify(data, null, 1));
  await put(`${path}.json`, JSON.stringify(data), { access: "private", contentType: "application/json", allowOverwrite: true, addRandomSuffix: false, cacheControlMaxAge: 60 });
}

export async function deleteDoc(path: string): Promise<void> {
  if (!enabled()) return;
  if (localDir()) { const fs = await import("fs/promises"); await fs.rm(`${localDir()}/${path}.json`, { force: true }); return; }
  await del(`${path}.json`).catch(() => undefined);
}

export async function listDocs(prefix: string): Promise<string[]> {
  if (!enabled() || localDir()) return [];
  const out: string[] = [];
  let cursor: string | undefined;
  do {
    const r = await list({ prefix, cursor, limit: 1000 });
    out.push(...r.blobs.map((b) => b.pathname));
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return out;
}

export const storeEnabled = enabled;
