"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendAlert } from "@/lib/alerts";
import { requireAdmin, requireAuth, type Session , PREVIEW_BLOCK } from "@/lib/auth";
import { publicBase } from "@/lib/signed";
import { getPosts, mediaBelongsTo, plannedAt, savePlan, savePosts, updatePost, type FeedPlan, type HistoryEntry, type Media, type Post, type PostStatus, type PostType } from "@/lib/content";
import { driveFileInfo, driveFolderFiles, driveText, FOLDER, parseDriveLinks, toMedia, type DriveFile } from "@/lib/drive";
import { igAccounts } from "@/lib/instagram";
import { getClient, updateClient } from "@/lib/clients";
import { publishProblem, stepPublish } from "@/lib/publish";
import type { ActionResult } from "@/lib/types";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const path = (slug: string) => `/cliente/${slug}/conteudo`;

function entry(s: Session, action: HistoryEntry["action"], note?: string, slide?: number): HistoryEntry {
  return { at: new Date().toISOString(), by: s.name, role: s.role, action, ...(note ? { note } : {}), ...(slide ? { slide } : {}) };
}

/** Aviso para a equipe (Telegram/WhatsApp configurados no painel). Nunca bloqueia a ação do cliente. */
async function notifyTeam(slug: string, text: string) {
  const c = await getClient(slug).catch(() => null);
  await sendAlert(`*Conteúdo · ${c?.name ?? slug}*\n${text}\n${publicBase()}${path(slug)}`).catch(() => undefined);
}

export async function approvePostAction(slug: string, id: string, _prev: ActionResult | null): Promise<ActionResult> {
  const s = await requireAuth(slug);
  if (s.preview) return PREVIEW_BLOCK;
  let title = "";
  const p = await updatePost(slug, id, (p) => {
    if (!["aguardando", "alteracao"].includes(p.status)) return p;
    title = p.title;
    return { ...p, status: "aprovado", history: [...p.history, entry(s, "aprovado")] };
  });
  if (!p) return { ok: false, message: "Post não encontrado." };
  if (s.role === "cliente" && title) await notifyTeam(slug, `${s.name} aprovou *${title}*.`);
  revalidatePath(path(slug));
  return { ok: true, message: "Aprovado. Obrigado!" };
}

export async function approveAllAction(slug: string, _prev: ActionResult | null): Promise<ActionResult> {
  const s = await requireAuth(slug);
  if (s.preview) return PREVIEW_BLOCK;
  const posts = await getPosts(slug);
  let n = 0;
  const next = posts.map((p) => {
    if (p.status !== "aguardando") return p;
    n++;
    return { ...p, status: "aprovado" as const, updatedAt: new Date().toISOString(), history: [...p.history, entry(s, "aprovado", "Aprovado em lote")] };
  });
  if (n === 0) return { ok: false, message: "Não há posts aguardando aprovação." };
  await savePosts(slug, next);
  if (s.role === "cliente") await notifyTeam(slug, `${s.name} aprovou ${n} post${n > 1 ? "s" : ""} de uma vez.`);
  revalidatePath(path(slug));
  return { ok: true, message: `${n} post${n > 1 ? "s aprovados" : " aprovado"}.` };
}

export async function requestChangeAction(slug: string, id: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await requireAuth(slug);
  if (s.preview) return PREVIEW_BLOCK;
  const note = str(fd, "note");
  const slide = Number(str(fd, "slide")) || undefined;
  if (!note) return { ok: false, message: "Conte o que você quer mudar." };
  let title = "";
  const p = await updatePost(slug, id, (p) => {
    title = p.title;
    return { ...p, status: "alteracao", history: [...p.history, entry(s, "alteracao", note, slide)] };
  });
  if (!p) return { ok: false, message: "Post não encontrado." };
  if (s.role === "cliente") await notifyTeam(slug, `${s.name} pediu alteração em *${title}*${slide ? ` (imagem ${slide})` : ""}:\n"${note.slice(0, 500)}"`);
  revalidatePath(path(slug));
  return { ok: true, message: "Pedido enviado para a equipe." };
}

/** Destino depois de decidir: só dentro da página de conteúdo deste cliente. */
function afterDecision(slug: string, next: string, done: "aprovado" | "alteracao"): string {
  const b = path(slug);
  const safe = typeof next === "string" && next.startsWith(b) && !next.includes("//") ? next : b;
  const [pathq, hash] = safe.split("#");
  return `${pathq}${pathq.includes("?") ? "&" : "?"}feito=${done}${hash ? `#${hash}` : ""}`;
}

/** Aprovar e seguir para o próximo post que espera aprovação. */
export async function approveAndNextAction(slug: string, id: string, next: string, prev: ActionResult | null): Promise<ActionResult> {
  const r = await approvePostAction(slug, id, prev);
  if (!r.ok) return r;
  redirect(afterDecision(slug, next, "aprovado"));
}

/** Pedir alteração e seguir para o próximo post que espera aprovação. */
export async function changeAndNextAction(slug: string, id: string, next: string, prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const r = await requestChangeAction(slug, id, prev, fd);
  if (!r.ok) return r;
  redirect(afterDecision(slug, next, "alteracao"));
}

// ─── Equipe ────────────────────────────────────────────────────────────

function parseMedia(raw: string, slug: string): Media[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as Media[];
    return arr.flatMap((m): Media[] => {
      if (!m) return [];
      const kind = m.kind === "video" ? "video" : "image";
      const base = { kind, ...(m.name ? { name: String(m.name).slice(0, 200) } : {}), ...(m.mime ? { mime: String(m.mime).slice(0, 80) } : {}) } as Media;
      if (typeof m.driveId === "string" && /^[\w-]{10,}$/.test(m.driveId)) return [{ ...base, driveId: m.driveId, ...(m.path && mediaBelongsTo(m.path, slug) ? { path: m.path } : {}) }];
      if (typeof m.path === "string" && mediaBelongsTo(m.path, slug)) return [{ ...base, path: m.path }];
      return [];
    });
  } catch { return []; }
}

export async function savePostAction(slug: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await requireAdmin();
  const id = str(fd, "id");
  const type = (["imagem", "carrossel", "reels"].includes(str(fd, "type")) ? str(fd, "type") : "imagem") as PostType;
  const title = str(fd, "title");
  const caption = String(fd.get("caption") ?? "").replace(/\r\n?/g, "\n");
  const date = str(fd, "date");
  const time = str(fd, "time") || "12:00";
  const media = parseMedia(str(fd, "media"), slug);
  const cover = parseMedia(str(fd, "cover"), slug)[0];
  const coverOffsetMs = Number(str(fd, "coverOffsetMs")) || undefined;
  const pillar = str(fd, "pillar") || undefined;
  const send = str(fd, "intent") === "enviar";

  if (!title) return { ok: false, message: "Dê um título interno ao post." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: "Escolha a data." };
  if (media.length === 0) return { ok: false, message: "Envie pelo menos uma mídia." };
  if (type === "imagem" && media.length > 1) return { ok: false, message: "Foto única aceita 1 imagem. Use Carrossel para mais." };
  if (type === "carrossel" && (media.length < 2 || media.length > 10)) return { ok: false, message: "Carrossel precisa de 2 a 10 mídias." };
  if (type === "reels" && (media.length !== 1 || media[0].kind !== "video")) return { ok: false, message: "Reels precisa de exatamente 1 vídeo." };
  if (caption.length > 2200) return { ok: false, message: `Legenda com ${caption.length} caracteres (máximo do Instagram: 2.200).` };

  const now = new Date().toISOString();
  const posts = await getPosts(slug);
  const status: PostStatus = send ? "aguardando" : "rascunho";
  if (id) {
    const i = posts.findIndex((p) => p.id === id);
    if (i < 0) return { ok: false, message: "Post não encontrado." };
    const old = posts[i];
    if (old.status === "publicado") return { ok: false, message: "Post já publicado não pode ser editado." };
    const sameContent = old.type === type && old.caption === caption && JSON.stringify(old.media) === JSON.stringify(media) && JSON.stringify(old.cover ?? null) === JSON.stringify(cover ?? null);
    // Conteúdo aprovado que mudou volta para aprovação: nada vai ao ar sem o cliente ver a versão final.
    const wasApproved = old.status === "aprovado" || old.status === "agendado";
    let keep: PostStatus = send ? "aguardando" : old.status === "rascunho" ? "rascunho" : old.status;
    let note: string | undefined;
    if (wasApproved && !sameContent) { keep = "aguardando"; note = "Conteúdo alterado depois da aprovação: volta para o cliente aprovar."; }
    posts[i] = { ...old, type, title, caption, date, time, media, cover, coverOffsetMs, pillar, status: keep, publish: undefined, updatedAt: now, history: [...old.history, entry(s, keep === "aguardando" && keep !== old.status ? "enviado" : "editado", note)] };
  } else {
    const post: Post = { id: crypto.randomUUID(), type, title, caption, date, time, media, cover, coverOffsetMs, pillar, status, createdAt: now, updatedAt: now, history: [entry(s, "criado"), ...(send ? [entry(s, "enviado")] : [])] };
    posts.push(post);
  }
  await savePosts(slug, posts);
  revalidatePath(path(slug));
  redirect(`${path(slug)}${id ? `?post=${id}` : ""}`);
}

export async function setStatusAction(slug: string, id: string, status: PostStatus, _prev: ActionResult | null): Promise<ActionResult> {
  const s = await requireAdmin();
  const act: HistoryEntry["action"] = status === "aguardando" ? "enviado" : status === "agendado" ? "agendado" : status === "publicado" ? "publicado" : "voltou";
  const p = await updatePost(slug, id, (p) => ({ ...p, status, history: [...p.history, entry(s, act)] }));
  if (!p) return { ok: false, message: "Post não encontrado." };
  revalidatePath(path(slug));
  return { ok: true, message: "Status atualizado." };
}

export async function deletePostAction(slug: string, id: string, _prev: ActionResult | null): Promise<ActionResult> {
  await requireAdmin();
  await updatePost(slug, id, () => null);
  revalidatePath(path(slug));
  redirect(path(slug));
}

// ─── Agendamento e publicação ──────────────────────────────────────────

/** Cliente ou equipe agenda um post aprovado para a data/hora escolhida. */
export async function scheduleAction(slug: string, id: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await requireAuth(slug);
  if (s.preview) return PREVIEW_BLOCK;
  const c = await getClient(slug);
  if (!c?.igUserId) return { ok: false, message: "A conta do Instagram ainda não está ligada. A equipe DoctorBrand precisa conectar antes de agendar." };
  const date = str(fd, "date"), time = str(fd, "time");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return { ok: false, message: "Escolha data e hora." };
  if (plannedAt({ date, time }).getTime() < Date.now() + 5 * 60_000) return { ok: false, message: "Escolha um horário pelo menos 5 minutos à frente." };
  let problem: string | null = null;
  let title = "";
  const p = await updatePost(slug, id, (p) => {
    if (p.status !== "aprovado" && p.status !== "agendado") { problem = "Só posts aprovados podem ser agendados."; return p; }
    problem = publishProblem(c, p);
    if (problem) return p;
    title = p.title;
    return { ...p, date, time, status: "agendado", publish: { attempts: 0 }, history: [...p.history, entry(s, "agendado", `${date.split("-").reverse().join("/")} às ${time}`)] };
  });
  if (!p) return { ok: false, message: "Post não encontrado." };
  if (problem) return { ok: false, message: problem };
  if (s.role === "cliente") await notifyTeam(slug, `${s.name} agendou *${title}* para ${date.split("-").reverse().join("/")} às ${time}.`);
  revalidatePath(path(slug));
  return { ok: true, message: "Agendado. Publica sozinho no horário." };
}

export async function unscheduleAction(slug: string, id: string, _prev: ActionResult | null): Promise<ActionResult> {
  const s = await requireAuth(slug);
  if (s.preview) return PREVIEW_BLOCK;
  const p = await updatePost(slug, id, (p) => (p.status === "agendado" && !p.publish?.igMediaId
    ? { ...p, status: "aprovado", publish: undefined, history: [...p.history, entry(s, "voltou", "Agendamento cancelado")] } : p));
  if (!p) return { ok: false, message: "Post não encontrado." };
  revalidatePath(path(slug));
  return { ok: true, message: "Agendamento cancelado." };
}

/** Equipe publica agora (post aprovado ou agendado). Vídeo pode precisar de mais uma rodada. */
export async function publishNowAction(slug: string, id: string, _prev: ActionResult | null): Promise<ActionResult> {
  const s = await requireAdmin();
  const c = await getClient(slug);
  if (!c) return { ok: false, message: "Cliente não encontrado." };
  const cur = (await getPosts(slug)).find((p) => p.id === id);
  if (!cur) return { ok: false, message: "Post não encontrado." };
  if (cur.status !== "aprovado" && cur.status !== "agendado") return { ok: false, message: "Só posts aprovados pelo cliente podem ser publicados." };
  const r = await stepPublish(c, { ...cur, publish: { attempts: 0, ...cur.publish } }, 45_000);
  await updatePost(slug, id, (p) => ({
    ...p,
    status: r.outcome === "published" ? "publicado" : r.outcome === "pending" ? "agendado" : p.status,
    publish: r.post.publish,
    media: r.post.media,
    cover: r.post.cover,
    history: [...p.history, ...(r.outcome === "published" ? [entry(s, "publicado", "Publicado pelo painel")] : [])],
  }));
  revalidatePath(path(slug));
  return { ok: r.outcome !== "error", message: r.outcome === "pending" ? "A Meta está processando. Fica agendado e publica na próxima rodada automática." : r.message };
}

export async function retryPublishAction(slug: string, id: string, _prev: ActionResult | null): Promise<ActionResult> {
  await requireAdmin();
  const p = await updatePost(slug, id, (p) => ({ ...p, publish: { attempts: 0 } }));
  if (!p) return { ok: false, message: "Post não encontrado." };
  revalidatePath(path(slug));
  return { ok: true, message: "Vai tentar de novo na próxima rodada." };
}

/** Liga a conta do Instagram ao cliente (escolhida entre as que o token de sistema enxerga). */
export async function connectInstagramAction(slug: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await requireAdmin();
  const ig = str(fd, "igUserId");
  const acc = (await igAccounts()).find((a) => a.igUserId === ig);
  if (!acc) return { ok: false, message: "Conta não encontrada entre as que o token da Meta acessa." };
  await updateClient(slug, { igUserId: acc.igUserId, pageId: acc.pageId }, s.name);
  revalidatePath(path(slug));
  return { ok: true, message: `Ligado a @${acc.username ?? acc.igUserId}.` };
}

/** Desliga a conta do Instagram (para corrigir uma ligação errada). */
export async function disconnectInstagramAction(slug: string, _prev: ActionResult | null): Promise<ActionResult> {
  const s = await requireAdmin();
  await updateClient(slug, { igUserId: undefined, pageId: undefined }, s.name);
  revalidatePath(path(slug));
  return { ok: true, message: "Instagram desligado." };
}

// ─── Drive, capa e metas ───────────────────────────────────────────────

export interface DriveImport { ok: boolean; message: string; media?: Media[]; cover?: Media; caption?: string }

/**
 * Lê links do Drive (arquivos ou pasta). Pasta: arquivos em ordem de nome (1, 2, 3…);
 * `legenda.txt` vira a legenda e uma imagem chamada `capa…` vira a capa do Reels.
 */
export async function importDriveAction(text: string): Promise<DriveImport> {
  await requireAdmin();
  const { files, folders } = parseDriveLinks(text);
  if (!files.length && !folders.length) return { ok: false, message: "Cole links do Google Drive (arquivos ou uma pasta)." };
  try {
    const media: Media[] = [];
    let caption: string | undefined;
    let cover: Media | undefined;
    for (const f of folders) {
      const list = await driveFolderFiles(f);
      const txt = list.find((x) => /legenda.*\.txt$|caption.*\.txt$/i.test(x.name) || x.mime === "text/plain");
      if (txt && caption === undefined) caption = await driveText(txt.id).catch(() => undefined);
      const capa = list.find((x) => /^capa\b/i.test(x.name) && x.mime.startsWith("image/"));
      if (capa && !cover) cover = toMedia(capa) ?? undefined;
      for (const x of list) { if (x === txt || x === capa) continue; const m = toMedia(x); if (m) media.push(m); }
    }
    for (const id of files) { const m = toMedia(await driveFileInfo(id)); if (m) media.push(m); }
    if (!media.length) return { ok: false, message: "Nenhuma imagem ou vídeo encontrado nesses links." };
    return { ok: true, message: `${media.length} arquivo${media.length > 1 ? "s" : ""} do Drive.`, media, cover, caption };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** Troca a capa do Reels (frame do vídeo ou imagem enviada). Cliente e equipe. */
export async function setCoverAction(slug: string, id: string, coverJson: string, offsetMs: number | null): Promise<ActionResult> {
  const s = await requireAuth(slug);
  if (s.preview) return PREVIEW_BLOCK;
  const cover = parseMedia(coverJson, slug)[0];
  if (!cover || cover.kind !== "image") return { ok: false, message: "Capa inválida." };
  let err: string | null = null;
  const p = await updatePost(slug, id, (p) => {
    if (p.type !== "reels") { err = "Só Reels tem capa escolhida."; return p; }
    if (p.status === "publicado") { err = "Post já publicado."; return p; }
    // Capa trocada pela equipe depois da aprovação volta para o cliente ver.
    const back = s.role === "admin" && (p.status === "aprovado" || p.status === "agendado");
    return {
      ...p, cover, coverOffsetMs: offsetMs ?? undefined,
      status: back ? "aguardando" : p.status,
      publish: p.status === "agendado" && !back ? { attempts: 0 } : back ? undefined : p.publish,
      history: [...p.history, entry(s, "capa", back ? "Capa trocada depois da aprovação: volta para o cliente aprovar." : offsetMs != null ? `Frame em ${(offsetMs / 1000).toFixed(1)}s` : "Imagem enviada")],
    };
  });
  if (!p) return { ok: false, message: "Post não encontrado." };
  if (err) return { ok: false, message: err };
  revalidatePath(path(slug));
  return { ok: true, message: "Capa atualizada." };
}

export async function savePlanAction(slug: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await requireAdmin();
  const n = (k: string) => Math.max(0, Math.round(Number(str(fd, k).replace(",", ".")) || 0));
  const mix = { reels: n("mix_reels"), carrossel: n("mix_carrossel"), imagem: n("mix_imagem") };
  const pillars = str(fd, "pillars").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.match(/^(.+?)[\s:–-]+(\d{1,3})\s*%?$/);
    return m ? { name: m[1].trim(), target: Number(m[2]) } : { name: l, target: 0 };
  });
  const sumMix = mix.reels + mix.carrossel + mix.imagem;
  const sumP = pillars.reduce((a, p) => a + p.target, 0);
  if (sumMix !== 100) return { ok: false, message: `O mix de formatos soma ${sumMix}%. Precisa somar 100%.` };
  if (pillars.length && sumP !== 100) return { ok: false, message: `Os pilares somam ${sumP}%. Precisam somar 100%.` };
  const plan: FeedPlan = { postsPerWeek: Math.min(21, n("postsPerWeek") || 3), mix, pillars, hashtagsMax: Math.min(30, n("hashtagsMax") || 5), updatedAt: new Date().toISOString(), updatedBy: s.name };
  await savePlan(slug, plan);
  revalidatePath(path(slug));
  return { ok: true, message: "Metas salvas." };
}

// ─── Importar pacote (.zip) ────────────────────────────────────────────

export interface ImportItem { title: string; caption: string; media: Media[]; cover?: Media; agenda?: string }

function addDaysISO(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Cria os posts de um pacote já enviado ao Blob, em ordem, com datas a cada N dias. */
export async function importPostsAction(slug: string, items: ImportItem[], opts: { start: string; everyDays: number; times: string[]; send: boolean }): Promise<ActionResult> {
  const s = await requireAdmin();
  if (!Array.isArray(items) || !items.length) return { ok: false, message: "Nada para importar." };
  if (items.length > 60) return { ok: false, message: "Importe no máximo 60 posts por vez." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.start)) return { ok: false, message: "Escolha a data do primeiro post." };
  const every = Math.min(14, Math.max(1, Math.round(opts.everyDays || 1)));
  const times = (opts.times ?? []).filter((t) => /^\d{2}:\d{2}$/.test(t));
  const now = new Date().toISOString();
  const created: Post[] = [];
  for (const [i, it] of items.entries()) {
    const media = parseMedia(JSON.stringify(it.media ?? []), slug);
    const cover = it.cover ? parseMedia(JSON.stringify([it.cover]), slug)[0] : undefined;
    if (!media.length) return { ok: false, message: `“${it.title}”: sem mídia.` };
    if (media.length > 10) return { ok: false, message: `“${it.title}”: carrossel com mais de 10 itens.` };
    const type: PostType = media.length > 1 ? "carrossel" : media[0].kind === "video" ? "reels" : "imagem";
    const caption = String(it.caption ?? "").replace(/\r\n?/g, "\n").slice(0, 2200);
    const status: PostStatus = opts.send ? "aguardando" : "rascunho";
    created.push({
      id: crypto.randomUUID(), type, title: String(it.title || `Post ${i + 1}`).slice(0, 120), caption, media,
      cover: type === "reels" ? cover : undefined,
      ...(() => {
        const auto = { date: addDaysISO(opts.start, i * every), time: times.length ? times[i % times.length] : "12:00" };
        const fixed = it.agenda ? parseAgenda(String(it.agenda), Number(opts.start.slice(0, 4))) : {};
        return { date: fixed.date ?? auto.date, time: fixed.time ?? auto.time };
      })(),
      status, createdAt: now, updatedAt: now,
      history: [entry(s, "criado", "Importado em lote"), ...(opts.send ? [entry(s, "enviado")] : [])],
    });
  }
  const posts = await getPosts(slug);
  await savePosts(slug, [...posts, ...created]);
  if (opts.send) await notifyTeam(slug, `${s.name} importou ${created.length} posts para aprovação.`);
  revalidatePath(path(slug));
  return { ok: true, message: `${created.length} posts importados${opts.send ? " e enviados para aprovação" : " como rascunho"}.` };
}

// ─── Importar uma pasta de planejamento do Drive (uma subpasta por post) ─────────────

/** "06/10/2026 12:00", "2026-10-06 18h30", "06/10 12:00" → data e hora. */
function parseAgenda(t: string, year: number): { date?: string; time?: string } {
  const iso = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  const br = t.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  const hm = t.match(/(\d{1,2})\s*[:h]\s*(\d{2})/);
  let date: string | undefined;
  if (iso) date = `${iso[1]}-${iso[2]}-${iso[3]}`;
  else if (br) { const y = br[3] ? (br[3].length === 2 ? 2000 + Number(br[3]) : Number(br[3])) : year; date = `${y}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`; }
  const time = hm ? `${hm[1].padStart(2, "0")}:${hm[2]}` : undefined;
  return { date, time };
}

const titleFromFolder = (name: string) => {
  const t = name.replace(/^post[-_ ]*/i, "").replace(/^\d+[-_ .]*/, "").replace(/[-_]+/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : name;
};

export async function importDriveBatchAction(slug: string, link: string, opts: { start: string; everyDays: number; times: string[]; send: boolean }): Promise<ActionResult> {
  await requireAdmin();
  const folder = parseDriveLinks(link).folders[0];
  if (!folder) return { ok: false, message: "Cole o link da pasta do mês (compartilhada como “qualquer pessoa com o link”)." };
  try {
    const top = await driveFolderFiles(folder);
    const subs = top.filter((f) => f.mime === FOLDER).sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
    if (!subs.length) return { ok: false, message: "A pasta não tem subpastas de posts (post-01-…, post-02-…)." };
    if (subs.length > 60) return { ok: false, message: "Importe no máximo 60 posts por vez." };
    const read = await Promise.all(subs.map(async (sub) => {
      const list: DriveFile[] = await driveFolderFiles(sub.id);
      const txt = list.find((x) => /^legenda.*\.txt$|^caption.*\.txt$/i.test(x.name));
      const ag = list.find((x) => /^agenda.*\.txt$/i.test(x.name));
      const capa = list.find((x) => /^capa\b/i.test(x.name) && x.mime.startsWith("image/"));
      const media = list.filter((x) => x !== txt && x !== ag && x !== capa).map(toMedia).filter((m): m is Media => !!m);
      const [caption, agenda] = await Promise.all([txt ? driveText(txt.id).catch(() => "") : "", ag ? driveText(ag.id).catch(() => "") : ""]);
      return { title: titleFromFolder(sub.name), caption, media, cover: capa ? toMedia(capa) ?? undefined : undefined, agenda: agenda || undefined };
    }));
    const empty = read.find((r) => !r.media.length);
    if (empty) return { ok: false, message: `“${empty.title}”: sem imagem ou vídeo (ou os arquivos não estão compartilhados).` };
    const r = await importPostsAction(slug, read, opts);
    if (!r.ok) return r;
    const fixed = read.filter((x) => x.agenda).length;
    return { ok: true, message: `${r.message.replace("importados", "importados do Drive")}${fixed ? ` ${fixed} com data do agenda.txt.` : ""}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}


// ─── Importar uma lista colada (planejamento do Notion, por exemplo) ─────────────

/**
 * Cada post começa com uma linha "## Título | 06/10 12:00" (data e hora opcionais).
 * Nas linhas seguintes: links do Drive (arquivo ou pasta do carrossel) e a legenda.
 */
function parsePostList(text: string): { title: string; agenda?: string; links: string; caption: string }[] {
  const blocks = text.replace(/\r\n?/g, "\n").split(/^##\s+/m).map((b) => b.trim()).filter(Boolean);
  return blocks.map((b) => {
    const [head, ...rest] = b.split("\n");
    const [title, agenda] = head.split("|").map((x) => x.trim());
    const links: string[] = [], caption: string[] = [];
    for (const line of rest) (/^\s*https?:\/\/(drive|docs)\.google\.com\/\S+\s*$/i.test(line) ? links : caption).push(line.trim());
    return { title: title || "Post", agenda: agenda || undefined, links: links.join("\n"), caption: caption.join("\n").replace(/\n{3,}/g, "\n\n").trim() };
  });
}

export async function importListAction(slug: string, text: string, opts: { start: string; everyDays: number; times: string[]; send: boolean }): Promise<ActionResult> {
  await requireAdmin();
  const list = parsePostList(text);
  if (!list.length) return { ok: false, message: "Cole os posts, cada um começando com uma linha “## Título | data”." };
  if (list.length > 60) return { ok: false, message: "Importe no máximo 60 posts por vez." };
  try {
    const avisos: string[] = [];
    const read = await Promise.all(list.map(async (p) => {
      const { files, folders } = parseDriveLinks(p.links);
      let media: Media[] = [];
      for (const f of folders) media.push(...(await driveFolderFiles(f)).map(toMedia).filter((m): m is Media => !!m));
      for (const id of files) { const m = toMedia(await driveFileInfo(id)); if (m) media.push(m); }
      if (media.length > 10) { avisos.push(`“${p.title}” tinha ${media.length} arquivos; entraram os 10 primeiros.`); media = media.slice(0, 10); }
      return { title: p.title, caption: p.caption, media, agenda: p.agenda };
    }));
    const empty = read.find((r) => !r.media.length);
    if (empty) return { ok: false, message: `“${empty.title}”: sem imagem ou vídeo (ou os arquivos não estão compartilhados como “qualquer pessoa com o link”).` };
    const r = await importPostsAction(slug, read, opts);
    return r.ok && avisos.length ? { ...r, message: `${r.message} ${avisos.join(" ")}` } : r;
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Data e hora, e reorganizar o grid ─────────────

const dm = (date: string, time: string) => `${date.split("-").reverse().slice(0, 2).join("/")} às ${time}`;

/** Equipe muda data e hora de um post que ainda não foi publicado. Agendado continua agendado (no novo horário). */
export async function setDateAction(slug: string, id: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await requireAdmin();
  const date = str(fd, "date"), time = str(fd, "time");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return { ok: false, message: "Escolha data e hora." };
  let problem: string | null = null;
  const p = await updatePost(slug, id, (p) => {
    if (p.status === "publicado" || p.publish?.igMediaId) { problem = "Post já publicado."; return p; }
    if (p.date === date && p.time === time) return p;
    if (p.status === "agendado" && plannedAt({ date, time }).getTime() < Date.now() + 5 * 60_000) { problem = "Post agendado: escolha um horário pelo menos 5 minutos à frente."; return p; }
    return { ...p, date, time, updatedAt: new Date().toISOString(), ...(p.status === "agendado" ? { publish: { attempts: 0 } } : {}), history: [...p.history, entry(s, "editado", `Nova data: ${dm(date, time)}`)] };
  });
  if (!p) return { ok: false, message: "Post não encontrado." };
  if (problem) return { ok: false, message: problem };
  revalidatePath(path(slug));
  return { ok: true, message: `Data salva: ${dm(date, time)}.` };
}

/**
 * Arrastar e soltar no grid: a ordem nova (do topo para baixo, como no Instagram) recebe os mesmos horários
 * do planejamento, redistribuídos. Agendado que cair num horário que já passou volta para aprovado.
 */
export async function reorderFeedAction(slug: string, ids: string[]): Promise<ActionResult> {
  const s = await requireAdmin();
  const posts = await getPosts(slug);
  const planned = posts.filter((p) => p.status !== "publicado" && !p.publish?.igMediaId);
  const byId = new Map(planned.map((p) => [p.id, p]));
  if (!Array.isArray(ids) || ids.length !== planned.length || new Set(ids).size !== ids.length || ids.some((id) => !byId.has(id))) {
    return { ok: false, message: "O planejamento mudou enquanto você arrastava. Recarregue a página e tente de novo." };
  }
  // Horários disponíveis, do mais recente (topo do grid) para o mais antigo.
  const slots = planned.map((p) => ({ date: p.date, time: p.time })).sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
  const now = new Date().toISOString();
  let moved = 0, unscheduled = 0;
  const next = posts.map((p) => {
    const i = ids.indexOf(p.id);
    if (i < 0) return p;
    const slot = slots[i];
    if (p.date === slot.date && p.time === slot.time) return p;
    moved++;
    const back = p.status === "agendado" && plannedAt(slot).getTime() < Date.now() + 5 * 60_000;
    if (back) unscheduled++;
    return {
      ...p, date: slot.date, time: slot.time, updatedAt: now,
      ...(p.status === "agendado" ? (back ? { status: "aprovado" as PostStatus, publish: undefined } : { publish: { attempts: 0 } }) : {}),
      history: [...p.history, entry(s, "editado", `Grid reorganizado: ${dm(slot.date, slot.time)}${back ? " (saiu do agendamento: horário já passou)" : ""}`)],
    };
  });
  if (!moved) return { ok: true, message: "Nada mudou." };
  await savePosts(slug, next);
  revalidatePath(path(slug));
  return { ok: true, message: `${moved} ${moved === 1 ? "post mudou" : "posts mudaram"} de data.${unscheduled ? ` ${unscheduled} saiu do agendamento porque o novo horário já passou.` : ""}` };
}
