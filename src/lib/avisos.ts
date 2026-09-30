import { createHash } from "crypto";
import { agendaConfigured, clientMeetings, MEETING_LABEL, meetingDay, meetingTime } from "./agenda";
import { listClients, type Client } from "./clients";
import { getPosts, visibleTo } from "./content";
import { todayISO } from "./periods";
import { calendarAliases, getProject } from "./project";
import { getCrm } from "./clickup";
import { contratoStatus, dataCurta } from "./contrato";
import { getNps, grupo, GRUPO_LABEL, ultima } from "./nps";
import { monthTitle, previousMonth, reportLink } from "./report";
import { publicBase } from "./signed";
import { readDoc, writeDoc } from "./store";

/**
 * Avisos para a Carol mandar aos clientes. O sistema junta o que o cliente precisa saber
 * (posts para aprovar, lembrete de captação, relatório do mês) e deixa a mensagem pronta;
 * a Carol revisa, envia do WhatsApp dela e marca como enviado.
 */
export type AvisoKind = "aprovar" | "lembrete" | "relatorio" | "ajuste" | "contrato" | "nps";

export interface Aviso {
  key: string;
  kind: AvisoKind;
  client: Client;
  title: string;
  detail: string;
  /** Mensagem pronta para o cliente. Avisos internos (ajuste) não têm. */
  message?: string;
  phone?: string;
  urgent: boolean;
}

export const AVISO_LABEL: Record<AvisoKind, string> = { aprovar: "Aprovação", lembrete: "Lembrete", relatorio: "Relatório", ajuste: "Ajuste pedido", contrato: "Contrato", nps: "Termômetro" };

const hash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 10);
const daysSince = (iso: string) => Math.floor((Date.now() - Date.parse(iso)) / 86400e3);

type Sent = Record<string, { at: string; by: string }>;
export const getSent = () => readDoc<Sent>("avisos/enviados", {});

export async function markSent(key: string, by: string, undo = false): Promise<void> {
  const cur = await getSent();
  if (undo) delete cur[key]; else cur[key] = { at: new Date().toISOString(), by };
  // Guarda só os últimos 90 dias.
  const limit = Date.now() - 90 * 86400e3;
  for (const [k, v] of Object.entries(cur)) if (Date.parse(v.at) < limit) delete cur[k];
  await writeDoc("avisos/enviados", cur);
}

export async function buildAvisos(): Promise<Aviso[]> {
  const today = todayISO();
  const day = Number(today.slice(8, 10));
  const clients = await listClients();
  const agendaOn = agendaConfigured();
  const out: Aviso[] = [];

  await Promise.all(clients.map(async (c) => {
    const [project, all] = await Promise.all([getProject(c.slug), getPosts(c.slug)]);
    const first = c.name.split(" ")[0];
    const phone = project.clienteWhatsapp;
    const base = publicBase();

    // Posts esperando o cliente
    const waiting = all.filter((p) => p.status === "aguardando" && visibleTo(p, "cliente"));
    if (waiting.length) {
      const sentAt = waiting.map((p) => p.history.filter((h) => h.action === "enviado").at(-1)?.at ?? p.updatedAt).sort()[0];
      const age = daysSince(sentAt);
      const n = waiting.length;
      out.push({
        key: `aprovar:${c.slug}:${hash(waiting.map((p) => p.id).sort().join(","))}`,
        kind: "aprovar", client: c, phone, urgent: age >= 2,
        title: n === 1 ? "1 post esperando aprovação" : `${n} posts esperando aprovação`,
        detail: age === 0 ? "Enviado hoje" : `O mais antigo espera há ${age} ${age === 1 ? "dia" : "dias"}`,
        message: `Olá, ${first}! Tudo bem? ${n === 1 ? "Há 1 post esperando" : `Há ${n} posts esperando`} a sua aprovação na área de membros. É rapidinho: ${base}/cliente/${c.slug}/conteudo`,
      });
    }

    // Ajustes pedidos pelo cliente (aviso interno para a equipe)
    const ajustes = all.filter((p) => p.status === "alteracao");
    if (ajustes.length) {
      out.push({
        key: `ajuste:${c.slug}:${hash(ajustes.map((p) => `${p.id}${p.updatedAt}`).sort().join(","))}`,
        kind: "ajuste", client: c, urgent: false,
        title: ajustes.length === 1 ? "1 ajuste pedido pelo cliente" : `${ajustes.length} ajustes pedidos pelo cliente`,
        detail: ajustes.map((p) => p.title).slice(0, 3).join(" · "),
      });
    }

    // Contrato perto da renovação (30 dias) ou encerrado
    const crm = await getCrm([c.name, ...calendarAliases(c.slug, project)]);
    const ct = contratoStatus(project.contrato, today, crm?.desde, crm?.renovacao);
    if (ct.proxima && ct.diasParaProxima !== undefined && ct.diasParaProxima <= 30) {
      out.push({
        key: `contrato:${c.slug}:${ct.proxima}`,
        kind: "contrato", client: c, urgent: ct.vencido || ct.diasParaProxima <= 7,
        title: ct.vencido ? `Prazo encerrado em ${dataCurta(ct.proxima)}` : `Renovação em ${ct.diasParaProxima} ${ct.diasParaProxima === 1 ? "dia" : "dias"} (${dataCurta(ct.proxima)})`,
        detail: project.contrato?.regra === "nova" ? "Precisa de contrato novo." : "Bom momento para a conversa de resultados e próximo passo.",
      });
    }

    // Resposta nova no termômetro (últimos 14 dias)
    const nps = ultima(await getNps(c.slug));
    if (nps && Date.now() - Date.parse(nps.at) < 14 * 86400e3) {
      const g = grupo(nps.score);
      out.push({
        key: `nps:${c.slug}:${nps.id}`,
        kind: "nps", client: c, urgent: g === "detrator",
        title: `Nota ${nps.score} · ${GRUPO_LABEL[g]}`,
        detail: nps.comentario ? `"${nps.comentario}"` : "Sem comentário.",
      });
    }

    // Relatório do mês anterior, na primeira semana
    if (day <= 7) {
      const mes = previousMonth(today);
      out.push({
        key: `relatorio:${c.slug}:${mes}`,
        kind: "relatorio", client: c, phone, urgent: false,
        title: `Relatório de ${monthTitle(mes)}`,
        detail: "Pronto para enviar. O link abre sem login e vale 45 dias.",
        message: `Olá, ${first}! O seu relatório de ${monthTitle(mes).split(" de ")[0]} está pronto: tudo o que entregamos, o que foi ao ar e os próximos passos. ${reportLink(c.slug, mes)}`,
      });
    }

    // Lembrete de captação, onboarding ou reunião pontual nos próximos 2 dias
    if (agendaOn) {
      const meetings = await clientMeetings(c.name, calendarAliases(c.slug, project), new Date(), new Date(Date.now() + 2.5 * 86400e3)).catch(() => null);
      for (const m of meetings ?? []) {
        if (m.kind === "fixa" || m.kind === "outra") continue;
        const quando = `${meetingDay(m.start)}, ${meetingTime(m)}`;
        const prep = m.kind === "captacao" ? ` Para render ao máximo, vale ler o checklist de preparação: ${base}/ajuda/captacao` : "";
        out.push({
          key: `lembrete:${c.slug}:${m.id}`,
          kind: "lembrete", client: c, phone, urgent: true,
          title: `${MEETING_LABEL[m.kind]}: ${quando}`,
          detail: m.title,
          message: `Olá, ${first}! Passando para lembrar: ${MEETING_LABEL[m.kind].toLowerCase()} ${quando}.${m.meetUrl ? ` Link da chamada: ${m.meetUrl}` : ""}${prep}`,
        });
      }
    }
  }));

  const order: AvisoKind[] = ["lembrete", "aprovar", "relatorio", "nps", "contrato", "ajuste"];
  return out.sort((a, b) => Number(b.urgent) - Number(a.urgent) || order.indexOf(a.kind) - order.indexOf(b.kind) || a.client.name.localeCompare(b.client.name, "pt-BR"));
}

export function waLink(message: string, phone?: string): string {
  return `https://wa.me/${phone ?? ""}?text=${encodeURIComponent(message)}`;
}
