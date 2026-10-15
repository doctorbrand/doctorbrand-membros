"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getBrand, saveBrand, saveTemplates } from "@/lib/brandStore";
import { baseTemplates, cleanTemplate, colorFor, COLOR_ROLES, LOGO_SLOTS, MAX_COLORS, MAX_TEMPLATES, normalizeHex, type BrandColor, type BrandFont, type ColorRole, type LogoKey } from "@/lib/brand";
import { getClient } from "@/lib/clients";
import { BRAND_PRESETS } from "@/lib/brandPresets";
import { parseDriveLinks } from "@/lib/drive";
import type { ActionResult } from "@/lib/types";

const page = (slug: string) => `/cliente/${slug}/marca`;
const ROLES = new Set(COLOR_ROLES.map((r) => r.key));

async function guard(slug: string) {
  const s = await requireAdmin();
  if (!(await getClient(slug))) throw new Error("Cliente não encontrado.");
  return s;
}

/** Cores, fontes, pasta do Drive e regras (tudo que é texto). */
export async function saveBrandAction(slug: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await guard(slug);
  const str = (k: string) => String(fd.get(k) ?? "").trim();

  const colors: BrandColor[] = [];
  for (let i = 0; i < MAX_COLORS; i++) {
    const raw = str(`color_hex_${i}`);
    if (!raw) continue;
    const hex = normalizeHex(raw);
    if (!hex) return { ok: false, message: `Cor ${i + 1}: "${raw}" não é um código válido (ex.: #1a1a1a).` };
    const role = str(`color_role_${i}`) as ColorRole;
    colors.push({ hex, name: str(`color_name_${i}`) || hex, role: ROLES.has(role) ? role : "apoio" });
  }

  const cur = await getBrand(slug);
  const font = (k: "titulo" | "texto"): BrandFont | undefined => {
    const family = str(`font_${k}_family`);
    const prev = cur.fonts[k];
    if (!family && !prev?.path) return undefined;
    const w = Number(str(`font_${k}_weight`));
    return { family: family || prev?.family || "", source: prev?.path ? "arquivo" : "google", path: prev?.path, weight: Number.isFinite(w) && w >= 100 && w <= 900 ? Math.round(w / 100) * 100 : undefined };
  };

  const drive = str("driveFolder");
  if (drive && parseDriveLinks(drive).folders.length === 0) return { ok: false, message: "O link da pasta do Drive não parece ser de uma pasta (drive.google.com/drive/folders/...)." };

  await saveBrand(slug, { colors, fonts: { titulo: font("titulo"), texto: font("texto") }, driveFolder: drive || undefined, rules: str("rules").replace(/\r\n?/g, "\n") }, s.name);
  revalidatePath(page(slug));
  return { ok: true, message: "Kit de marca salvo." };
}

/** Grava o caminho de um arquivo que o navegador acabou de enviar ao Blob (logo ou fonte). */
export async function setBrandFileAction(slug: string, slot: string, path: string, name: string): Promise<ActionResult> {
  const s = await guard(slug);
  if (!path.startsWith(`content-media/${slug}/brand/`) || path.includes("..")) return { ok: false, message: "Arquivo inválido." };
  const cur = await getBrand(slug);
  if (LOGO_SLOTS.some((l) => l.key === slot)) {
    await saveBrand(slug, { logos: { ...cur.logos, [slot as LogoKey]: { path, name } } }, s.name);
  } else if (slot === "font_titulo" || slot === "font_texto") {
    const k = slot === "font_titulo" ? "titulo" : "texto";
    const family = cur.fonts[k]?.family || name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
    await saveBrand(slug, { fonts: { ...cur.fonts, [k]: { ...cur.fonts[k], family, source: "arquivo", path } } }, s.name);
  } else {
    return { ok: false, message: "Campo desconhecido." };
  }
  revalidatePath(page(slug));
  return { ok: true, message: "Arquivo salvo." };
}

/** Tira um logo ou volta uma fonte enviada para o Google Fonts. */
export async function clearBrandFileAction(slug: string, slot: string): Promise<ActionResult> {
  const s = await guard(slug);
  const cur = await getBrand(slug);
  if (LOGO_SLOTS.some((l) => l.key === slot)) {
    const logos = { ...cur.logos };
    delete logos[slot as LogoKey];
    await saveBrand(slug, { logos }, s.name);
  } else if (slot === "font_titulo" || slot === "font_texto") {
    const k = slot === "font_titulo" ? "titulo" : "texto";
    const f = cur.fonts[k];
    await saveBrand(slug, { fonts: { ...cur.fonts, [k]: f ? { family: f.family, source: "google", weight: f.weight } : undefined } }, s.name);
  }
  revalidatePath(page(slug));
  return { ok: true, message: "Removido." };
}

// ─── Modelos de carrossel ────────────────────────────────────────────────

/** Salva (cria ou atualiza) um modelo. O editor manda o modelo inteiro em JSON. */
export async function saveTemplateAction(slug: string, json: string): Promise<ActionResult & { id?: string }> {
  const s = await guard(slug);
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { return { ok: false, message: "Modelo inválido." }; }
  const t = cleanTemplate(raw, slug);
  if (!t) return { ok: false, message: "Dê um nome ao modelo." };
  const list = (await getBrand(slug)).templates ?? [];
  const i = list.findIndex((x) => x.id === t.id);
  if (i < 0 && list.length >= MAX_TEMPLATES) return { ok: false, message: `Já são ${MAX_TEMPLATES} modelos. Apague um para criar outro.` };
  if (list.some((x) => x.id !== t.id && x.name.toLowerCase() === t.name.toLowerCase())) return { ok: false, message: "Já existe um modelo com esse nome." };
  const next = { ...t, updatedAt: new Date().toISOString() };
  await saveTemplates(slug, i < 0 ? [...list, next] : list.map((x) => (x.id === t.id ? next : x)), s.name);
  revalidatePath(page(slug));
  return { ok: true, message: "Modelo salvo.", id: t.id };
}

export async function deleteTemplateAction(slug: string, id: string): Promise<ActionResult> {
  const s = await guard(slug);
  const list = (await getBrand(slug)).templates ?? [];
  if (!list.some((x) => x.id === id)) return { ok: false, message: "Modelo não encontrado." };
  await saveTemplates(slug, list.filter((x) => x.id !== id), s.name);
  revalidatePath(page(slug));
  return { ok: true, message: "Modelo apagado." };
}

/** Cria os modelos-base (Editorial, Lista, Com foto) nos espaços livres, com as cores do kit. */
export async function createBaseTemplatesAction(slug: string): Promise<ActionResult> {
  const s = await guard(slug);
  const k = await getBrand(slug);
  const faltam = (["fundo", "texto", "destaque"] as ColorRole[]).filter((r) => !colorFor(k, r));
  if (faltam.length) return { ok: false, message: `Cadastre e salve as cores de ${faltam.join(", ")} antes de criar os modelos.` };
  const list = k.templates ?? [];
  const livres = MAX_TEMPLATES - list.length;
  if (livres <= 0) return { ok: false, message: `Já são ${MAX_TEMPLATES} modelos. Apague um para criar os modelos-base.` };
  const nomes = new Set(list.map((t) => t.name.toLowerCase()));
  const novos = baseTemplates().filter((t) => !nomes.has(t.name.toLowerCase())).slice(0, livres).map((t) => ({ ...t, updatedAt: new Date().toISOString() }));
  if (!novos.length) return { ok: false, message: "Os modelos-base já existem." };
  await saveTemplates(slug, [...list, ...novos], s.name);
  revalidatePath(page(slug));
  return { ok: true, message: `${novos.length} ${novos.length === 1 ? "modelo criado" : "modelos criados"}: ${novos.map((t) => t.name).join(", ")}.` };
}

/**
 * Carrega os modelos levantados do Canva do cliente (lib/brandPresets.ts) e a paleta usada neles.
 * Substitui os modelos atuais; as outras cores do kit (fora dos 4 papéis da paleta) ficam.
 */
export async function applyPresetAction(slug: string): Promise<ActionResult> {
  const s = await guard(slug);
  const preset = BRAND_PRESETS[slug];
  if (!preset) return { ok: false, message: "Este cliente não tem modelos do Canva cadastrados." };
  const k = await getBrand(slug);
  const roles = new Set(preset.colors.map((c) => c.role));
  const colors = [...preset.colors, ...k.colors.filter((c) => !roles.has(c.role))].slice(0, MAX_COLORS);
  await saveBrand(slug, { colors }, s.name);
  const now = new Date().toISOString();
  await saveTemplates(slug, preset.templates().map((t) => ({ ...t, updatedAt: now })), s.name);
  revalidatePath(page(slug));
  return { ok: true, message: `Modelos do Canva carregados (${preset.templates().map((t) => t.name).join(", ")}) e cores atualizadas.` };
}
