import { get } from "@vercel/blob";
import { getSession } from "@/lib/auth";
import { localDir } from "@/lib/store";

/**
 * Serve mídias privadas do planejamento de conteúdo.
 * Caminho: content-media/<slug>/... — cliente só acessa o próprio slug; equipe acessa tudo.
 * Repassa Range (necessário para vídeo no Safari/iPhone).
 */
export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return new Response("Não autorizado", { status: 401 });
  const p = new URL(req.url).searchParams.get("p") ?? "";
  const m = p.match(/^content-media\/([a-z0-9-]+)\/[^?#]+$/);
  if (!m || p.includes("..")) return new Response("Caminho inválido", { status: 400 });
  if (s.role === "cliente" && s.clientSlug !== m[1]) return new Response("Proibido", { status: 403 });

  const dir = localDir();
  if (dir) {
    const fs = await import("fs/promises");
    const buf = await fs.readFile(`${dir}/${p}`).catch(() => null);
    if (!buf) return new Response("Não encontrado", { status: 404 });
    const ext = p.split(".").pop()?.toLowerCase();
    const type = ext === "mp4" ? "video/mp4" : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": type } });
  }

  const range = req.headers.get("range");
  const res = await get(p, { access: "private", ...(range ? { headers: { range } } : {}) }).catch(() => null);
  if (!res || res.statusCode !== 200 || !res.stream) return new Response("Não encontrado", { status: 404 });

  const headers = new Headers();
  for (const k of ["content-type", "content-length", "content-range", "etag", "last-modified"]) {
    const v = res.headers.get(k);
    if (v) headers.set(k, v);
  }
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, max-age=3600");
  return new Response(res.stream, { status: res.headers.get("content-range") ? 206 : 200, headers });
}
