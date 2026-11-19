"use server";

import { revalidatePath } from "next/cache";
import { sendAlert } from "@/lib/alerts";
import { getClient } from "@/lib/clients";
import { briefingPath, getOnboarding, respostasDoForm, saveOnboarding, tokenBriefingOk } from "@/lib/onboarding";
import { avisarEquipe } from "@/lib/push";
import { publicBase } from "@/lib/signed";
import type { ActionResult } from "@/lib/types";

/**
 * Briefing pelo link, sem login. O token do link é a única chave: confere de novo a cada envio,
 * então trocar ou desligar o link na área corta o acesso na hora. As respostas vão para o Onboarding
 * do cliente, junto com os acessos, e a equipe recebe o aviso.
 */
export async function briefingPorLinkAction(slug: string, token: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return { ok: false, message: "Link inválido." };
  const d = await getOnboarding(slug);
  if (!tokenBriefingOk(d, token)) return { ok: false, message: "Este link não está mais ativo. Peça um novo para a equipe DoctorBrand." };
  const c = await getClient(slug);
  if (!c || c.removed) return { ok: false, message: "Link inválido." };

  const enviar = fd.get("intent") === "enviar";
  const respostas = respostasDoForm(fd);
  if (enviar && Object.keys(respostas).length < 4) return { ok: false, message: "Responda pelo menos 4 perguntas para enviar. Você pode salvar e continuar depois por este mesmo link." };

  d.briefing = { ...d.briefing, respostas, viaLink: true, ...(enviar ? { enviadoEm: new Date().toISOString(), por: `${c.name} (pelo link)` } : {}) };
  await saveOnboarding(slug, d);
  if (enviar) {
    await sendAlert(`*Briefing · ${c.name}*\nO cliente respondeu pelo link (${Object.keys(respostas).length} respostas).\n${publicBase()}/cliente/${slug}/onboarding`).catch(() => undefined);
    await avisarEquipe({ title: c.name, body: "Respondeu o briefing pelo link.", url: `/cliente/${slug}/onboarding`, tag: `briefing-${slug}` }).catch(() => 0);
  }
  revalidatePath(briefingPath(slug, token));
  revalidatePath(`/cliente/${slug}/onboarding`);
  return { ok: true, message: enviar ? "Briefing enviado. Obrigado! Se lembrar de algo, é só voltar por este link." : "Salvo. Você pode continuar depois por este mesmo link." };
}
