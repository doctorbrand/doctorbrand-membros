"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getBrand } from "@/lib/brandStore";
import type { Lote } from "@/lib/canvaLote";
import { saveLote } from "@/lib/canvaLotes";
import { getClient } from "@/lib/clients";
import { getPosts, mediaBelongsTo, updatePost, type Media } from "@/lib/content";
import { driveFolderFiles, parseDriveLinks } from "@/lib/drive";
import { MAX_LAMINAS, MIN_LAMINAS, ordenar, type Lamina, type LaminasPost } from "@/lib/laminas";
import { preencherLaminas } from "@/lib/laminasTexto";
import type { ActionResult } from "@/lib/types";

const page = (slug: string) => `/cliente/${slug}/conteudo`;

/** Foto válida para uma lâmina: arquivo do Drive ou mídia deste cliente no Blob. */
function fotoLimpa(slug: string, m: unknown): Media | undefined {
  if (!m || typeof m !== "object") return undefined;
  const x = m as Media;
  if (typeof x.driveId === "string" && /^[\w-]{10,200}$/.test(x.driveId)) return { driveId: x.driveId, kind: "image", ...(x.name ? { name: String(x.name).slice(0, 200) } : {}) };
  if (typeof x.path === "string" && mediaBelongsTo(x.path, slug)) return { path: x.path, kind: "image", mime: "image/jpeg", ...(x.name ? { name: String(x.name).slice(0, 200) } : {}) };
  return undefined;
}

function laminasLimpas(slug: string, itens: unknown): Lamina[] {
  const lista = Array.isArray(itens) ? itens.slice(0, MAX_LAMINAS + 2) : [];
  const txt = (v: unknown, n: number) => String(v ?? "").replace(/\r/g, "").slice(0, n);
  const limpas: Lamina[] = lista.map((l) => {
    const o = (l ?? {}) as Partial<Lamina>;
    const tipo = o.tipo === "capa" || o.tipo === "final" ? o.tipo : "slide";
    const foto = fotoLimpa(slug, o.foto);
    return { tipo, titulo: txt(o.titulo, 300), subtitulo: txt(o.subtitulo, 300), descricao: txt(o.descricao, 900), ...(foto ? { foto, modoFoto: o.modoFoto === "moldura" ? "moldura" : "fundo", ...(o.posFoto === "cima" || o.posFoto === "baixo" || o.posFoto === "lado" ? { posFoto: o.posFoto } : {}) } : {}) };
  });
  return ordenar(limpas);
}

/** O Claude escreve as lâminas de um carrossel. Mantém as fotos já escolhidas, lâmina por lâmina. */
export async function escreverLaminasAction(slug: string, postId: string, estiloId: string): Promise<ActionResult & { laminas?: LaminasPost }> {
  const s = await requireAdmin();
  try {
    const c = await getClient(slug);
    if (!c) return { ok: false, message: "Cliente não encontrado." };
    const k = await getBrand(slug);
    const post = (await getPosts(slug)).find((p) => p.id === postId);
    if (!post) return { ok: false, message: "Post não encontrado." };
    if (post.type !== "carrossel") return { ok: false, message: `“${post.title}” não é carrossel.` };
    const antes = post.laminas?.itens;
    const { itens } = await preencherLaminas({
      cliente: { nome: c.name, especialidade: c.specialty },
      regras: k.rules,
      post: { titulo: post.title, legenda: post.caption, roteiro: post.roteiro },
      slides: antes ? antes.filter((l) => l.tipo === "slide").length : undefined,
    });
    if (antes) itens.forEach((l, i) => { const a = antes[i]; if (a?.foto && a.tipo === l.tipo) { l.foto = a.foto; l.modoFoto = a.modoFoto; l.posFoto = a.posFoto; } });
    const laminas: LaminasPost = { estiloId, itens, at: new Date().toISOString(), by: s.name };
    // Atenção: em updatePost, devolver null APAGA o post. Aqui sempre devolve o post.
    await updatePost(slug, postId, (p) => ({ ...p, laminas }));
    revalidatePath(page(slug));
    return { ok: true, message: `Lâminas prontas: ${post.title}`, laminas };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** Grava as lâminas editadas na tela (texto, ordem, fotos e modelo). */
export async function salvarLaminasAction(slug: string, postId: string, estiloId: string, itens: Lamina[]): Promise<ActionResult & { laminas?: LaminasPost }> {
  const s = await requireAdmin();
  const atual = (await getPosts(slug)).find((x) => x.id === postId);
  if (!atual) return { ok: false, message: "Post não encontrado." };
  const limpas = laminasLimpas(slug, itens);
  if (limpas.length < MIN_LAMINAS || limpas.length > MAX_LAMINAS) return { ok: false, message: `O carrossel precisa ter de ${MIN_LAMINAS} a ${MAX_LAMINAS} lâminas.` };
  const laminas: LaminasPost = { estiloId: String(estiloId).slice(0, 60), itens: limpas, at: new Date().toISOString(), by: s.name };
  await updatePost(slug, postId, (p) => ({ ...p, laminas }));
  return { ok: true, message: "Salvo.", laminas };
}

/** Fotos da pasta do Drive do cliente (kit de marca), para escolher nas lâminas. */
export async function fotosDaPastaAction(slug: string): Promise<ActionResult & { fotos?: Media[] }> {
  await requireAdmin();
  const k = await getBrand(slug);
  const id = k.driveFolder ? parseDriveLinks(k.driveFolder).folders[0] ?? (/^[\w-]{10,}$/.test(k.driveFolder) ? k.driveFolder : undefined) : undefined;
  if (!id) return { ok: false, message: "Este cliente ainda não tem pasta de fotos no kit de marca." };
  try {
    const fotos = (await driveFolderFiles(id)).filter((f) => f.mime.startsWith("image/")).slice(0, 200).map((f): Media => ({ driveId: f.id, kind: "image", name: f.name }));
    return { ok: true, message: `${fotos.length} fotos`, fotos };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Não consegui ler a pasta do Drive." };
  }
}

/** Guarda a ordem dos carrosséis levados ao Canva (01, 02…), para casar os ZIPs na volta. */
export async function loteAction(slug: string, estiloTitulo: string, postIds: string[]): Promise<ActionResult & { lote?: Lote }> {
  const s = await requireAdmin();
  const posts = await getPosts(slug);
  const ids = postIds.filter((id) => posts.some((p) => p.id === id && p.laminas)).slice(0, 50);
  if (!ids.length) return { ok: false, message: "Nenhum carrossel com lâminas." };
  const lote: Lote = { id: crypto.randomUUID().slice(0, 8), at: new Date().toISOString(), by: s.name, modeloId: "", modeloTitulo: String(estiloTitulo).slice(0, 60), postIds: ids };
  await saveLote(slug, lote);
  return { ok: true, message: "Lote salvo.", lote };
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
