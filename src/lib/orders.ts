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
}

export const getOrders = (slug: string) => readDoc<ContentOrder[]>(`pedidos/${slug}`, []);

export async function saveOrder(slug: string, o: ContentOrder): Promise<void> {
  const cur = await getOrders(slug);
  await writeDoc(`pedidos/${slug}`, [o, ...cur].slice(0, 50));
}
