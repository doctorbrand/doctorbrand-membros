"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { ORDER_TYPES, saveOrder, type ContentOrder, type OrderType } from "@/lib/orders";
import type { ActionResult } from "@/lib/types";

export async function saveOrderAction(slug: string, o: { periodo: string; quantidades: Record<string, number>; servicos: string[]; foco?: string }): Promise<ActionResult> {
  const s = await requireAdmin();
  const quantidades = Object.fromEntries(ORDER_TYPES.map((t) => [t.key, Math.max(0, Math.min(40, Math.round(Number(o.quantidades?.[t.key]) || 0)))])) as Record<OrderType, number>;
  if (!Object.values(quantidades).some((n) => n > 0)) return { ok: false, message: "Escolha pelo menos um tipo de conteúdo." };
  const order: ContentOrder = { id: crypto.randomUUID(), at: new Date().toISOString(), by: s.name, periodo: String(o.periodo || "").slice(0, 60), quantidades, servicos: (o.servicos ?? []).map(String).slice(0, 20), foco: String(o.foco ?? "").slice(0, 600) || undefined };
  await saveOrder(slug, order);
  revalidatePath(`/cliente/${slug}/gerar`);
  return { ok: true, message: "Pedido registrado." };
}
