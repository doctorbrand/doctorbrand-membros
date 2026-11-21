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

export type AreaRadar = "plastica" | "dermatologia" | "oftalmologia" | "odontologia" | "tecnologia" | "mercado";

export const AREAS: Record<AreaRadar, { nome: string }> = {
  plastica: { nome: "Cirurgia plástica" },
  dermatologia: { nome: "Dermatologia" },
  oftalmologia: { nome: "Oftalmologia" },
  odontologia: { nome: "Odontologia" },
  tecnologia: { nome: "Tecnologia" },
  mercado: { nome: "Mercado médico" },
};

const sem = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Especialidade do Radar pelo cadastro do cliente. */
export function areaDoCliente(c: Pick<Client, "specialty">): AreaRadar | null {
  const s = sem(c.specialty);
  return /plastic/.test(s) ? "plastica" : /dermato/.test(s) ? "dermatologia" : /oftalmo/.test(s) ? "oftalmologia" : /odonto|dentist|dental/.test(s) ? "odontologia" : null;
}

/**
 * Frentes que o cliente vê: a especialidade dele (se o Radar cobre) mais Tecnologia e Mercado médico.
 * Quem é da saúde sem especialidade coberta (gestão de clínicas, marketing médico) vê só as duas gerais.
 * Quem não é da saúde (outros negócios) não vê o Radar.
 */
export function frentesDoCliente(c: Pick<Client, "specialty">): AreaRadar[] {
  const esp = areaDoCliente(c);
  const saude = !!esp || /medic|clinic|saude|cirurg|odonto|dent/.test(sem(c.specialty));
  return saude ? [...(esp ? [esp] : []), "tecnologia", "mercado"] : [];
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
