"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getBrand } from "@/lib/brandStore";
import { planilhaCsv, type Lote } from "@/lib/canvaLote";
import { preencherCampos } from "@/lib/canvaTexto";
import { getClient } from "@/lib/clients";
import { getPosts, mediaBelongsTo, updatePost, type Media } from "@/lib/content";
import { saveLote } from "@/lib/canvaLotes";
import type { ActionResult } from "@/lib/types";

const page = (slug: string) => `/cliente/${slug}/conteudo`;
async function modeloDo(slug: string, modeloId: string) {
  const k = await getBrand(slug);
  const m = (k.canvaModelos ?? []).find((x) => x.id === modeloId);
  if (!m) throw new Error("Modelo não encontrado no kit de marca deste cliente.");
  return { k, m };
}

/** O Claude escreve o texto das lâminas de um carrossel para as colunas do modelo. Uma chamada por post. */
export async function escreverLaminasAction(slug: string, postId: string, modeloId: string): Promise<ActionResult & { campos?: Record<string, string> }> {
  const s = await requireAdmin();
  try {
    const c = await getClient(slug);
    if (!c) return { ok: false, message: "Cliente não encontrado." };
    const { k, m } = await modeloDo(slug, modeloId);
    const post = (await getPosts(slug)).find((p) => p.id === postId);
    if (!post) return { ok: false, message: "Post não encontrado." };
    if (post.type !== "carrossel") return { ok: false, message: `“${post.title}” não é carrossel.` };
    const { campos } = await preencherCampos({
      cliente: { nome: c.name, especialidade: c.specialty },
      regras: k.rules,
      modelo: m,
      post: { titulo: post.title, legenda: post.caption, roteiro: post.roteiro },
    });
    await updatePost(slug, postId, (p) => ({ ...p, canva: { modeloId: m.id, modeloTitulo: m.titulo, campos, at: new Date().toISOString(), by: s.name } }));
    revalidatePath(page(slug));
    return { ok: true, message: `Texto pronto: ${post.title}`, campos };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** Ajuste à mão de uma coluna antes de baixar a planilha. */
export async function salvarCampoAction(slug: string, postId: string, campo: string, valor: string): Promise<ActionResult> {
  await requireAdmin();
  // Atenção: em updatePost, devolver null APAGA o post. Por isso a checagem vem antes.
  const atual = (await getPosts(slug)).find((x) => x.id === postId);
  if (!atual?.canva || !(campo in atual.canva.campos)) return { ok: false, message: "Campo não encontrado." };
  const texto = String(valor).replace(/\s+/g, " ").trim().slice(0, 600);
  await updatePost(slug, postId, (x) => (x.canva ? { ...x, canva: { ...x.canva, campos: { ...x.canva.campos, [campo]: texto } } } : x));
  return { ok: true, message: "Salvo." };
}

/** Monta a planilha (CSV) do lote, na ordem escolhida, e guarda o lote para casar o ZIP na volta. */
export async function planilhaAction(slug: string, modeloId: string, postIds: string[]): Promise<ActionResult & { csv?: string; nome?: string; lote?: Lote }> {
  const s = await requireAdmin();
  try {
    const { m } = await modeloDo(slug, modeloId);
    const posts = await getPosts(slug);
    const linhas = [];
    for (const id of postIds.slice(0, 100)) {
      const p = posts.find((x) => x.id === id);
      if (!p) continue;
      if (p.canva?.modeloId !== m.id) return { ok: false, message: `“${p.title}” ainda não tem o texto escrito para o modelo ${m.titulo}.` };
      linhas.push({ id: p.id, titulo: p.title, campos: p.canva.campos });
    }
    if (!linhas.length) return { ok: false, message: "Escolha os carrosséis do lote." };
    const lote: Lote = { id: crypto.randomUUID().slice(0, 8), at: new Date().toISOString(), by: s.name, modeloId: m.id, modeloTitulo: m.titulo, postIds: linhas.map((l) => l.id) };
    await saveLote(slug, lote);
    const dia = new Date().toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 10);
    const nome = `${slug}-${m.titulo}-${dia}.csv`.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "-").toLowerCase();
    revalidatePath(page(slug));
    return { ok: true, message: `Planilha com ${linhas.length} ${linhas.length === 1 ? "carrossel" : "carrosséis"}.`, csv: planilhaCsv(m, linhas), nome, lote };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** Anexa ao post as lâminas que voltaram do Canva (já enviadas ao Blob pelo navegador). */
export async function anexarLaminasAction(slug: string, postId: string, media: Media[]): Promise<ActionResult> {
  const s = await requireAdmin();
  const limpas = (Array.isArray(media) ? media : []).filter((m) => m && typeof m.path === "string" && mediaBelongsTo(m.path, slug))
    .map((m): Media => ({ path: m.path, kind: "image", mime: "image/jpeg", ...(m.name ? { name: String(m.name).slice(0, 200) } : {}) }));
  if (!limpas.length) return { ok: false, message: "Nenhuma lâmina válida." };
  if (limpas.length > 10) return { ok: false, message: "O Instagram aceita até 10 lâminas por carrossel." };
  // Atenção: em updatePost, devolver null APAGA o post. Por isso a checagem vem antes.
  const atual = (await getPosts(slug)).find((x) => x.id === postId);
  if (!atual) return { ok: false, message: "Post não encontrado." };
  if (atual.status === "publicado" || atual.publish?.igMediaId) return { ok: false, message: `“${atual.title}” já foi publicado: as lâminas não podem mudar.` };
  if (atual.status === "agendado") return { ok: false, message: `“${atual.title}” está agendado. Tire do agendamento antes de trocar as lâminas.` };
  const now = new Date().toISOString();
  // Aprovado com outras lâminas: a aprovação não vale para as novas, então volta para rascunho.
  const voltou = atual.status === "aprovado";
  const p = await updatePost(slug, postId, (x) => ({
    ...x, type: "carrossel", media: limpas, publish: undefined, updatedAt: now, ...(voltou ? { status: "rascunho" as const } : {}),
    history: [...x.history, { at: now, by: s.name, role: s.role, action: "editado", note: `Lâminas do Canva anexadas (${limpas.length})${voltou ? "; voltou para rascunho porque já estava aprovado com outras lâminas" : ""}` }],
  }));
  if (!p) return { ok: false, message: "Post não encontrado." };
  revalidatePath(page(slug));
  return { ok: true, message: `${p.title}: ${limpas.length} lâminas${voltou ? " (voltou para rascunho)" : ""}.` };
}
