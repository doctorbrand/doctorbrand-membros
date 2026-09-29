import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { localDir } from "@/lib/store";

/** Só no teste local (LOCAL_STORE_DIR): recebe o arquivo e grava em disco. Em produção responde 404. */
export async function PUT(req: Request) {
  const dir = localDir();
  if (!dir) return NextResponse.json({ error: "indisponível" }, { status: 404 });
  const s = await getSession();
  const p = new URL(req.url).searchParams.get("p") ?? "";
  const m = p.match(/^content-media\/([a-z0-9-]+)\/[^?#]+$/);
  if (!s || !m || p.includes("..")) return NextResponse.json({ error: "Caminho inválido" }, { status: 400 });
  if (s.role === "cliente" && (s.clientSlug !== m[1] || !p.startsWith(`content-media/${m[1]}/covers/`))) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const dot = p.lastIndexOf(".");
  const path = `${p.slice(0, dot)}-${Math.random().toString(36).slice(2, 8)}${p.slice(dot)}`;
  const fs = await import("fs/promises");
  await fs.mkdir(`${dir}/${path.slice(0, path.lastIndexOf("/"))}`, { recursive: true });
  await fs.writeFile(`${dir}/${path}`, new Uint8Array(await req.arrayBuffer()));
  return NextResponse.json({ pathname: path });
}
