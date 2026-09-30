import { readDoc, writeDoc } from "./store";

/** Termômetro de satisfação (NPS): uma pergunta a cada 90 dias, respondida pelo cliente na área de membros. */
export interface NpsResposta { id: string; at: string; score: number; comentario?: string; por: string }
interface NpsDoc { respostas: NpsResposta[]; adiadoAte?: string }

const path = (slug: string) => `nps/${slug}`;
export const NPS_INTERVALO_DIAS = 90;

export async function getNps(slug: string): Promise<NpsDoc> {
  return readDoc<NpsDoc>(path(slug), { respostas: [] });
}

export async function addNps(slug: string, r: Omit<NpsResposta, "id" | "at">): Promise<NpsResposta> {
  const d = await getNps(slug);
  const nova = { ...r, id: Math.random().toString(36).slice(2, 10), at: new Date().toISOString() };
  await writeDoc(path(slug), { ...d, respostas: [...d.respostas, nova], adiadoAte: undefined });
  return nova;
}

export async function adiarNps(slug: string, dias = 14): Promise<void> {
  const d = await getNps(slug);
  await writeDoc(path(slug), { ...d, adiadoAte: new Date(Date.now() + dias * 86400e3).toISOString() });
}

export const ultima = (d: NpsDoc) => d.respostas.at(-1);

/** A pergunta aparece quando faz 90 dias da última resposta (ou nunca respondeu) e o cliente já tem 30 dias de projeto. */
export function npsPendente(d: NpsDoc, clienteDesde: string | undefined): boolean {
  const now = Date.now();
  if (d.adiadoAte && Date.parse(d.adiadoAte) > now) return false;
  if (clienteDesde && now - Date.parse(`${clienteDesde}T12:00:00Z`) < 30 * 86400e3) return false;
  const u = ultima(d);
  return !u || now - Date.parse(u.at) >= NPS_INTERVALO_DIAS * 86400e3;
}

export type NpsGrupo = "promotor" | "neutro" | "detrator";
export const grupo = (score: number): NpsGrupo => (score >= 9 ? "promotor" : score >= 7 ? "neutro" : "detrator");
export const GRUPO_LABEL: Record<NpsGrupo, string> = { promotor: "Promotor", neutro: "Neutro", detrator: "Detrator" };

/** NPS da carteira: % promotores menos % detratores, pela última resposta de cada cliente. */
export function npsScore(ultimas: number[]): number | null {
  if (!ultimas.length) return null;
  const p = ultimas.filter((s) => s >= 9).length, d = ultimas.filter((s) => s <= 6).length;
  return Math.round(((p - d) / ultimas.length) * 100);
}

/** Respondeu nos últimos dias (para mostrar o agradecimento). */
export function respondeuRecente(d: NpsDoc, dias = 3): boolean {
  const u = ultima(d);
  return !!u && Date.now() - Date.parse(u.at) < dias * 86400e3;
}
