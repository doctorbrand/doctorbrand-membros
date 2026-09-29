import { NextResponse } from "next/server";
import { COOKIE, USER_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const res = NextResponse.redirect(new URL("/login", url.origin), 303);
  res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(USER_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
