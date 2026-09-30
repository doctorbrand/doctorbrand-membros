import { NextResponse } from "next/server";
import { sendAlert } from "@/lib/alerts";
import { AVISO_LABEL, buildAvisos, getSent } from "@/lib/avisos";
import { publicBase } from "@/lib/signed";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Resumo diário dos avisos para a Carol (pelo canal de alertas configurado: Telegram, WhatsApp Cloud ou Twilio).
 * Agendar uma vez por dia no cron-job.org, por exemplo às 9h:
 *   GET https://login.doctorbrand.co/api/cron/avisos?key=<CRON_SECRET>
 * Com ?teste=1 devolve o texto sem enviar.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || (auth !== `Bearer ${process.env.CRON_SECRET}` && url.searchParams.get("key") !== process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const [avisos, sent] = await Promise.all([buildAvisos(), getSent()]);
  const pending = avisos.filter((a) => !sent[a.key]);
  if (!pending.length) return NextResponse.json({ sent: false, pending: 0 });
  const lines = pending.slice(0, 20).map((a) => `• *${a.client.name}* · ${AVISO_LABEL[a.kind]}: ${a.title}`);
  const body = `*Avisos de hoje* (${pending.length})\n${lines.join("\n")}${pending.length > 20 ? `\n…e mais ${pending.length - 20}` : ""}\n\nMensagens prontas: ${publicBase()}/admin/avisos`;
  if (url.searchParams.get("teste")) return NextResponse.json({ sent: false, pending: pending.length, body });
  try {
    const r = await sendAlert(body);
    return NextResponse.json({ sent: true, pending: pending.length, channel: r.channel });
  } catch (e) {
    return NextResponse.json({ sent: false, pending: pending.length, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
