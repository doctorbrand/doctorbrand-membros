"use server";

import { revalidatePath } from "next/cache";
import { sendAlert } from "@/lib/alerts";
import { requireAdmin, requireAuth , PREVIEW_BLOCK } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { acessos, BRIEFING, getOnboarding, saveOnboarding } from "@/lib/onboarding";
import { getProfile, saveProfile } from "@/lib/profile";
import { publicBase } from "@/lib/signed";
import type { ActionResult } from "@/lib/types";

const done = (slug: string, message: string): ActionResult => { revalidatePath(`/cliente/${slug}`, "layout"); return { ok: true, message }; };

/** Cliente marca um acesso como feito (com nota opcional). A equipe confirma depois. */
export async function marcarAcessoAction(slug: string, id: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await requireAuth(slug);
  if (s.preview) return PREVIEW_BLOCK;
  if (!acessos().some((a) => a.id === id)) return { ok: false, message: "Item inválido." };
  const nota = String(fd.get("nota") ?? "").trim().slice(0, 300) || undefined;
  if (/senha|password/i.test(nota ?? "")) return { ok: false, message: "Não escreva senhas aqui. Use o convite de acesso descrito acima." };
  const d = await getOnboarding(slug);
  const cur = d.acessos[id];
  d.acessos[id] = { status: s.role === "admin" ? "confirmado" : cur?.status === "confirmado" ? "confirmado" : "feito", nota: nota ?? cur?.nota, at: new Date().toISOString(), por: s.name };
  await saveOnboarding(slug, d);
  return done(slug, s.role === "admin" ? "Confirmado." : "Marcado. A equipe confere e confirma.");
}

export async function desfazerAcessoAction(slug: string, id: string, _prev: ActionResult | null): Promise<ActionResult> {
  const s = await requireAuth(slug);
  if (s.preview) return PREVIEW_BLOCK;
  const d = await getOnboarding(slug);
  delete d.acessos[id];
  await saveOnboarding(slug, d);
  return done(slug, "Desfeito.");
}

export async function confirmarAcessoAction(slug: string, id: string, _prev: ActionResult | null): Promise<ActionResult> {
  const s = await requireAdmin();
  const d = await getOnboarding(slug);
  d.acessos[id] = { ...(d.acessos[id] ?? { at: new Date().toISOString() }), status: "confirmado", at: new Date().toISOString(), por: s.name };
  await saveOnboarding(slug, d);
  return done(slug, "Confirmado.");
}

/** Salva o briefing (rascunho ou envio). No envio, avisa a equipe. */
export async function salvarBriefingAction(slug: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await requireAuth(slug);
  if (s.preview) return PREVIEW_BLOCK;
  const enviar = String(fd.get("intent")) === "enviar";
  const respostas = Object.fromEntries(BRIEFING.map((q) => [q.key, String(fd.get(q.key) ?? "").trim().slice(0, 3000)]).filter(([, v]) => v));
  if (enviar && Object.keys(respostas).length < 4) return { ok: false, message: "Responda pelo menos 4 perguntas para enviar. Você pode salvar e continuar depois." };
  const d = await getOnboarding(slug);
  d.briefing = { ...d.briefing, respostas, ...(enviar ? { enviadoEm: new Date().toISOString(), por: s.name } : {}) };
  await saveOnboarding(slug, d);
  if (enviar) {
    const c = await getClient(slug).catch(() => undefined);
    await sendAlert(`*Briefing · ${c?.name ?? slug}*\n${s.name} enviou o briefing (${Object.keys(respostas).length} respostas).\n${publicBase()}/cliente/${slug}/onboarding`).catch(() => undefined);
  }
  return done(slug, enviar ? "Briefing enviado. Obrigado!" : "Rascunho salvo.");
}

/** Equipe: leva as respostas do briefing para o Perfil, só nos campos ainda vazios. */
export async function aplicarBriefingAction(slug: string, _prev: ActionResult | null): Promise<ActionResult> {
  const s = await requireAdmin();
  const d = await getOnboarding(slug);
  const r = d.briefing?.respostas ?? {};
  const cur = await getProfile(slug);
  const patch = Object.fromEntries(Object.entries(r).filter(([k, v]) => v && !String(cur[k as keyof typeof cur] ?? "").trim()));
  if (!Object.keys(patch).length) return { ok: true, message: "O Perfil já tinha todos esses campos preenchidos. Nada foi sobrescrito." };
  await saveProfile(slug, patch, s.name);
  d.briefing = { ...d.briefing!, aplicadoEm: new Date().toISOString() };
  await saveOnboarding(slug, d);
  return done(slug, `${Object.keys(patch).length} campos levados para o Perfil.`);
}
