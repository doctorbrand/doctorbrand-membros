import { ADS_CLIENTS, getAds } from "./ads";
import { clientMeetings, type Meeting } from "./agenda";
import { getWork, type WorkCat, type WorkItem } from "./clickup";
import { getClient, type Client } from "./clients";
import { getPosts, type Post } from "./content";
import { badges, krValue, metasDone, METODO, quarterMonths, quarterOf, type Badge, type KrContext } from "./evolucao";
import { todayISO } from "./periods";
import { calendarAliases, getProject, type MetaKR, type Metas, type Project } from "./project";
import { publicBase, signPath } from "./signed";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export const monthName = (ym: string) => MONTHS[Number(ym.slice(5, 7)) - 1];
export const monthTitle = (ym: string) => `${monthName(ym)} de ${ym.slice(0, 4)}`;

/** Mês do relatório: até o dia 7, o mês anterior (fechado); depois, o mês corrente (parcial). */
export function defaultReportMonth(today = todayISO()): string {
  const [y, m, d] = today.split("-").map(Number);
  if (d > 7) return today.slice(0, 7);
  const prev = new Date(Date.UTC(y, m - 2, 1));
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function previousMonth(today = todayISO()): string {
  const [y, m] = today.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 2, 1));
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Link do relatório que abre sem login (para o cliente, a secretária ou o sócio). Vale 45 dias. */
export function reportLink(slug: string, month: string): string {
  const { e, s } = signPath(`relatorio/${slug}/${month}`, 45 * 24 * 3600);
  return `${publicBase()}/relatorio/${slug}/${month}?e=${e}&s=${s}`;
}

export interface Report {
  client: Client;
  project: Project;
  month: string;
  partial: boolean;
  entregas: WorkItem[] | null;
  byCat: { cat: WorkCat; count: number }[];
  posts: Post[];
  aprovados: number;
  ads: { spend: number; results: number; cost: number | null } | null;
  metas: (Metas & { rows: (MetaKR & { value: number | null })[] }) | null;
  metasBatidas: boolean;
  earned: Badge[];
  etapa: number | null;
  proximas: Meeting[];
}

export async function buildReport(slug: string, month: string): Promise<Report | null> {
  const client = await getClient(slug);
  if (!client) return null;
  const today = todayISO();
  const project = await getProject(slug);
  const aliases = calendarAliases(slug, project);
  const hasAds = ADS_CLIENTS.has(slug);
  const [workRes, allPosts, adsRes, meetings] = await Promise.all([
    getWork([client.name, ...aliases], project.clickupFolder, today),
    getPosts(slug),
    hasAds ? getAds(slug, "mes") : Promise.resolve(null),
    clientMeetings(client.name, aliases, new Date(), new Date(Date.now() + 35 * 86400_000)).catch(() => null),
  ]);
  const work = workRes.ok ? workRes.data : null;
  const inMonth = (d: string) => d.startsWith(month);

  const entregas = work ? work.doneDates.filter((d) => inMonth(d.date)) : null;
  const counts = new Map<WorkCat, number>();
  for (const e of entregas ?? []) counts.set(e.cat, (counts.get(e.cat) ?? 0) + 1);
  const byCat = [...counts.entries()].map(([cat, count]) => ({ cat, count })).sort((a, b) => (a.cat === "outra" ? 1 : b.cat === "outra" ? -1 : b.count - a.count));

  const posts = allPosts.filter((p) => inMonth(p.date) && (p.status === "publicado" || (p.status === "agendado" && p.date <= today))).sort((a, b) => a.date.localeCompare(b.date));
  const aprovados = allPosts.filter((p) => p.history.some((h) => h.action === "aprovado" && h.role === "cliente" && inMonth(h.at.slice(0, 10)))).length;
  const m = adsRes?.ok ? adsRes.data.months.find((x) => x.month === month) : undefined;

  const q = quarterOf(`${month}-15`);
  const qMonths = quarterMonths(q);
  const inQ = (d: string) => qMonths.some((x) => d.startsWith(x));
  const ctx: KrContext = {
    entregas: work ? work.doneDates.filter((d) => inQ(d.date)).length : null,
    posts: allPosts.filter((p) => inQ(p.date) && (p.status === "publicado" || (p.status === "agendado" && p.date <= today))).length,
    contatos: adsRes?.ok ? adsRes.data.months.filter((x) => inQ(x.month)).reduce((a, x) => a + x.results, 0) : null,
  };
  const metas = project.metas && project.metas.periodo === q && project.metas.krs.length
    ? { ...project.metas, rows: project.metas.krs.map((k) => ({ ...k, value: krValue(k, ctx) })) }
    : null;
  const batidas = metasDone(project.metas, ctx);
  const contatosTotal = adsRes?.ok ? adsRes.data.months.reduce((a, x) => a + x.results, 0) : null;
  const etapa = project.metodoEtapa ?? null;
  const earned = badges({ work, etapa: etapa ?? 0, metasBatidas: batidas, contatosTotal, today }).filter((b) => b.earned && (etapa !== null || !b.id.startsWith("metodo")));

  return {
    client, project, month,
    partial: month === today.slice(0, 7),
    entregas, byCat, posts, aprovados,
    ads: m ? { spend: m.spend, results: m.results, cost: m.cost } : null,
    metas, metasBatidas: batidas, earned,
    etapa,
    proximas: (meetings ?? []).filter((x) => x.start >= new Date().toISOString()).slice(0, 5),
  };
}

export { METODO };
