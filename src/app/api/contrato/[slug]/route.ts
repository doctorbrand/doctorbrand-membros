import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { calendarAliases, getProject } from "@/lib/project";
import { clientContract, getDoc } from "@/lib/zapsign";

export const dynamic = "force-dynamic";

/** Abre o contrato da ZapSign com um link novo (os da ZapSign valem só 60 minutos). */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await getSession();
  if (!s || (s.role !== "admin" && s.clientSlug !== slug)) return NextResponse.redirect(new URL("/login", req.url));
  const c = await getClient(slug);
  if (!c) return NextResponse.json({ error: "cliente não encontrado" }, { status: 404 });
  const project = await getProject(slug);
  const zs = await clientContract([c.name, ...calendarAliases(slug, project)], project.contrato?.zapsign);
  if (!zs) return project.contrato?.url ? NextResponse.redirect(project.contrato.url) : NextResponse.json({ error: "contrato não encontrado" }, { status: 404 });
  const d = await getDoc(zs.doc.token);
  const file = d.signed_file || d.original_file;
  return file ? NextResponse.redirect(file) : NextResponse.json({ error: "arquivo indisponível" }, { status: 404 });
}
