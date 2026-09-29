import { get } from "@vercel/blob";
import { verifySigned } from "@/lib/signed";
import { localDir } from "@/lib/store";

/** Download público e temporário de uma mídia (link assinado), usado pela Meta ao publicar. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const p = u.searchParams.get("p") ?? "";
  if (!/^content-media\/[a-z0-9-]+\/[^?#]+$/.test(p) || p.includes("..")) return new Response("Caminho inválido", { status: 400 });
  if (!verifySigned(p, u.searchParams.get("e"), u.searchParams.get("s"))) return new Response("Link expirado ou inválido", { status: 403 });

  const dir = localDir();
  if (dir) {
    const fs = await import("fs/promises");
    const buf = await fs.readFile(`${dir}/${p}`).catch(() => null);
    return buf ? new Response(new Uint8Array(buf), { headers: { "Content-Type": p.endsWith(".mp4") ? "video/mp4" : "image/jpeg" } }) : new Response("Não encontrado", { status: 404 });
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
  headers.set("Cache-Control", "no-store");
  return new Response(res.stream, { status: res.headers.get("content-range") ? 206 : 200, headers });
}
