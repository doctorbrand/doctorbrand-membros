import { put } from "@vercel/blob";
import JSZip from "jszip";
import { getPosts, savePosts, updatePost, type HistoryEntry, type Media, type Post } from "./content";
import { toJpeg } from "./drive";
import { slidesLimpos, type SlideTexto } from "./slides";
import { localDir } from "./store";

/**
 * Carrosséis do planejamento que passam pelo Canva (só no servidor). Usado pela importação de documento na
 * tela de Conteúdo e pelo conector que o Estúdio de Carrosséis chama: criar os carrosséis com o texto dos
 * slides, listar os que faltam montar e receber de volta o link do Canva e as imagens exportadas.
 */

export interface CarrosselNovo { titulo: string; legenda: string; roteiro?: string; slides: SlideTexto[]; modelo?: string }

const somarDias = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const mesmoTitulo = (p: Post, t: string) => p.type === "carrossel" && p.status !== "publicado" && !p.publish?.igMediaId && p.title.trim().toLowerCase() === t.trim().toLowerCase();

/**
 * Cria cada carrossel em rascunho (datas a partir de `start`, a cada `everyDays`). Se já existe carrossel com o
 * mesmo título, ainda não publicado, atualiza os slides e o roteiro dele (e a legenda, se estiver vazia).
 */
export async function gravarCarrosseis(slug: string, itens: CarrosselNovo[], o: { start: string; everyDays: number; time: string; por: string; papel: HistoryEntry["role"]; nota: string }): Promise<{ criados: number; atualizados: number; ids: string[] }> {
  const every = Math.min(14, Math.max(1, Math.round(Number(o.everyDays) || 1)));
  const time = /^\d{2}:\d{2}$/.test(o.time) ? o.time : "12:00";
  const now = new Date().toISOString();
  const lista = [...(await getPosts(slug))];
  const ids: string[] = [];
  let criados = 0, atualizados = 0;
  for (const c of itens.slice(0, 60)) {
    const titulo = String(c.titulo ?? "").trim().slice(0, 120);
    if (!titulo) continue;
    const slides = slidesLimpos(c.slides);
    const legenda = String(c.legenda ?? "").replace(/\r\n?/g, "\n").trim().slice(0, 2200);
    const roteiro = c.roteiro ? String(c.roteiro).slice(0, 12000) : undefined;
    const modelo = c.modelo ? String(c.modelo).trim().slice(0, 40) || undefined : undefined;
    const i = lista.findIndex((p) => mesmoTitulo(p, titulo));
    if (i >= 0) {
      const p = lista[i];
      lista[i] = { ...p, slides, ...(roteiro ? { roteiro } : {}), ...(modelo ? { canvaModelo: modelo } : {}), ...(p.caption.trim() ? {} : { caption: legenda }), updatedAt: now, history: [...p.history, { at: now, by: o.por, role: o.papel, action: "editado", note: `${o.nota} (texto dos slides atualizado)` }] };
      ids.push(p.id); atualizados++;
      continue;
    }
    const novo: Post = {
      id: crypto.randomUUID(), type: "carrossel", title: titulo, caption: legenda, media: [], slides, ...(roteiro ? { roteiro } : {}), ...(modelo ? { canvaModelo: modelo } : {}),
      date: somarDias(o.start, criados * every), time, status: "rascunho", createdAt: now, updatedAt: now,
      history: [{ at: now, by: o.por, role: o.papel, action: "criado", note: o.nota }],
    };
    lista.push(novo);
    ids.push(novo.id); criados++;
  }
  if (criados || atualizados) await savePosts(slug, lista);
  return { criados, atualizados, ids };
}

/** Carrosséis ainda não publicados, na ordem do planejamento. */
export async function carrosseisDoPlanejamento(slug: string, opts: { soSemCanva?: boolean } = {}) {
  return (await getPosts(slug))
    .filter((p) => p.type === "carrossel" && p.status !== "publicado" && !p.publish?.igMediaId && (!opts.soSemCanva || !p.canvaLink))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .map((p) => ({
      id: p.id, titulo: p.title, data: p.date, hora: p.time, status: p.status, legenda: p.caption,
      slides: p.slides ?? [], roteiro: p.slides?.length ? undefined : p.roteiro,
      canva_link: p.canvaLink ?? null, modelo: p.canvaModelo ?? null, imagens: p.media.length,
    }));
}

/** Só baixa imagens dos endereços de exportação do Canva (nunca de outro lugar). */
const urlDoCanva = (u: string) => { try { const x = new URL(u); return x.protocol === "https:" && /(^|\.)canva\.com$/i.test(x.hostname); } catch { return false; } };
const IMG = /\.(png|jpe?g)$/i;
const natural = (a: string, b: string) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });

async function baixar(url: string): Promise<{ nome: string; buf: Buffer }[]> {
  const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(45_000) });
  if (!r.ok) throw new Error(`Não consegui baixar a imagem exportada do Canva (HTTP ${r.status}). O link de exportação vale por pouco tempo: exporte de novo.`);
  const tipo = (r.headers.get("content-type") ?? "").split(";")[0].trim();
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 60 * 1024 * 1024) throw new Error("Arquivo exportado grande demais.");
  // Exportação de várias páginas pode vir num ZIP: cada imagem dentro é uma página, na ordem do nome.
  if (tipo === "application/zip" || buf.subarray(0, 2).toString() === "PK") {
    const zip = await JSZip.loadAsync(buf);
    const nomes = Object.keys(zip.files).filter((n) => IMG.test(n) && !zip.files[n].dir && !/(^|\/)(__MACOSX|\.)/.test(n)).sort(natural);
    return Promise.all(nomes.map(async (n) => ({ nome: n, buf: Buffer.from(await zip.files[n].async("uint8array")) })));
  }
  if (!tipo.startsWith("image/") && !IMG.test(new URL(url).pathname)) throw new Error("O link exportado não é uma imagem.");
  return [{ nome: new URL(url).pathname.split("/").pop() ?? "pagina", buf }];
}

async function guardar(path: string, buf: Buffer): Promise<void> {
  const dir = localDir();
  if (dir) {
    const fs = await import("fs/promises");
    await fs.mkdir(`${dir}/${path.slice(0, path.lastIndexOf("/"))}`, { recursive: true });
    await fs.writeFile(`${dir}/${path}`, new Uint8Array(buf));
    return;
  }
  await put(path, buf, { access: "private", contentType: "image/jpeg", allowOverwrite: true, addRandomSuffix: false });
}

/**
 * Recebe o carrossel montado no Canva: guarda o link e, quando vierem, as imagens exportadas (uma por página,
 * ou um ZIP), que viram as imagens do post. Aprovado com outras imagens volta para rascunho; publicado ou
 * agendado não muda.
 */
export async function receberDoCanva(slug: string, postId: string, d: { link: string; imagens?: string[]; modelo?: string; por: string; papel: HistoryEntry["role"] }): Promise<{ titulo: string; imagens: number; voltou: boolean }> {
  const atual = (await getPosts(slug)).find((p) => p.id === postId);
  if (!atual) throw new Error("Carrossel não encontrado no planejamento deste cliente.");
  if (atual.type !== "carrossel") throw new Error(`“${atual.title}” não é carrossel.`);
  const urls = (d.imagens ?? []).filter(Boolean);
  if (urls.length && (atual.status === "publicado" || atual.publish?.igMediaId)) throw new Error(`“${atual.title}” já foi publicado: as imagens não podem mudar.`);
  if (urls.length && atual.status === "agendado") throw new Error(`“${atual.title}” está agendado. Tire do agendamento na área antes de trocar as imagens.`);
  const ruim = urls.find((u) => !urlDoCanva(u));
  if (ruim) throw new Error("As imagens precisam vir dos links de exportação do Canva.");

  let media: Media[] | undefined;
  if (urls.length) {
    const paginas: { nome: string; buf: Buffer }[] = [];
    for (const u of urls.slice(0, 12)) paginas.push(...(await baixar(u)));
    if (!paginas.length) throw new Error("A exportação do Canva veio sem imagens.");
    if (paginas.length > 10) throw new Error(`O carrossel tem ${paginas.length} páginas. O Instagram aceita até 10.`);
    const pasta = `content-media/${slug}/canva/${postId}-${Date.now().toString(36)}`;
    media = [];
    for (const [j, p] of paginas.entries()) {
      const nome = `${String(j + 1).padStart(2, "0")}.jpg`;
      const jpg = /\.jpe?g$/i.test(p.nome) && p.buf[0] === 0xff ? p.buf : await toJpeg(p.buf);
      await guardar(`${pasta}/${nome}`, jpg);
      media.push({ path: `${pasta}/${nome}`, kind: "image", mime: "image/jpeg", name: nome });
    }
  }
  // Grava relendo o post (o download pode levar alguns segundos e alguém pode ter mexido nele nesse meio-tempo).
  // Atenção: em updatePost, devolver null APAGA o post. Aqui sempre devolve o post.
  const now = new Date().toISOString();
  let voltou = false;
  const salvo = await updatePost(slug, postId, (p) => {
    const travado = p.status === "publicado" || !!p.publish?.igMediaId || p.status === "agendado";
    const usar = media && !travado ? media : undefined;
    voltou = !!usar && p.status === "aprovado";
    return {
      ...p, canvaLink: d.link, ...(d.modelo ? { canvaModelo: d.modelo.slice(0, 40) } : {}), updatedAt: now,
      ...(usar ? { media: usar, publish: undefined, ...(voltou ? { status: "rascunho" as const } : {}) } : {}),
      history: [...p.history, { at: now, by: d.por, role: d.papel, action: "editado", note: usar ? `Montado no Canva: ${usar.length} imagens${voltou ? "; voltou para rascunho porque já estava aprovado com outras imagens" : ""}` : "Link do Canva salvo" }],
    };
  });
  if (!salvo) throw new Error("Carrossel não encontrado no planejamento deste cliente.");
  return { titulo: atual.title, imagens: media?.length ?? 0, voltou };
}
