import { AVISO_LABEL, avisoPath, buildAvisos, getSent, waLink, type Aviso } from "./avisos";
import { clickupOn } from "./clickup";
import { todayISO } from "./periods";
import { publicBase } from "./signed";
import { readDoc, writeDoc } from "./store";

/**
 * Tarefa diária no ClickUp para a Carol com os avisos do dia.
 * Uma tarefa por dia: se rodar de novo no mesmo dia, a tarefa é atualizada em vez de duplicada.
 * Variáveis opcionais: CLICKUP_AVISOS_LIST (lista "Avisos · Área de membros") e CLICKUP_CAROL_ID.
 */
const API = () => (process.env.CLICKUP_API_URL ?? "https://api.clickup.com/api/v2").replace(/\/$/, "");
const LIST = () => process.env.CLICKUP_AVISOS_LIST ?? "1400320000002416";
const CAROL = () => Number(process.env.CLICKUP_CAROL_ID ?? 82195701);

export interface AvisosTask { date: string; taskId: string; url: string; count: number; at: string }
export const getAvisosTask = () => readDoc<AvisosTask | null>("avisos/clickup", null);

async function cuSend<T>(method: "POST" | "PUT", path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API()}${path}`, {
    method, cache: "no-store",
    headers: { Authorization: process.env.CLICKUP_API_TOKEN ?? "", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`ClickUp ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return (await res.json()) as T;
}

/** Parênteses quebram o link em markdown. */
const mdUrl = (u: string) => u.replace(/\(/g, "%28").replace(/\)/g, "%29");

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function linha(a: Aviso, base: string): string {
  const ponto = (t: string) => (/[.!?…]["”]?$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);
  const parts = [`**${a.client.name}** · ${AVISO_LABEL[a.kind]}${a.urgent ? " · hoje" : ""}: ${ponto(a.title)}`];
  if (a.detail) parts.push(ponto(a.detail));
  const links = [`[Abrir](${base}${avisoPath(a)})`];
  if (a.message) links.unshift(`[Enviar no WhatsApp](${mdUrl(waLink(a.message, a.phone))})`);
  return `- ${parts.join(" ")} ${links.join(" · ")}`;
}

export function avisosMarkdown(pending: Aviso[], base = publicBase()): string {
  const cliente = pending.filter((a) => a.message);
  const equipe = pending.filter((a) => !a.message);
  const out: string[] = [
    `Avisos gerados pela área de membros. As mensagens já estão escritas: revise, envie e marque como enviado em [Avisos](${base}/admin/avisos), assim elas saem da lista de amanhã.`,
  ];
  if (cliente.length) out.push("", `### Para os clientes (${cliente.length})`, ...cliente.map((a) => linha(a, base)));
  if (equipe.length) out.push("", `### Para a equipe (${equipe.length})`, ...equipe.map((a) => linha(a, base)));
  return out.join("\n");
}

export type ClickupResult = { ok: true; pending: number; created: boolean; url?: string } | { ok: false; error: string };

/** Cria (ou atualiza) a tarefa de hoje com os avisos pendentes. Sem avisos, não cria nada. */
export async function enviarAvisosClickup(): Promise<ClickupResult> {
  if (!clickupOn()) return { ok: false, error: "ClickUp não configurado (CLICKUP_API_TOKEN)." };
  const today = todayISO();
  const [avisos, sent, prev] = await Promise.all([buildAvisos(), getSent(), getAvisosTask()]);
  const pending = avisos.filter((a) => !sent[a.key]);
  const sameDay = prev?.date === today ? prev : null;
  if (!pending.length && !sameDay) return { ok: true, pending: 0, created: false };

  const name = pending.length ? `Avisos da área de membros · ${dm(today)} (${pending.length})` : `Avisos da área de membros · ${dm(today)} (tudo enviado)`;
  const markdown_content = pending.length ? avisosMarkdown(pending) : "Tudo o que estava pendente hoje já foi enviado.";
  // Prazo: hoje, 18h de Brasília.
  const due_date = Date.parse(`${today}T21:00:00Z`);
  const priority = pending.some((a) => a.urgent) ? 2 : 3;

  try {
    if (sameDay) {
      try {
        await cuSend("PUT", `/task/${sameDay.taskId}`, { name, markdown_content, priority });
        await writeDoc("avisos/clickup", { ...sameDay, count: pending.length, at: new Date().toISOString() });
        return { ok: true, pending: pending.length, created: false, url: sameDay.url };
      } catch {
        // A tarefa pode ter sido apagada: cria outra.
        if (!pending.length) return { ok: true, pending: 0, created: false };
      }
    }
    const t = await cuSend<{ id: string; url?: string }>("POST", `/list/${LIST()}/task`, {
      name, markdown_content, assignees: [CAROL()], due_date, due_date_time: true, priority,
    });
    const url = t.url ?? `https://app.clickup.com/t/${t.id}`;
    await writeDoc<AvisosTask>("avisos/clickup", { date: today, taskId: t.id, url, count: pending.length, at: new Date().toISOString() });
    return { ok: true, pending: pending.length, created: true, url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
