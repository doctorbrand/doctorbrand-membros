import { getOrder } from "@/lib/orders";
import { verifySigned } from "@/lib/signed";

export const dynamic = "force-dynamic";

/** Pedido de conteúdo completo, por link assinado e temporário, para o Claude ler sem login. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const c = u.searchParams.get("c") ?? "", id = u.searchParams.get("id") ?? "";
  if (!/^[a-z0-9-]+$/.test(c) || !/^[\w-]{10,}$/.test(id)) return new Response("Pedido inválido", { status: 400 });
  if (!verifySigned(`pedido/${c}/${id}`, u.searchParams.get("e"), u.searchParams.get("s"))) return new Response("Link expirado ou inválido", { status: 403 });
  const o = await getOrder(c, id);
  if (!o?.texto) return new Response("Pedido não encontrado", { status: 404 });
  return new Response(o.texto, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
