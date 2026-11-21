import type { Client } from "./clients";
import { readDoc, writeDoc } from "./store";

/**
 * Radar por especialidade para os clientes. As notícias ficam no banco do Radar (Supabase) e são lidas
 * pela função radar_por_area, que só responde com o código de acesso da equipe (RADAR_CODIGO, na Vercel).
 * O cliente vê só a área dele, sem o status interno da equipe nem os roteiros.
 */

const SUPABASE_URL = "https://netsrdpqpqabymibgwdg.supabase.co";
/** Chave pública (anon) do projeto, a mesma que já vai na página do Radar. Sem o código, ela não lê nada. */
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ldHNyZHBxcHFhYnltaWJnd2RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0Nzk5NjQsImV4cCI6MjA5NzA1NTk2NH0.4g8lsivQhcxFuI9-65XeZPOlYfuRmhxHCfpOZUCUILI";

export type AreaRadar = "plastica" | "oftalmologia" | "odontologia" | "dermatologia";

export const AREAS: Record<AreaRadar, { nome: string; profissional: string }> = {
  plastica: { nome: "Cirurgia plástica", profissional: "cirurgiões plásticos" },
  oftalmologia: { nome: "Oftalmologia", profissional: "oftalmologistas" },
  odontologia: { nome: "Odontologia", profissional: "dentistas" },
  dermatologia: { nome: "Dermatologia", profissional: "dermatologistas" },
};

/** Áreas com varredura diária. Dermatologia fica de fora até a decisão sobre ela. */
const ATIVAS: AreaRadar[] = ["plastica", "oftalmologia", "odontologia"];

/** Área do Radar pela especialidade do cadastro. Sem área ativa, o cliente não vê o Radar. */
export function areaDoCliente(c: Pick<Client, "specialty">): AreaRadar | null {
  const s = c.specialty.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const a: AreaRadar | null = /plastic/.test(s) ? "plastica" : /oftalmo/.test(s) ? "oftalmologia" : /odonto|dentist|dental/.test(s) ? "odontologia" : /dermato/.test(s) ? "dermatologia" : null;
  return a && ATIVAS.includes(a) ? a : null;
}

export const radarLigado = () => !!process.env.RADAR_CODIGO?.trim();

export interface NoticiaRadar {
  id: string;
  titulo: string;
  resumo?: string;
  fonte?: string;
  url?: string;
  data?: string;
  categoria?: string;
  regiao?: string;
  relevancia?: number;
  angulo?: string;
  gancho?: string;
  formato?: string;
  adicionado?: string;
}

const cache = new Map<AreaRadar, { at: number; itens: NoticiaRadar[] }>();

/** Notícias da área (até 120 dias), com 10 minutos de cache. */
export async function noticiasDaArea(area: AreaRadar): Promise<NoticiaRadar[]> {
  const hit = cache.get(area);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.itens;
  const codigo = process.env.RADAR_CODIGO?.trim().toUpperCase();
  if (!codigo) throw new Error("Radar não configurado.");
  const r = await fetch(`${process.env.RADAR_SUPABASE_URL ?? SUPABASE_URL}/rest/v1/rpc/radar_por_area`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_codigo: codigo, p_area: area }),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!r.ok) throw new Error([400, 401, 403].includes(r.status) ? "O código do Radar não confere." : `Radar respondeu ${r.status}.`);
  const itens = ((await r.json()) ?? []) as NoticiaRadar[];
  cache.set(area, { at: Date.now(), itens });
  return itens;
}

/** Pedidos de conteúdo feitos pelo cliente a partir de uma notícia (para a tela mostrar "Pedido enviado"). */
export interface PedidoRadar { noticia: string; titulo: string; at: string; por: string }
export const getPedidosRadar = (slug: string) => readDoc<PedidoRadar[]>(`radar-pedidos/${slug}`, []);
export const savePedidosRadar = (slug: string, l: PedidoRadar[]) => writeDoc(`radar-pedidos/${slug}`, l.slice(0, 200));
