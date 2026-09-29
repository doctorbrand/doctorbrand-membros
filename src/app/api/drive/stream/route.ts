import { getSession } from "@/lib/auth";
import { getPosts } from "@/lib/content";
import { driveFetch } from "@/lib/drive";

/**
 * Vídeo do Drive servido pelo nosso domínio, só para o seletor de capa (o navegador precisa do vídeo
 * na mesma origem para capturar o frame). Para assistir, a tela usa o player do Drive, que é mais leve.
 */
export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return new Response("Não autorizado", { status: 401 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[\w-]{10,}$/.test(id)) return new Response("Id inválido", { status: 400 });
  // Cliente só acessa vídeos dos próprios posts (não vira um proxy do Drive).
  if (s.role === "cliente") {
    const posts = s.clientSlug ? await getPosts(s.clientSlug) : [];
    if (!posts.some((p) => p.media.some((m) => m.driveId === id))) return new Response("Proibido", { status: 403 });
  }
  const r = await driveFetch(id, req.headers.get("range"));
  const type = (r.headers.get("content-type") ?? "").split(";")[0];
  if (!r.ok || type === "text/html") return new Response("Arquivo sem acesso no Drive", { status: 404 });
  const headers = new Headers();
  for (const k of ["content-type", "content-length", "content-range"]) {
    const v = r.headers.get(k);
    if (v) headers.set(k, v);
  }
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, max-age=600");
  return new Response(r.body, { status: r.status, headers });
}
