import { readDoc, storeEnabled, writeDoc } from "./store";

/** Avisos para a equipe (Telegram, WhatsApp Cloud ou Twilio): o primeiro canal configurado que funcionar. */
export type Channel = "telegram" | "whatsapp-cloud" | "twilio";

export interface SendResult { channel: Channel; id: string }

/** Chat do Telegram: variável de ambiente ou descoberto via getUpdates e guardado no Blob. */
async function telegramChatId(token: string): Promise<string | null> {
  if (process.env.TELEGRAM_CHAT_ID) return process.env.TELEGRAM_CHAT_ID;
  const saved = await readDoc<{ chatId?: string }>("settings/telegram", {});
  if (saved.chatId) return saved.chatId;
  const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=50`, { cache: "no-store" });
  const json = (await res.json()) as { ok: boolean; result?: { message?: { chat?: { id: number; type: string; first_name?: string; username?: string } } }[] };
  const chat = json.result?.map((u) => u.message?.chat).filter((c) => c && c.type === "private").at(-1);
  if (!chat) return null;
  if (storeEnabled()) await writeDoc("settings/telegram", { chatId: String(chat.id), name: chat.first_name ?? chat.username, savedAt: new Date().toISOString() }).catch(() => undefined);
  return String(chat.id);
}

export async function sendTelegram(body: string): Promise<string> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Telegram não configurado (TELEGRAM_BOT_TOKEN).");
  const chatId = await telegramChatId(token);
  if (!chatId) throw new Error("Telegram: nenhum chat encontrado. Abra o bot no Telegram, mande /start e tente de novo.");
  // Telegram Markdown legacy: *negrito* funciona igual ao WhatsApp; limite 4096.
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
    body: JSON.stringify({ chat_id: chatId, text: body.slice(0, 4000), parse_mode: "Markdown", disable_web_page_preview: true }),
  });
  let json = (await res.json()) as { ok: boolean; result?: { message_id: number }; description?: string };
  if (!json.ok && /parse/i.test(json.description ?? "")) {
    // texto com caractere que quebra o Markdown → reenvia sem formatação
    const r2 = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ chat_id: chatId, text: body.slice(0, 4000), disable_web_page_preview: true }) });
    json = (await r2.json()) as typeof json;
  }
  if (!json.ok || !json.result) throw new Error(`Telegram: ${json.description ?? "falha"}`);
  return String(json.result.message_id);
}

/** WhatsApp Cloud API (Meta). Exige WABA + número no Business Manager e template aprovado (WHATSAPP_TEMPLATE, 1 variável). */
export async function sendWhatsAppCloud(body: string, to = process.env.ALERT_WHATSAPP_TO): Promise<string> {
  const phoneId = process.env.WHATSAPP_PHONE_ID, token = process.env.WHATSAPP_TOKEN ?? process.env.META_ACCESS_TOKEN, template = process.env.WHATSAPP_TEMPLATE;
  if (!phoneId || !token || !to) throw new Error("WhatsApp Cloud não configurado (WHATSAPP_PHONE_ID / ALERT_WHATSAPP_TO).");
  const dest = to.replace(/^whatsapp:/, "").replace(/\D/g, "");
  const payload = template
    ? { messaging_product: "whatsapp", to: dest, type: "template", template: { name: template, language: { code: "pt_BR" }, components: [{ type: "body", parameters: [{ type: "text", text: body.replace(/\n/g, " | ").slice(0, 1000) }] }] } }
    : { messaging_product: "whatsapp", to: dest, type: "text", text: { body: body.slice(0, 4000) } };
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify(payload),
  });
  const json = (await res.json()) as { messages?: { id: string }[]; error?: { message: string } };
  if (json.error || !json.messages?.[0]) throw new Error(`WhatsApp Cloud: ${json.error?.message ?? "falha"}`);
  return json.messages[0].id;
}

/** Envia WhatsApp via Twilio (REST, sem SDK). Retorna o SID da mensagem. */
export async function sendWhatsApp(body: string, to = process.env.ALERT_WHATSAPP_TO): Promise<string> {
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !token || !from || !to) throw new Error("Twilio não configurado (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM / ALERT_WHATSAPP_TO).");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: from, To: to, Body: body.slice(0, 1500) }),
    cache: "no-store",
  });
  const json = (await res.json()) as { sid?: string; message?: string; code?: number };
  if (!res.ok || !json.sid) throw new Error(`Twilio ${json.code ?? res.status}: ${json.message ?? "falha"}`);
  // Twilio aceita e só falha depois (63015 = número fora do sandbox). Confere o status em seguida.
  await new Promise((r) => setTimeout(r, 2500));
  const st = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages/${json.sid}.json`, { headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` }, cache: "no-store" }).then((r) => r.json() as Promise<{ status?: string; error_code?: number | null }>).catch(() => null);
  if (st?.status === "failed" || st?.status === "undelivered") throw new Error(`Twilio ${st.error_code ?? ""}: mensagem ${st.status}${st.error_code === 63015 ? " (número fora do sandbox — mande 'join fairly-clean' pra +1 415 523 8886; a inscrição vence em 72h sem conversa)" : ""}`);
  return json.sid;
}

/** Canais configurados, na ordem de tentativa. */
export function configuredChannels(): Channel[] {
  const out: Channel[] = [];
  if (process.env.TELEGRAM_BOT_TOKEN) out.push("telegram");
  if (process.env.WHATSAPP_PHONE_ID) out.push("whatsapp-cloud");
  if (process.env.TWILIO_ACCOUNT_SID) out.push("twilio");
  return out;
}

/** Envia pelo primeiro canal que funcionar. Erro só se todos falharem (mensagem lista cada um). */
export async function sendAlert(body: string): Promise<SendResult> {
  const errors: string[] = [];
  for (const ch of configuredChannels()) {
    try {
      const id = ch === "telegram" ? await sendTelegram(body) : ch === "whatsapp-cloud" ? await sendWhatsAppCloud(body) : await sendWhatsApp(body);
      return { channel: ch, id };
    } catch (e) {
      errors.push(`${ch}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(errors.length ? errors.join(" · ") : "Nenhum canal de alerta configurado.");
}
