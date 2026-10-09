/**
 * Anúncios do cliente vindos do painel de tráfego (painel.doctorbrand.co), a mesma fonte
 * de números que a equipe usa. Precisa de MEMBROS_API_KEY igual nos dois projetos do Vercel.
 */
export type AdsPeriod = "7d" | "30d" | "mes";

export interface AdsTotals {
  spend: number; captacao: number; cpl: number | null; conversas: number; leads: number;
  reach: number; impressions: number; linkClicks: number; linkCtr: number | null; frequency: number | null; activeCampaigns: number;
}

export interface AdsData {
  client: { name: string; cplExcellent: number; cplTarget: number; cplMax: number; budgetMonthly: number; mode: string };
  period: { key: AdsPeriod; label: string; since: string; until: string; prevLabel: string };
  totals: AdsTotals;
  prev: AdsTotals;
  pacing: { mtdSpend: number; elapsedDays: number; daysInMonth: number; projected: number | null };
  google: { cost: number; conversions: number; prevCost: number | null; prevConversions: number | null } | null;
  campaigns: { name: string; captacao: boolean; resultLabel: string; results: number; spend: number; costPerResult: number | null; status: string }[];
  months: { month: string; label: string; spend: number; results: number; cost: number | null }[];
  error?: string;
  updatedAt: string;
}

export type AdsResult = { ok: true; data: AdsData } | { ok: false; reason: "off" | "sem-conta" | "erro"; message: string };

/** Clientes que têm conta de anúncios no painel (os demais não mostram a aba). */
export const ADS_CLIENTS = new Set(["vivian-ferrari", "viegas", "carlos-picasso", "flavio-pinheiro", "eric-reis", "erica-barros", "danilo-tacinari", "jose-mauro", "cecilia-favre"]);

export function adsConfigured(): boolean {
  return !!process.env.MEMBROS_API_KEY;
}

export async function getAds(slug: string, period: AdsPeriod = "30d"): Promise<AdsResult> {
  const key = process.env.MEMBROS_API_KEY;
  if (!key) return { ok: false, reason: "off", message: "A ligação com o painel de tráfego ainda não foi configurada." };
  const base = (process.env.PAINEL_URL ?? "https://painel.doctorbrand.co").replace(/\/$/, "");
  try {
    const r = await fetch(`${base}/api/membros/ads?c=${encodeURIComponent(slug)}&p=${period}`, {
      headers: { authorization: `Bearer ${key}` },
      next: { revalidate: 900 },
    });
    if (r.status === 404) return { ok: false, reason: "sem-conta", message: "Este cliente não tem conta de anúncios no painel." };
    const j = await r.json().catch(() => null);
    if (!r.ok || !j) return { ok: false, reason: "erro", message: j?.error ?? `O painel respondeu ${r.status}.` };
    return { ok: true, data: j as AdsData };
  } catch (e) {
    return { ok: false, reason: "erro", message: e instanceof Error ? e.message : String(e) };
  }
}

export const brl = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined || !Number.isFinite(v) ? "–" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: digits, maximumFractionDigits: digits });

export const int = (v: number | null | undefined) => (v === null || v === undefined ? "–" : Math.round(v).toLocaleString("pt-BR"));

/** Variação percentual (null quando não há base). */
export function change(cur: number | null, prev: number | null): number | null {
  if (cur === null || prev === null || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

export type CplGrade = "otimo" | "meta" | "atencao" | "alto";
export function gradeCpl(cpl: number | null, c: AdsData["client"]): CplGrade | null {
  if (cpl === null) return null;
  if (cpl <= c.cplExcellent) return "otimo";
  if (cpl <= c.cplTarget) return "meta";
  if (cpl <= c.cplMax) return "atencao";
  return "alto";
}
export const CPL_LABEL: Record<CplGrade, string> = { otimo: "Excelente", meta: "Dentro da meta", atencao: "Acima da meta", alto: "Muito acima da meta" };
