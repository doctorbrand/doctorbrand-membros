import { NextResponse } from "next/server";
import { getRealSession, PREVIEW_COOKIE } from "@/lib/auth";
import { getClient } from "@/lib/clients";

export const dynamic = "force-dynamic";

/**
 * Liga ou desliga a visualização como cliente (só a equipe).
 *   /api/preview?slug=brunno-bernardo   entra na área inteira como o cliente vê
 *   /api/preview?off=1                  volta à visão da equipe
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const real = await getRealSession();
  if (real?.role !== "admin") return NextResponse.redirect(new URL("/login", req.url));
  const back = url.searchParams.get("volta");
  if (url.searchParams.get("off")) {
    const slug = url.searchParams.get("slug");
    const res = NextResponse.redirect(new URL(back && back.startsWith("/") ? back : slug ? `/cliente/${slug}` : "/conteudo", req.url));
    res.cookies.delete(PREVIEW_COOKIE);
    return res;
  }
  const slug = url.searchParams.get("slug") ?? "";
  const c = await getClient(slug);
  if (!c) return NextResponse.redirect(new URL("/conteudo", req.url));
  const res = NextResponse.redirect(new URL(back && back.startsWith(`/cliente/${slug}`) ? back : `/cliente/${slug}`, req.url));
  res.cookies.set(PREVIEW_COOKIE, slug, { path: "/", httpOnly: true, sameSite: "lax", secure: url.protocol === "https:", maxAge: 8 * 3600 });
  return res;
}
