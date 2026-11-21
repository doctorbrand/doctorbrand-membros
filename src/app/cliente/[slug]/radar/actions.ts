"use server";

import { revalidatePath } from "next/cache";
import { sendAlert } from "@/lib/alerts";
import { PREVIEW_BLOCK, requireAuth } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { avisarEquipe } from "@/lib/push";
import { areaDoCliente, getPedidosRadar, noticiasDaArea, savePedidosRadar } from "@/lib/radar";
import { publicBase } from "@/lib/signed";
import type { ActionResult } from "@/lib/types";

/** O cliente pede um conteúdo a partir de uma notícia do Radar. A equipe recebe o aviso e prepara. */
export async function pedirConteudoRadarAction(slug: string, noticia: string, _prev: ActionResult | null): Promise<ActionResult> {
  const s = await requireAuth(slug);
  if (s.preview) return PREVIEW_BLOCK;
  if (!/^[a-z0-9-]{1,120}$/.test(noticia)) return { ok: false, message: "Notícia inválida." };
  const c = await getClient(slug);
  const area = c ? areaDoCliente(c) : null;
  if (!c || !area) return { ok: false, message: "O Radar não está disponível para este cliente." };
  const n = (await noticiasDaArea(area).catch(() => [])).find((x) => x.id === noticia);
  if (!n) return { ok: false, message: "Não encontrei esta notícia. Atualize a página e tente de novo." };

  const lista = await getPedidosRadar(slug);
  if (lista.some((p) => p.noticia === noticia)) return { ok: true, message: "Este pedido já foi enviado." };
  await savePedidosRadar(slug, [{ noticia, titulo: n.titulo, at: new Date().toISOString(), por: s.name }, ...lista]);

  const quem = s.role === "admin" ? `${s.name} (equipe)` : s.name;
  await sendAlert(`*Radar · ${c.name}*\n${quem} pediu um conteúdo sobre: ${n.titulo}${n.formato ? ` (sugestão: ${n.formato})` : ""}\n${n.url ?? ""}\n${publicBase()}/cliente/${slug}/radar`).catch(() => undefined);
  await avisarEquipe({ title: c.name, body: `Pediu conteúdo sobre: ${n.titulo}`, url: `/cliente/${slug}/radar`, tag: `radar-${slug}-${noticia}` }).catch(() => 0);
  revalidatePath(`/cliente/${slug}/radar`);
  return { ok: true, message: "Pedido enviado. A equipe prepara e manda para você aprovar." };
}
