"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { getPlan } from "@/lib/content";
import { readFeed, saveAudit, scoreFeedNow } from "@/lib/feedAudit";
import { getProfile, PROFILE_FIELDS, saveProfile, type ClientProfile } from "@/lib/profile";
import type { ActionResult } from "@/lib/types";

const path = (slug: string) => `/cliente/${slug}/perfil`;

export async function saveProfileAction(slug: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await requireAdmin();
  const patch: ClientProfile = {};
  for (const f of PROFILE_FIELDS) (patch as Record<string, string>)[f.key] = String(fd.get(f.key) ?? "").replace(/\r\n?/g, "\n").trim();
  patch.instagram = String(fd.get("instagram") ?? "").replace(/^@/, "").trim();
  const v = String(fd.get("visualScore") ?? "").replace(",", ".").trim();
  patch.visualScore = v === "" ? undefined : Math.max(0, Math.min(10, Number(v)));
  if (v !== "" && !Number.isFinite(patch.visualScore)) return { ok: false, message: "Nota visual precisa ser um número de 0 a 10." };
  patch.visualNota = String(fd.get("visualNota") ?? "").trim();
  await saveProfile(slug, patch, s.name);
  revalidatePath(path(slug));
  return { ok: true, message: "Perfil salvo." };
}

export async function runAuditAction(slug: string, _prev: ActionResult | null): Promise<ActionResult> {
  const s = await requireAdmin();
  const c = await getClient(slug);
  if (!c) return { ok: false, message: "Cliente não encontrado." };
  try {
    const [profile, plan] = await Promise.all([getProfile(slug), getPlan(slug)]);
    const snap = await readFeed(c.igUserId, profile.instagram);
    if (!snap.posts.length) return { ok: false, message: "Não encontrei posts públicos neste perfil." };
    const r = scoreFeedNow(snap, plan, profile);
    await saveAudit(slug, { ...r, at: new Date().toISOString(), by: s.name });
    revalidatePath(path(slug));
    return { ok: true, message: `Feed lido: ${r.postsRead} posts. Nota ${r.total}.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
