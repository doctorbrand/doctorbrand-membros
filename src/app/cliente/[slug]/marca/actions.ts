"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getBrand, saveBrand, saveTemplates } from "@/lib/brandStore";
import { baseTemplates, cleanTemplate, colorFor, COLOR_ROLES, fontFamilyFromFile, fontFiles, fontFileStyle, LOGO_SLOTS, MAX_COLORS, MAX_TEMPLATES, normalizeHex, type BrandColor, type BrandFont, type ColorRole, type FontSlot, type LogoKey } from "@/lib/brand";
import { getClient } from "@/lib/clients";
import { parseDriveLinks } from "@/lib/drive";
import type { ActionResult } from "@/lib/types";

const page = (slug: string) => `/cliente/${slug}/marca`;
const FONT_SLOTS: Record<string, FontSlot> = { font_titulo: "titulo", font_texto: "texto", font_script: "script" };
const fontSlot = (slot: string): FontSlot | undefined => (Object.hasOwn(FONT_SLOTS, slot) ? FONT_SLOTS[slot] : undefined);
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
  const font = (k: FontSlot): BrandFont | undefined => {
    const family = str(`font_${k}_family`);
    const prev = cur.fonts[k];
    // Vaga que não está no formulário (script, quando o kit não usa modelos fixos): fica como está.
    if (!fd.has(`font_${k}_family`)) return prev;
    const arquivo = prev?.source === "arquivo" && !!prev.path;
    if (!family && !arquivo) return undefined;
    const w = Number(str(`font_${k}_weight`));
    return { ...(arquivo ? prev : {}), family: family || prev?.family || "", source: arquivo ? "arquivo" : "google", weight: Number.isFinite(w) && w >= 100 && w <= 900 ? Math.round(w / 100) * 100 : undefined };
  };

  const drive = str("driveFolder");
  if (drive && parseDriveLinks(drive).folders.length === 0) return { ok: false, message: "O link da pasta do Drive não parece ser de uma pasta (drive.google.com/drive/folders/...)." };

  await saveBrand(slug, { colors, fonts: { titulo: font("titulo"), texto: font("texto"), script: font("script") }, driveFolder: drive || undefined, rules: str("rules").replace(/\r\n?/g, "\n") }, s.name);
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
  } else if (fontSlot(slot)) {
    // Cada arquivo é uma variante da família (Light, Regular, itálico…): soma às que já estão; mesmo peso e estilo, troca.
    const k = fontSlot(slot)!;
    const prev = cur.fonts[k];
    const { weight, italic } = fontFileStyle(name);
    const files = [...fontFiles(prev).filter((f) => !(f.weight === weight && !!f.italic === italic)), { path, weight, ...(italic ? { italic } : {}) }]
      .sort((a, b) => a.weight - b.weight || Number(!!a.italic) - Number(!!b.italic));
    const regular = files.find((f) => f.weight === (prev?.weight ?? 400) && !f.italic) ?? files.find((f) => !f.italic) ?? files[0];
    const family = prev?.source === "arquivo" && prev.family ? prev.family : fontFamilyFromFile(name);
    await saveBrand(slug, { fonts: { ...cur.fonts, [k]: { family, source: "arquivo", path: regular.path, weight: prev?.weight, files } } }, s.name);
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
  } else if (fontSlot(slot)) {
    const k = fontSlot(slot)!;
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
