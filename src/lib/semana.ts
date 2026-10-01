/**
 * Relatório semanal de anúncios vindo do painel de tráfego (painel.doctorbrand.co, /api/membros/semana).
 * Mesma chave da aba de Anúncios: MEMBROS_API_KEY igual nos dois projetos do Vercel.
 */
export interface WeekPoint {
  since: string; until: string; spend: number; contatos: number; cpc: number | null;
  conversas: number; leads: number; cliques: number; googleSpend: number; googleConv: number;
  agendou: number | null; operou: number | null;
}

export interface WeeklyReport {
  client: { name: string; specialty: string; objective: string; cplTarget: number };
  weeks: WeekPoint[];
  current: WeekPoint | null;
  previous: WeekPoint | null;
  topCampaigns: { name: string; resultLabel: string; results: number; spend: number; costPerResult: number | null }[];
  actions: { date: string; title: string; note?: string }[];
  avg4: { contatos: number; cpc: number | null; spend: number } | null;
  updatedAt: string;
  error?: string;
}

export type WeeklyResult = { ok: true; data: WeeklyReport } | { ok: false; reason: "off" | "sem-conta" | "erro"; message: string };

export async function getWeekly(slug: string): Promise<WeeklyResult> {
  const key = process.env.MEMBROS_API_KEY;
  if (!key) return { ok: false, reason: "off", message: "A ligação com o painel de tráfego ainda não foi configurada." };
  const base = (process.env.PAINEL_URL ?? "https://painel.doctorbrand.co").replace(/\/$/, "");
  try {
    const r = await fetch(`${base}/api/membros/semana?c=${encodeURIComponent(slug)}`, {
      headers: { authorization: `Bearer ${key}` },
      next: { revalidate: 3600 },
    });
    if (r.status === 404) return { ok: false, reason: "sem-conta", message: "Este cliente não tem conta de anúncios no painel." };
    const j = await r.json().catch(() => null);
    if (!r.ok || !j) return { ok: false, reason: "erro", message: j?.error ?? `O painel respondeu ${r.status}.` };
    return { ok: true, data: j as WeeklyReport };
  } catch (e) {
    return { ok: false, reason: "erro", message: e instanceof Error ? e.message : String(e) };
  }
}

const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** "22 a 28 set" ou "29 set a 5 out". */
export function weekLabel(w: { since: string; until: string }): string {
  const d = (iso: string) => Number(iso.slice(8, 10));
  const m = (iso: string) => MES[Number(iso.slice(5, 7)) - 1];
  return m(w.since) === m(w.until) ? `${d(w.since)} a ${d(w.until)} ${m(w.until)}` : `${d(w.since)} ${m(w.since)} a ${d(w.until)} ${m(w.until)}`;
}
export const shortDay = (iso: string) => `${Number(iso.slice(8, 10))}/${iso.slice(5, 7)}`;

/** Frase de abertura, em linguagem simples, comparando com a semana anterior. */
export function headline(cur: WeekPoint, prev: WeekPoint | null): string {
  const n = (v: number) => Math.round(v).toLocaleString("pt-BR");
  const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
  if (cur.contatos === 0) return cur.spend > 0 ? "Nesta semana os anúncios trabalharam alcance e visitas ao perfil, preparando o público para a captação." : "Nesta semana os anúncios ficaram pausados.";
  let s = `Seus anúncios trouxeram ${n(cur.contatos)} ${cur.contatos === 1 ? "contato" : "contatos"}`;
  if (prev && prev.contatos > 0) {
    const ch = ((cur.contatos - prev.contatos) / prev.contatos) * 100;
    s += Math.abs(ch) < 3 ? ", no mesmo ritmo da semana anterior" : `, ${Math.abs(ch).toFixed(0)}% ${ch > 0 ? "a mais" : "a menos"} que na semana anterior`;
  }
  if (cur.cpc !== null) s += `, a ${money(cur.cpc)} cada`;
  return s + ".";
}
