import type { Peca } from "./claudeGen";
import { readDoc, writeDoc } from "./store";

/** Tipos de conteúdo que a equipe pede para a IA gerar, com as quantidades oferecidas na tela. */
export const ORDER_TYPES = [
  { key: "reels", label: "Reels", hint: "Roteiro completo, gancho, legenda e capa sugerida", options: [0, 4, 6, 8, 12, 16, 20] },
  { key: "carrosseis", label: "Carrosséis", hint: "Texto de cada slide, legenda e direção visual", options: [0, 2, 4, 6, 8, 12] },
  { key: "pessoais", label: "Posts pessoais", hint: "Bastidores, história e rotina do profissional", options: [0, 2, 4, 6, 8] },
  { key: "estaticos", label: "Posts estáticos", hint: "Foto única com frase ou dado e legenda", options: [0, 2, 4, 6, 8] },
  { key: "stories", label: "Sequências de stories", hint: "Telas, recurso interativo e objetivo", options: [0, 5, 7, 10, 14, 20] },
  { key: "anuncios", label: "Anúncios (criativos)", hint: "Criativo, texto principal, título e público sugerido", options: [0, 3, 5, 8, 10] },
] as const;

export type OrderType = (typeof ORDER_TYPES)[number]["key"];

export interface ContentOrder {
  id: string;
  at: string;
  by: string;
  periodo: string;
  quantidades: Record<OrderType, number>;
  servicos: string[];
  foco?: string;
  /** Pedido completo como vai para o Claude (perfil, plano, histórico deste cliente). */
  texto?: string;
  /** Resultado da geração feita no painel (API do Claude). */
  geracao?: Geracao;
}

export interface Geracao {
  model: string;
  at: string;
  pecas: Peca[];
  perguntas: string[];
  input: number;
  output: number;
  /** Índices das peças que já viraram rascunho no planejamento (índice → id do post). */
  criados: Record<string, string>;
}

export const getOrders = (slug: string) => readDoc<ContentOrder[]>(`pedidos/${slug}`, []);

export async function getOrder(slug: string, id: string): Promise<ContentOrder | undefined> {
  return (await getOrders(slug)).find((o) => o.id === id);
}

export async function saveOrder(slug: string, o: ContentOrder): Promise<void> {
  const cur = await getOrders(slug);
  await writeDoc(`pedidos/${slug}`, [o, ...cur].slice(0, 50));
}

/** Atualiza um pedido (por exemplo, juntando um lote gerado). */
export async function updateOrder(slug: string, id: string, fn: (o: ContentOrder) => ContentOrder): Promise<ContentOrder | undefined> {
  const cur = await getOrders(slug);
  const i = cur.findIndex((o) => o.id === id);
  if (i < 0) return undefined;
  cur[i] = fn(cur[i]);
  await writeDoc(`pedidos/${slug}`, cur);
  return cur[i];
}
