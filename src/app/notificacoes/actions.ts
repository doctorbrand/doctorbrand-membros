"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { enviarParaUsuario, getPushDoc, pushLigado, savePushDoc, TIPOS, type TipoPush } from "@/lib/push";
import type { ActionResult } from "@/lib/types";

async function usuario() {
  const s = await getSession();
  if (!s || s.preview || !s.userId) return null;
  return s;
}

/** Guarda a inscrição deste aparelho (vinda do navegador). */
export async function inscreverAction(sub: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }, aparelho: string): Promise<ActionResult> {
  const s = await usuario();
  if (!s) return { ok: false, message: "Entre com o seu usuário para ativar as notificações." };
  if (!pushLigado()) return { ok: false, message: "As notificações ainda não estão ligadas na área." };
  const endpoint = String(sub?.endpoint ?? "");
  const p256dh = String(sub?.keys?.p256dh ?? ""), auth = String(sub?.keys?.auth ?? "");
  if (!/^https:\/\/[^\s]{10,800}$/.test(endpoint) || !p256dh || !auth || p256dh.length > 200 || auth.length > 100) return { ok: false, message: "O aparelho não devolveu uma inscrição válida. Tente de novo." };
  const d = await getPushDoc(s.userId!);
  d.subs = [...d.subs.filter((x) => x.endpoint !== endpoint), { endpoint, keys: { p256dh, auth }, criadoEm: new Date().toISOString(), aparelho: aparelho.slice(0, 80) }].slice(-8);
  await savePushDoc(s.userId!, d);
  await enviarParaUsuario(s.userId!, "teste", { title: "Notificações ligadas", body: "Pronto. Os avisos da DoctorBrand vão chegar neste aparelho.", url: "/notificacoes", tag: "teste" }).catch(() => 0);
  revalidatePath("/notificacoes");
  return { ok: true, message: "Notificações ativadas neste aparelho." };
}

/** Tira este aparelho da lista. */
export async function desinscreverAction(endpoint: string): Promise<ActionResult> {
  const s = await usuario();
  if (!s) return { ok: false, message: "Sessão expirada." };
  const d = await getPushDoc(s.userId!);
  d.subs = d.subs.filter((x) => x.endpoint !== endpoint);
  await savePushDoc(s.userId!, d);
  revalidatePath("/notificacoes");
  return { ok: true, message: "Notificações desligadas neste aparelho." };
}

/** O que a pessoa quer receber. */
export async function prefsAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await usuario();
  if (!s) return { ok: false, message: "Entre com o seu usuário para escolher as notificações." };
  const d = await getPushDoc(s.userId!);
  const meus = (Object.keys(TIPOS) as TipoPush[]).filter((t) => TIPOS[t].para === (s.role === "admin" ? "admin" : "cliente"));
  for (const t of meus) d.prefs[t] = fd.get(t) === "on";
  await savePushDoc(s.userId!, d);
  revalidatePath("/notificacoes");
  return { ok: true, message: "Preferências salvas." };
}

/** Manda um aviso de teste para os aparelhos da própria pessoa. */
export async function testeAction(_prev: ActionResult | null): Promise<ActionResult> {
  const s = await usuario();
  if (!s) return { ok: false, message: "Sessão expirada." };
  const d = await getPushDoc(s.userId!);
  if (!d.subs.length) return { ok: false, message: "Nenhum aparelho ativado ainda." };
  const n = await enviarParaUsuario(s.userId!, "teste", { title: "Teste da DoctorBrand", body: "Se você está lendo isto, as notificações funcionam.", url: "/notificacoes", tag: "teste" });
  return n ? { ok: true, message: `Enviado para ${n} ${n === 1 ? "aparelho" : "aparelhos"}.` } : { ok: false, message: "Não consegui enviar. Ative de novo neste aparelho." };
}
