import { NextResponse } from "next/server";
import { configuredChannels, sendAlert } from "@/lib/alerts";
import { AVISO_LABEL, buildAvisos, getSent } from "@/lib/avisos";
import { avisosMarkdown, enviarAvisosClickup } from "@/lib/avisosClickup";
import { publicBase } from "@/lib/signed";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Resumo diário dos avisos para a Carol.
 * 1. Tarefa no ClickUp atribuída a ela (lista "Avisos · Área de membros").
 * 2. Mensagem pelo canal de alertas, se houver um configurado (Telegram, WhatsApp Cloud ou Twilio).
 * Roda pelo Vercel Cron (vercel.json, todo dia às 9h de Brasília), que manda Bearer CRON_SECRET.
 * Também aceita ?key=<CRON_SECRET>. Com ?teste=1 devolve o texto sem enviar nada.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || (auth !== `Bearer ${process.env.CRON_SECRET}` && url.searchParams.get("key") !== process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const [avisos, sent] = await Promise.all([buildAvisos(), getSent()]);
  const pending = avisos.filter((a) => !sent[a.key]);
  const lines = pending.slice(0, 20).map((a) => `• *${a.client.name}* · ${AVISO_LABEL[a.kind]}: ${a.title}`);
  const body = `*Avisos de hoje* (${pending.length})\n${lines.join("\n")}${pending.length > 20 ? `\n…e mais ${pending.length - 20}` : ""}\n\nMensagens prontas: ${publicBase()}/admin/avisos`;
  if (url.searchParams.get("teste")) return NextResponse.json({ pending: pending.length, body, clickup: avisosMarkdown(pending) });

  const clickup = await enviarAvisosClickup();
  let alert: { sent: boolean; channel?: string; error?: string } = { sent: false };
  if (pending.length && configuredChannels().length) {
    try { alert = { sent: true, channel: (await sendAlert(body)).channel }; }
    catch (e) { alert = { sent: false, error: e instanceof Error ? e.message : String(e) }; }
  }
  const ok = clickup.ok || alert.sent || !pending.length;
  return NextResponse.json({ pending: pending.length, clickup, alert }, { status: ok ? 200 : 502 });
}
