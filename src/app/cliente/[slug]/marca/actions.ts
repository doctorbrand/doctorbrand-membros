"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { saveBrand } from "@/lib/brandStore";
import { getClient } from "@/lib/clients";
import { parseDriveLinks } from "@/lib/drive";
import { MAX_MODELOS, type ModeloCanva } from "@/lib/brand";
import { problemaLinkModelo } from "@/lib/studio";
import type { ActionResult } from "@/lib/types";

const page = (slug: string) => `/cliente/${slug}/marca`;

/** Id da pasta do Canva a partir do link (canva.com/folder/<id>) ou do próprio id. */
function pastaCanva(v: string): string | undefined | null {
  if (!v) return undefined;
  const m = v.match(/canva\.com\/folder\/([\w-]+)/i);
  if (m) return m[1];
  return /^[\w-]{4,80}$/.test(v) ? v : null;
}

/** Lê as linhas de modelo do formulário (nome e link, na ordem). Linha sem link é ignorada. */
function lerModelos(fd: FormData): ModeloCanva[] | string {
  const nomes = fd.getAll("modeloNome").map((v) => String(v).trim());
  const links = fd.getAll("modeloLink").map((v) => String(v).trim());
  const out: ModeloCanva[] = [];
  for (let i = 0; i < links.length; i++) {
    const link = links[i].slice(0, 500);
    if (!link) continue;
    const nome = (nomes[i] || `Modelo ${out.length + 1}`).replace(/\s+/g, " ").slice(0, 40);
    const erro = problemaLinkModelo(link);
    if (erro) return `${nome}: ${erro}`;
    if (out.some((m) => m.nome.toLowerCase() === nome.toLowerCase())) return `Há dois modelos com o nome “${nome}”. Use um nome para cada.`;
    out.push({ nome, link });
  }
  if (out.length > MAX_MODELOS) return `Até ${MAX_MODELOS} modelos por cliente.`;
  return out;
}

/** Canva (modelos e pasta), tom de voz e regras, e pasta de fotos do Drive. */
export async function saveBrandAction(slug: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await requireAdmin();
  if (!(await getClient(slug))) return { ok: false, message: "Cliente não encontrado." };
  const str = (k: string) => String(fd.get(k) ?? "").trim();
  const drive = str("driveFolder");
  if (drive && parseDriveLinks(drive).folders.length === 0) return { ok: false, message: "O link da pasta do Drive não parece ser de uma pasta (drive.google.com/drive/folders/...)." };
  const modelos = lerModelos(fd);
  if (typeof modelos === "string") return { ok: false, message: modelos };
  const pasta = pastaCanva(str("canvaPasta"));
  if (pasta === null) return { ok: false, message: "A pasta do Canva precisa ser o link da pasta (canva.com/folder/...) ou o id dela." };
  await saveBrand(slug, {
    driveFolder: drive || undefined,
    rules: str("rules").replace(/\r\n?/g, "\n").slice(0, 6000),
    canvaModelos: modelos,
    canvaModelo: undefined,
    canvaPasta: pasta,
  }, s.name);
  revalidatePath(page(slug));
  return { ok: true, message: "Kit de marca salvo." };
}
