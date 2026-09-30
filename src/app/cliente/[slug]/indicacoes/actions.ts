"use server";

import { revalidatePath } from "next/cache";
import { sendAlert } from "@/lib/alerts";
import { requireAdmin, requireAuth } from "@/lib/auth";
import { addIndicacao, getCircle, LIMITE_ATIVAS, marcarEntregue, setStatus, STATUS_LABEL, type IndicacaoStatus } from "@/lib/circle";
import { getClient } from "@/lib/clients";
import { publicBase } from "@/lib/signed";
import type { ActionResult } from "@/lib/types";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function indicarAction(slug: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await requireAuth(slug);
  const nome = str(fd, "nome").slice(0, 120), contato = str(fd, "contato").slice(0, 120);
  if (!nome || !contato) return { ok: false, message: "Informe o nome e um contato (WhatsApp ou Instagram)." };
  if (!fd.get("aviso")) return { ok: false, message: "Confirme que o colega sabe que a DoctorBrand vai entrar em contato." };
  const d = await getCircle();
  const ativas = d.indicacoes.filter((i) => i.slug === slug && i.status !== "nao").length;
  if (ativas >= LIMITE_ATIVAS) return { ok: false, message: `O Circle aceita até ${LIMITE_ATIVAS} indicações por cliente.` };
  const i = await addIndicacao({ slug, nome, contato, especialidade: str(fd, "especialidade").slice(0, 80) || undefined, cidade: str(fd, "cidade").slice(0, 80) || undefined, obs: str(fd, "obs").slice(0, 500) || undefined, por: s.name });
  const c = await getClient(slug).catch(() => undefined);
  await sendAlert(`*Circle · nova indicação*\n${c?.name ?? slug} indicou ${i.nome}${i.especialidade ? ` (${i.especialidade})` : ""}.\n${publicBase()}/admin/indicacoes`).catch(() => undefined);
  revalidatePath(`/cliente/${slug}/indicacoes`);
  return { ok: true, message: "Indicação recebida. Obrigado pela confiança!" };
}

export async function statusIndicacaoAction(id: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const status = str(fd, "status") as IndicacaoStatus;
  if (!(status in STATUS_LABEL)) return { ok: false, message: "Status inválido." };
  const i = await setStatus(id, status);
  if (!i) return { ok: false, message: "Indicação não encontrada." };
  revalidatePath("/admin/indicacoes"); revalidatePath(`/cliente/${i.slug}/indicacoes`);
  return { ok: true, message: `Status: ${STATUS_LABEL[status]}.` };
}

export async function entregarRecompensaAction(slug: string, nivel: number, _prev: ActionResult | null): Promise<ActionResult> {
  await requireAdmin();
  await marcarEntregue(slug, nivel);
  revalidatePath("/admin/indicacoes"); revalidatePath(`/cliente/${slug}/indicacoes`); revalidatePath("/admin/avisos");
  return { ok: true, message: "Recompensa marcada como entregue." };
}
