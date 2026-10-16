"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getBrand, saveBrand } from "@/lib/brandStore";
import { lerCampos, MAX_MODELOS, type CanvaModelo } from "@/lib/brand";
import { MODELOS_DOCTORBRAND, usaModelosDoctorbrand } from "@/lib/canvaPresets";
import { getClient } from "@/lib/clients";
import { parseDriveLinks } from "@/lib/drive";
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

/** Cria ou atualiza um modelo do Canva: nome, link e as colunas da planilha (uma por linha: "capa_titulo 10"). */
export async function saveModeloAction(slug: string, id: string | null, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await guard(slug);
  const titulo = String(fd.get("titulo") ?? "").trim().slice(0, 60);
  const link = String(fd.get("link") ?? "").trim();
  const campos = lerCampos(String(fd.get("campos") ?? ""));
  if (!titulo) return { ok: false, message: "Dê um nome ao modelo." };
  if (link && !/^https:\/\/(www\.)?canva\.com\//.test(link)) return { ok: false, message: "O link precisa ser do Canva (https://www.canva.com/...)." };
  if (!campos.some((c) => c.tipo === "text")) return { ok: false, message: "O modelo precisa de pelo menos um texto (ex.: capa_titulo, até 10 palavras)." };
  const k = await getBrand(slug);
  const lista = k.canvaModelos ?? [];
  if (lista.some((m) => m.id !== id && m.titulo.toLowerCase() === titulo.toLowerCase())) return { ok: false, message: "Já existe um modelo com esse nome." };
  if (!id && lista.length >= MAX_MODELOS) return { ok: false, message: `Já são ${MAX_MODELOS} modelos neste cliente.` };
  const m: CanvaModelo = { id: id ?? crypto.randomUUID().slice(0, 8), titulo, ...(link ? { link } : {}), campos, addedAt: new Date().toISOString() };
  await saveBrand(slug, { canvaModelos: id ? lista.map((x) => (x.id === id ? m : x)) : [...lista, m] }, s.name);
  revalidatePath(page(slug));
  return { ok: true, message: `Modelo salvo: ${m.titulo}.` };
}

export async function removeModeloAction(slug: string, id: string, _prev: ActionResult | null): Promise<ActionResult> {
  const s = await guard(slug);
  const k = await getBrand(slug);
  await saveBrand(slug, { canvaModelos: (k.canvaModelos ?? []).filter((m) => m.id !== id) }, s.name);
  revalidatePath(page(slug));
  return { ok: true, message: "Modelo tirado deste cliente. No Canva ele continua igual." };
}

/** Os 5 modelos do design system DoctorBrand (só no kit do Fernando). Não mexe nos que já existem. */
export async function addModelosDoctorbrandAction(slug: string, _prev: ActionResult | null): Promise<ActionResult> {
  const s = await guard(slug);
  if (!usaModelosDoctorbrand(slug)) return { ok: false, message: "Estes modelos são só do perfil do Fernando." };
  const k = await getBrand(slug);
  const lista = k.canvaModelos ?? [];
  const novos = MODELOS_DOCTORBRAND.filter((m) => !lista.some((x) => x.id === m.id || x.titulo.toLowerCase() === m.titulo.toLowerCase()))
    .slice(0, MAX_MODELOS - lista.length).map((m) => ({ ...m, addedAt: new Date().toISOString() }));
  if (!novos.length) return { ok: false, message: "Os modelos DoctorBrand já estão aqui." };
  await saveBrand(slug, { canvaModelos: [...lista, ...novos] }, s.name);
  revalidatePath(page(slug));
  return { ok: true, message: `${novos.length} ${novos.length === 1 ? "modelo adicionado" : "modelos adicionados"}: ${novos.map((m) => m.titulo).join(", ")}. Cole o link de cada um no Canva.` };
}
