"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { lerCarrosseis } from "@/lib/importCarrosseis";
import { gravarCarrosseis } from "@/lib/carrosseis";
import type { ActionResult } from "@/lib/types";

/**
 * Importa um documento de carrosséis já escritos: cada "## título" vira um post de carrossel em rascunho com a
 * legenda, o roteiro e o texto de cada slide, exatamente como no documento. O Estúdio monta no Canva depois.
 * Carrossel com o mesmo título (ainda não publicado) é atualizado em vez de duplicado.
 */
export async function importarCarrosseisAction(slug: string, texto: string, opts: { start: string; everyDays: number; time: string }): Promise<ActionResult & { criados?: number; atualizados?: number }> {
  const s = await requireAdmin();
  const lidos = lerCarrosseis(String(texto ?? "").slice(0, 400_000));
  if (!lidos.length) return { ok: false, message: "Não achei carrosséis no texto. Cada um começa com uma linha “## Título” e tem linhas “**Slide 1 (capa):** …”." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.start)) return { ok: false, message: "Escolha a data do primeiro carrossel." };
  const r = await gravarCarrosseis(slug, lidos.map((c) => ({ titulo: c.titulo, legenda: c.legenda, roteiro: c.roteiro, slides: c.slides, modelo: c.modelo })), { ...opts, por: s.name, papel: s.role, nota: "Importado do documento de carrosséis" });
  revalidatePath(`/cliente/${slug}/conteudo`);
  const avisos = lidos.flatMap((c) => c.avisos.map((a) => `“${c.titulo}” ${a}.`));
  const partes = [r.criados ? `${r.criados} ${r.criados === 1 ? "carrossel criado" : "carrosséis criados"}` : "", r.atualizados ? `${r.atualizados} ${r.atualizados === 1 ? "atualizado" : "atualizados"}` : ""].filter(Boolean).join(" e ");
  return { ok: true, message: `${partes}. Agora é abrir o Estúdio e montar no Canva.${avisos.length ? ` ${avisos.join(" ")}` : ""}`, criados: r.criados, atualizados: r.atualizados };
}
