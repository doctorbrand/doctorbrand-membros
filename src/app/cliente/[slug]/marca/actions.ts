"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getBrand, saveBrand } from "@/lib/brandStore";
import { COLOR_ROLES, LOGO_SLOTS, MAX_COLORS, normalizeHex, type BrandColor, type BrandFont, type ColorRole, type LogoKey } from "@/lib/brand";
import { getClient } from "@/lib/clients";
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
