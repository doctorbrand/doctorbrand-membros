import { NextResponse } from "next/server";
import { COOKIE, USER_COOKIE, expectedToken, signUser } from "@/lib/auth";
import { adminHome, clientHome } from "@/lib/home";
import { authenticate } from "@/lib/users";

export async function POST(req: Request) {
  const form = await req.formData();
  const pw = String(form.get("password") ?? "");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const url = new URL(req.url);
  const cookieOpts = { httpOnly: true, sameSite: "lax" as const, secure: url.protocol === "https:", path: "/", maxAge: 60 * 60 * 24 * 90 };
  const fail = () => NextResponse.redirect(new URL("/login?erro=1", url.origin), 303);

  if (email) {
    const u = await authenticate(email, pw);
    if (!u) return fail();
    const res = NextResponse.redirect(new URL(u.role === "cliente" && u.clientSlug ? clientHome(u.clientSlug) : adminHome(), url.origin), 303);
    res.cookies.set(USER_COOKIE, signUser(u.id), cookieOpts);
    res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }
  if (!process.env.PANEL_PASSWORD || pw !== process.env.PANEL_PASSWORD) return fail();
  const res = NextResponse.redirect(new URL(adminHome(), url.origin), 303);
  res.cookies.set(COOKIE, expectedToken(), cookieOpts);
  res.cookies.set(USER_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
