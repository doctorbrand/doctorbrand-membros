import { put } from "@vercel/blob";
import type { Media } from "./content";
import { localDir } from "./store";

/**
 * Leitura do Google Drive sem OAuth: arquivos e pastas compartilhados como "qualquer pessoa com o link".
 * - Exibição: miniatura e player do próprio Drive (leves, streaming).
 * - Publicação: baixa o original (sem compressão) e copia para o Blob privado.
 * Com GOOGLE_API_KEY (grátis) usa a Drive API para metadados e listagem de pasta; sem ela, lê as páginas públicas.
 */

const USERCONTENT = process.env.DRIVE_USERCONTENT_URL ?? "https://drive.usercontent.google.com";
const WEB = process.env.DRIVE_WEB_URL ?? "https://drive.google.com";
const API = process.env.DRIVE_API_URL ?? "https://www.googleapis.com/drive/v3";
const key = () => process.env.GOOGLE_API_KEY;

export interface DriveFile { id: string; name: string; mime: string }
export const FOLDER = "application/vnd.google-apps.folder";

/** Extrai ids de arquivos e pastas de links colados (um por linha ou separados por espaço). */
export function parseDriveLinks(text: string): { files: string[]; folders: string[] } {
  const files: string[] = [];
  const folders: string[] = [];
  for (const raw of text.split(/\s+/).filter(Boolean)) {
    const folder = raw.match(/\/folders\/([\w-]{10,})/);
    if (folder) { folders.push(folder[1]); continue; }
    const file = raw.match(/\/file\/d\/([\w-]{10,})/) ?? raw.match(/[?&]id=([\w-]{10,})/) ?? raw.match(/^([\w-]{25,})$/);
    if (file) files.push(file[1]);
  }
  return { files: [...new Set(files)], folders: [...new Set(folders)] };
}

const downloadUrl = (id: string) => `${USERCONTENT}/download?id=${encodeURIComponent(id)}&export=download&confirm=t`;

function nameFromDisposition(v: string | null): string | undefined {
  if (!v) return undefined;
  const star = v.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) return decodeURIComponent(star[1]);
  return v.match(/filename="?([^";]+)"?/i)?.[1];
}

/** Nome e tipo de um arquivo. */
export async function driveFileInfo(id: string): Promise<DriveFile> {
  if (key()) {
    const r = await fetch(`${API}/files/${encodeURIComponent(id)}?fields=id,name,mimeType&supportsAllDrives=true&key=${key()}`, { cache: "no-store" });
    const j = (await r.json().catch(() => ({}))) as { name?: string; mimeType?: string; error?: { message?: string } };
    if (r.ok && j.mimeType) return { id, name: j.name ?? id, mime: j.mimeType };
  }
  const r = await fetch(downloadUrl(id), { headers: { range: "bytes=0-0" }, cache: "no-store" });
  const mime = (r.headers.get("content-type") ?? "").split(";")[0].trim();
  void r.body?.cancel().catch(() => undefined); // não esperar: no Next o cancel pode travar
  if (!r.ok || !mime || mime === "text/html") throw new Error("Arquivo do Drive sem acesso. Compartilhe como “qualquer pessoa com o link”.");
  return { id, name: nameFromDisposition(r.headers.get("content-disposition")) ?? id, mime };
}

/** Arquivos de uma pasta pública, em ordem de nome. */
export async function driveFolderFiles(folderId: string): Promise<DriveFile[]> {
  if (key()) {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
    const r = await fetch(`${API}/files?q=${q}&fields=files(id,name,mimeType)&orderBy=name_natural&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true&key=${key()}`, { cache: "no-store" });
    const j = (await r.json().catch(() => ({}))) as { files?: { id: string; name: string; mimeType: string }[] };
    if (r.ok && j.files) return j.files.map((f) => ({ id: f.id, name: f.name, mime: f.mimeType }));
  }
  const r = await fetch(`${WEB}/embeddedfolderview?id=${encodeURIComponent(folderId)}`, { cache: "no-store" });
  const html = r.ok ? await r.text() : "";
  const entries = [...html.matchAll(/id="entry-([\w-]{10,})"[\s\S]*?href="([^"]*)"[\s\S]*?class="flip-entry-title">([^<]+)</g)];
  if (entries.length === 0) throw new Error("Não consegui ler a pasta. Compartilhe como “qualquer pessoa com o link” (ou cole os links dos arquivos).");
  const files = await Promise.all(entries.map(async ([, id, href, name]) => {
    const n = decodeEntities(name.trim());
    if (/\/folders\//.test(href)) return { id, name: n, mime: FOLDER };
    if (/\.txt$/i.test(n)) return { id, name: n, mime: "text/plain" };
    return driveFileInfo(id).then((f) => ({ ...f, name: n }), () => ({ id, name: n, mime: "application/octet-stream" }));
  }));
  return files.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
}

function decodeEntities(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

export async function driveText(id: string): Promise<string> {
  const r = await fetch(downloadUrl(id), { cache: "no-store" });
  if (!r.ok) throw new Error("Não consegui ler o arquivo de texto do Drive.");
  return (await r.text()).trim();
}

export function toMedia(f: DriveFile): Media | null {
  if (f.mime.startsWith("video/")) return { driveId: f.id, kind: "video", name: f.name, mime: f.mime };
  if (f.mime.startsWith("image/")) return { driveId: f.id, kind: "image", name: f.name, mime: f.mime };
  return null;
}

/** Stream do arquivo (para o seletor de capa e para copiar). Repassa Range. */
export async function driveFetch(id: string, range?: string | null): Promise<Response> {
  return fetch(downloadUrl(id), { headers: range ? { range } : {}, cache: "no-store" });
}

/** Copia o original do Drive para o Blob privado (qualidade intacta) e devolve a mídia com `path`. */
export async function copyDriveToBlob(slug: string, m: Media): Promise<Media> {
  if (!m.driveId || m.path) return m;
  const r = await driveFetch(m.driveId);
  const type = (r.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!r.ok || !r.body || type === "text/html") throw new Error(`Não consegui baixar “${m.name ?? m.driveId}” do Drive. Confira o compartilhamento.`);
  // O Instagram só publica imagem em JPG: PNG (capa ou carrossel) vira JPG aqui, sem perder qualidade visível.
  const converte = m.kind === "image" && type !== "image/jpeg";
  const ext = m.kind === "video" ? "mp4" : "jpg";
  const path = `content-media/${slug}/drive/${m.driveId}.${ext}`;
  const body: ReadableStream<Uint8Array> | Buffer = converte ? await toJpeg(Buffer.from(await r.arrayBuffer())) : r.body;
  const dir = localDir();
  if (dir) {
    const fs = await import("fs/promises");
    await fs.mkdir(`${dir}/content-media/${slug}/drive`, { recursive: true });
    await fs.writeFile(`${dir}/${path}`, Buffer.isBuffer(body) ? new Uint8Array(body) : new Uint8Array(await new Response(body).arrayBuffer()));
  } else {
    await put(path, body, { access: "private", contentType: converte ? "image/jpeg" : type || undefined, multipart: true, allowOverwrite: true, addRandomSuffix: false });
  }
  return { ...m, path, ...(converte ? { mime: "image/jpeg" } : {}) };
}

/** PNG, WebP etc. para JPG (fundo branco onde houver transparência). */
export async function toJpeg(input: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp(input).rotate().flatten({ background: "#ffffff" }).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
}
