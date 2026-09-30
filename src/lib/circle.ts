import { readDoc, writeDoc } from "./store";

/**
 * Circle DoctorBrand: o cliente indica colegas com afinidade real; quando a indicação vira cliente,
 * ele sobe de nível. A recompensa não é financeira: acesso, status e proximidade estratégica.
 */
export type IndicacaoStatus = "recebida" | "contato" | "proposta" | "fechou" | "nao";

export const STATUS_LABEL: Record<IndicacaoStatus, string> = {
  recebida: "Recebida", contato: "Em conversa", proposta: "Proposta enviada", fechou: "Virou cliente", nao: "Não seguiu",
};

export interface Indicacao {
  id: string;
  slug: string;
  nome: string;
  especialidade?: string;
  contato: string;
  cidade?: string;
  obs?: string;
  status: IndicacaoStatus;
  at: string;
  updatedAt: string;
  por: string;
}

export const NIVEIS: { n: number; titulo: string; texto: string; emBreve?: boolean }[] = [
  { n: 1, titulo: "Sessão estratégica exclusiva", texto: "Uma sessão com o Fernando e acesso aos frameworks internos da DoctorBrand." },
  { n: 2, titulo: "Captação audiovisual extra", texto: "Um dia de gravação além do seu plano." },
  { n: 3, titulo: "Experiência exclusiva", texto: "Um encontro fechado com médicos selecionados. Em breve.", emBreve: true },
  { n: 4, titulo: "Apoio estratégico na clínica", texto: "Acompanhamento direto na sua clínica por até 3 meses." },
  { n: 5, titulo: "Podcast e marca conjunta", texto: "Participação em podcast e associação direta à marca DoctorBrand." },
];

export const LIMITE_ATIVAS = 10;

interface CircleDoc { indicacoes: Indicacao[]; entregues: Record<string, number[]> }
const DOC = "circle";

export const getCircle = () => readDoc<CircleDoc>(DOC, { indicacoes: [], entregues: {} });

export async function addIndicacao(i: Omit<Indicacao, "id" | "at" | "updatedAt" | "status">): Promise<Indicacao> {
  const d = await getCircle();
  const now = new Date().toISOString();
  const nova: Indicacao = { ...i, id: Math.random().toString(36).slice(2, 10), status: "recebida", at: now, updatedAt: now };
  await writeDoc(DOC, { ...d, indicacoes: [...d.indicacoes, nova] });
  return nova;
}

export async function setStatus(id: string, status: IndicacaoStatus): Promise<Indicacao | undefined> {
  const d = await getCircle();
  const i = d.indicacoes.find((x) => x.id === id);
  if (!i) return undefined;
  i.status = status; i.updatedAt = new Date().toISOString();
  await writeDoc(DOC, d);
  return i;
}

export async function marcarEntregue(slug: string, nivel: number): Promise<void> {
  const d = await getCircle();
  const cur = new Set(d.entregues[slug] ?? []);
  cur.add(nivel);
  await writeDoc(DOC, { ...d, entregues: { ...d.entregues, [slug]: [...cur].sort() } });
}

/** Nível do cliente = indicações que viraram cliente (até 5). */
export function nivelDe(ind: Indicacao[], slug: string): number {
  return Math.min(5, ind.filter((i) => i.slug === slug && i.status === "fechou").length);
}

/** Recompensas conquistadas e ainda não entregues (o nível 3 fica de fora enquanto for "em breve"). */
export function aEntregar(d: CircleDoc, slug: string): number[] {
  const nivel = nivelDe(d.indicacoes, slug);
  const entregues = new Set(d.entregues[slug] ?? []);
  return NIVEIS.filter((n) => n.n <= nivel && !n.emBreve && !entregues.has(n.n)).map((n) => n.n);
}
