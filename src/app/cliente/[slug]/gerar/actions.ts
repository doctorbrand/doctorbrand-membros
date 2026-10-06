"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { ORDER_TYPES, getOrder, saveOrder, updateOrder, type ContentOrder, type OrderType } from "@/lib/orders";
import { custoUSD, gerarLote, type Peca } from "@/lib/claudeGen";
import { getPlan, getPosts, savePosts, type Post, type PostType } from "@/lib/content";
import { signPath } from "@/lib/signed";
import type { ActionResult } from "@/lib/types";

export async function saveOrderAction(slug: string, o: { periodo: string; quantidades: Record<string, number>; servicos: string[]; foco?: string; texto?: string }): Promise<ActionResult & { link?: string; id?: string }> {
  const s = await requireAdmin();
  const quantidades = Object.fromEntries(ORDER_TYPES.map((t) => [t.key, Math.max(0, Math.min(40, Math.round(Number(o.quantidades?.[t.key]) || 0)))])) as Record<OrderType, number>;
  if (!Object.values(quantidades).some((n) => n > 0)) return { ok: false, message: "Escolha pelo menos um tipo de conteúdo." };
  const order: ContentOrder = { id: crypto.randomUUID(), at: new Date().toISOString(), by: s.name, periodo: String(o.periodo || "").slice(0, 60), quantidades, servicos: (o.servicos ?? []).map(String).slice(0, 20), foco: String(o.foco ?? "").slice(0, 600) || undefined, texto: String(o.texto ?? "").slice(0, 60000) || undefined };
  await saveOrder(slug, order);
  revalidatePath(`/cliente/${slug}/gerar`);
  const { e, s: sig } = signPath(`pedido/${slug}/${order.id}`, 14 * 24 * 3600);
  return { ok: true, message: "Pedido registrado.", id: order.id, link: `/api/pedido?c=${slug}&id=${order.id}&e=${e}&s=${sig}` };
}

export type LoteResult = ActionResult & { pecas?: Peca[]; perguntas?: string[]; custo?: number };

/** Gera um lote de peças de um tipo pela API do Claude e junta ao pedido. Chamado em sequência pela tela. */
export async function gerarLoteAction(slug: string, orderId: string, tipoRaw: string, n: number): Promise<LoteResult> {
  await requireAdmin();
  const def = ORDER_TYPES.find((t) => t.key === tipoRaw);
  const tipo = tipoRaw as OrderType;
  const order = await getOrder(slug, orderId);
  if (!def || !order?.texto) return { ok: false, message: "Pedido não encontrado. Monte o pedido de novo." };
  const qtd = Math.max(1, Math.min(4, Math.round(n)));
  try {
    const ja = (order.geracao?.pecas ?? []).map((p) => p.titulo).filter(Boolean);
    const lote = await gerarLote(order.texto, tipo, `${def.label}: ${def.hint}`, qtd, ja);
    await updateOrder(slug, orderId, (o) => {
      const g = o.geracao ?? { model: lote.model, at: new Date().toISOString(), pecas: [], perguntas: [], input: 0, output: 0, criados: {} };
      return { ...o, geracao: { ...g, model: lote.model, pecas: [...g.pecas, ...lote.pecas], perguntas: [...new Set([...g.perguntas, ...lote.perguntas])], input: g.input + lote.input, output: g.output + lote.output } };
    });
    return { ok: true, message: `${lote.pecas.length} ${def.label.toLowerCase()} gerados.`, pecas: lote.pecas, perguntas: lote.perguntas, custo: custoUSD(lote.model, lote.input, lote.output) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

const POST_TYPE: Partial<Record<OrderType, PostType>> = { reels: "reels", carrosseis: "carrossel", pessoais: "imagem", estaticos: "imagem" };
const flat = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function roteiroDe(p: Peca): string {
  const linhas: string[] = [];
  const add = (t: string, v?: string | string[]) => {
    if (Array.isArray(v)) { if (v.filter(Boolean).length) linhas.push(`${t}:`, ...v.filter(Boolean).map((x, i) => `${i + 1}. ${x}`), ""); }
    else if (v?.trim()) linhas.push(`${t}: ${v.trim()}`, "");
  };
  add("Objetivo", p.objetivo); add("Gancho", p.gancho); add("Outros ganchos", p.variacoes_gancho);
  add("Roteiro", p.roteiro); add("Slides", p.slides); add("Capa / arte", p.capa); add("Direção visual", p.direcao_visual);
  add("Serviço", p.servico); add("Aproveita", p.base);
  return linhas.join("\n").trim();
}

/** Peças de feed geradas viram rascunhos no planejamento (sem mídia: a equipe produz e sobe as artes). */
export async function criarRascunhosAction(slug: string, orderId: string, indices: number[]): Promise<ActionResult & { criados?: Record<string, string> }> {
  const s = await requireAdmin();
  const order = await getOrder(slug, orderId);
  const g = order?.geracao;
  if (!g) return { ok: false, message: "Nada gerado neste pedido ainda." };
  const [posts, plan] = await Promise.all([getPosts(slug), getPlan(slug)]);
  const now = new Date().toISOString();
  const hoje = now.slice(0, 10);
  const criados: Record<string, string> = { ...g.criados };
  const novos: Post[] = [];
  for (const i of indices) {
    const p = g.pecas[i];
    const type = p && POST_TYPE[p.tipo];
    if (!p || !type || criados[String(i)]) continue;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(p.data) && p.data >= hoje ? p.data : hoje;
    const time = /^\d{2}:\d{2}$/.test(p.horario) ? p.horario : "12:00";
    const pillar = plan.pillars.find((x) => flat(x.name) === flat(p.pilar))?.name ?? plan.pillars.find((x) => p.pilar && flat(x.name).includes(flat(p.pilar).slice(0, 5)))?.name;
    const post: Post = {
      id: crypto.randomUUID(), type, title: (p.titulo || "Post gerado").slice(0, 120), caption: (p.legenda || "").slice(0, 2200), media: [],
      date, time, status: "rascunho", ...(pillar ? { pillar } : {}), roteiro: roteiroDe(p).slice(0, 20000),
      createdAt: now, updatedAt: now,
      history: [{ at: now, by: s.name, role: "admin", action: "criado", note: `Gerado no painel pelo Claude (pedido de ${order!.at.slice(8, 10)}/${order!.at.slice(5, 7)})` }],
    };
    novos.push(post);
    criados[String(i)] = post.id;
  }
  if (!novos.length) return { ok: false, message: "Nenhuma peça nova de feed para criar (stories e anúncios ficam só no texto)." };
  await savePosts(slug, [...posts, ...novos]);
  await updateOrder(slug, orderId, (o) => (o.geracao ? { ...o, geracao: { ...o.geracao, criados } } : o));
  revalidatePath(`/cliente/${slug}/conteudo`);
  revalidatePath(`/cliente/${slug}/gerar`);
  return { ok: true, message: `${novos.length} ${novos.length === 1 ? "rascunho criado" : "rascunhos criados"} no planejamento. Só a equipe vê até enviar para aprovação.`, criados };
}
