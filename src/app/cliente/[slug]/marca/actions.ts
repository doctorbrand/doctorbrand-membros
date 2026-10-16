"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getBrand, saveBrand } from "@/lib/brandStore";
import { getClient } from "@/lib/clients";
import { parseDriveLinks } from "@/lib/drive";
import { BASES, corValida, ESTILOS_DOCTORBRAND, MAX_ESTILOS, usaEstilosDoctorbrand, type Base, type Estilo } from "@/lib/laminas";
import type { ActionResult } from "@/lib/types";

const page = (slug: string) => `/cliente/${slug}/marca`;

async function guard(slug: string) {
  const s = await requireAdmin();
  if (!(await getClient(slug))) throw new Error("Cliente não encontrado.");
  return s;
}

/** Regras de texto e pasta de fotos do Drive. */
export async function saveBrandAction(slug: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await guard(slug);
  const str = (k: string) => String(fd.get(k) ?? "").trim();
  const drive = str("driveFolder");
  if (drive && parseDriveLinks(drive).folders.length === 0) return { ok: false, message: "O link da pasta do Drive não parece ser de uma pasta (drive.google.com/drive/folders/...)." };
  await saveBrand(slug, { driveFolder: drive || undefined, rules: str("rules").replace(/\r\n?/g, "\n").slice(0, 6000) }, s.name);
  revalidatePath(page(slug));
  return { ok: true, message: "Kit de marca salvo." };
}

/** Cria ou atualiza um modelo de carrossel: nome, base do desenho, cores, fontes e detalhes. */
export async function saveEstiloAction(slug: string, id: string | null, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await guard(slug);
  const str = (k: string, n = 60) => String(fd.get(k) ?? "").trim().slice(0, n);
  const titulo = str("titulo");
  if (!titulo) return { ok: false, message: "Dê um nome ao modelo." };
  const base = (BASES.some((b) => b.id === str("base")) ? str("base") : "classico") as Base;
  const cores = { fundo: str("cor_fundo").toLowerCase(), texto: str("cor_texto").toLowerCase(), destaque: str("cor_destaque").toLowerCase(), suave: str("cor_suave").toLowerCase() };
  if (!Object.values(cores).every(corValida)) return { ok: false, message: "As cores precisam estar no formato #rrggbb." };
  const fontes = { titulo: str("fonte_titulo", 80) || "Playfair Display", texto: str("fonte_texto", 80) || "Inter" };
  const k = await getBrand(slug);
  const lista = k.estilos ?? [];
  if (lista.some((m) => m.id !== id && m.titulo.toLowerCase() === titulo.toLowerCase())) return { ok: false, message: "Já existe um modelo com esse nome." };
  if (!id && lista.length >= MAX_ESTILOS) return { ok: false, message: `Já são ${MAX_ESTILOS} modelos neste cliente.` };
  const rodape = str("rodape", 40);
  const e: Estilo = {
    id: id ?? crypto.randomUUID().slice(0, 8), titulo, base, cores, fontes,
    ...(fd.get("caixaAlta") ? { tituloCaixaAlta: true } : {}),
    ...(fd.get("fotoPB") ? { fotoPB: true } : {}),
    ...(rodape ? { rodape } : {}),
    ...(fd.get("numerar") ? {} : { semNumero: true }),
    ...(fd.get("arredondar") ? { raioFoto: 22 } : { raioFoto: 0 }),
    addedAt: lista.find((x) => x.id === id)?.addedAt ?? new Date().toISOString(),
  };
  await saveBrand(slug, { estilos: id ? lista.map((x) => (x.id === id ? e : x)) : [...lista, e] }, s.name);
  revalidatePath(page(slug));
  return { ok: true, message: `Modelo salvo: ${e.titulo}.` };
}

export async function removeEstiloAction(slug: string, id: string, _prev: ActionResult | null): Promise<ActionResult> {
  const s = await guard(slug);
  const k = await getBrand(slug);
  await saveBrand(slug, { estilos: (k.estilos ?? []).filter((m) => m.id !== id) }, s.name);
  revalidatePath(page(slug));
  return { ok: true, message: "Modelo tirado deste cliente." };
}

/** Os 5 modelos do design system DoctorBrand (só no kit do Fernando). Não mexe nos que já existem. */
export async function addEstilosDoctorbrandAction(slug: string, _prev: ActionResult | null): Promise<ActionResult> {
  const s = await guard(slug);
  if (!usaEstilosDoctorbrand(slug)) return { ok: false, message: "Estes modelos são só do perfil do Fernando." };
  const k = await getBrand(slug);
  const lista = k.estilos ?? [];
  const novos = ESTILOS_DOCTORBRAND.filter((m) => !lista.some((x) => x.id === m.id || x.titulo.toLowerCase() === m.titulo.toLowerCase()))
    .slice(0, MAX_ESTILOS - lista.length).map((m) => ({ ...m, addedAt: new Date().toISOString() }));
  if (!novos.length) return { ok: false, message: "Os modelos DoctorBrand já estão aqui." };
  await saveBrand(slug, { estilos: [...lista, ...novos] }, s.name);
  revalidatePath(page(slug));
  return { ok: true, message: `${novos.length} ${novos.length === 1 ? "modelo adicionado" : "modelos adicionados"}: ${novos.map((m) => m.titulo).join(", ")}.` };
}
