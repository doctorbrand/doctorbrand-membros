"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { markSent } from "@/lib/avisos";
import type { ActionResult } from "@/lib/types";

export async function markSentAction(key: string, _prev: ActionResult | null): Promise<ActionResult> {
  const s = await requireAdmin();
  await markSent(key, s.name);
  revalidatePath("/admin/avisos");
  return { ok: true, message: "Marcado como enviado." };
}

export async function undoSentAction(key: string, _prev: ActionResult | null): Promise<ActionResult> {
  const s = await requireAdmin();
  await markSent(key, s.name, true);
  revalidatePath("/admin/avisos");
  return { ok: true, message: "Voltou para a lista." };
}
