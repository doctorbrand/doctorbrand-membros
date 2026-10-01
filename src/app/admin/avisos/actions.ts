"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { markSent } from "@/lib/avisos";
import { enviarAvisosClickup } from "@/lib/avisosClickup";
import { testeAlteracao } from "@/lib/alteracoesClickup";
import { listClients } from "@/lib/clients";
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

export async function clickupAction(_prev: ActionResult | null): Promise<ActionResult> {
  await requireAdmin();
  const r = await enviarAvisosClickup();
  revalidatePath("/admin/avisos");
  if (!r.ok) return { ok: false, message: r.error };
  if (!r.pending && !r.url) return { ok: true, message: "Nada pendente. Nenhuma tarefa criada." };
  return { ok: true, message: r.created ? "Tarefa criada para a Carol no ClickUp." : "Tarefa de hoje atualizada no ClickUp." };
}

/** Cria uma tarefa [TESTE] para a Alexandra, pelo mesmo caminho de um pedido de ajuste real. */
export async function testeAlexandraAction(_prev: ActionResult | null): Promise<ActionResult> {
  const s = await requireAdmin();
  const clients = await listClients();
  const r = await testeAlteracao(s.name, clients.map((c) => c.slug));
  revalidatePath("/admin/avisos");
  if (!r.ok) return { ok: false, message: r.error };
  return { ok: true, message: `Tarefa de teste criada para a Alexandra (${r.folder ?? "ClickUp"}).` };
}
