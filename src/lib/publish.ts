import type { Client } from "./clients";
import { MAX_ATTEMPTS, plannedAt, type Media, type Post, type PublishState } from "./content";
import { copyDriveToBlob } from "./drive";
import { signedMediaUrl } from "./signed";

/**
 * Publicação no Instagram pela Content Publishing API (gratuita).
 * Fluxo: cria contêiner(es) com a URL assinada da mídia → espera a Meta processar (vídeo leva minutos)
 * → media_publish. É retomável: o estado fica em `post.publish`, e cada chamada avança o que der.
 * Token: META_ACCESS_TOKEN (System User) com instagram_content_publish e acesso à conta.
 */

const API = process.env.META_GRAPH_URL ?? "https://graph.facebook.com/v21.0";

type Json = Record<string, unknown> & { id?: string; error?: { message?: string; error_user_msg?: string; code?: number } };

function token(): string {
  const t = process.env.META_ACCESS_TOKEN;
  if (!t) throw new Error("META_ACCESS_TOKEN não configurado.");
  return t;
}

async function post(path: string, params: Record<string, string>): Promise<Json> {
  const body = new URLSearchParams({ ...params, access_token: token() });
  const res = await fetch(`${API}/${path}`, { method: "POST", body, cache: "no-store" });
  const j = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok || j.error) throw new Error(metaError(j));
  return j;
}

async function read(path: string, fields: string): Promise<Json> {
  const res = await fetch(`${API}/${path}?fields=${fields}&access_token=${token()}`, { cache: "no-store" });
  const j = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok || j.error) throw new Error(metaError(j));
  return j;
}

function metaError(j: Json): string {
  const m = j.error?.error_user_msg || j.error?.message || "erro desconhecido";
  if (/permission|OAuth|instagram_content_publish/i.test(m)) return `Meta sem permissão de publicar nesta conta (${m}). Confira instagram_content_publish e o acesso do System User.`;
  return `Meta: ${m}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** FINISHED | IN_PROGRESS | ERROR | EXPIRED | PUBLISHED */
async function containerStatus(id: string): Promise<{ code: string; detail?: string }> {
  const j = await read(id, "status_code,status");
  return { code: String(j.status_code ?? "IN_PROGRESS"), detail: j.status ? String(j.status) : undefined };
}

async function waitFinished(ids: string[], deadline: number): Promise<"ok" | "pending"> {
  for (;;) {
    let pending = false;
    for (const id of ids) {
      const s = await containerStatus(id);
      if (s.code === "ERROR" || s.code === "EXPIRED") throw new Error(`A Meta não conseguiu processar a mídia${s.detail ? `: ${s.detail}` : ""}. Confira formato e proporção.`);
      if (s.code !== "FINISHED" && s.code !== "PUBLISHED") pending = true;
    }
    if (!pending) return "ok";
    if (Date.now() + 5000 > deadline) return "pending";
    await sleep(4000);
  }
}

export type StepOutcome = "published" | "pending" | "error";

/** Checa se o post pode ser publicado nesta conta. Devolve a mensagem de problema, ou null. */
export function publishProblem(c: Client, p: Post): string | null {
  if (!c.igUserId) return "Este cliente ainda não tem a conta do Instagram ligada.";
  if (p.media.length === 0) return "Post sem mídia.";
  if (p.type === "reels" && p.media[0]?.kind !== "video") return "Reels precisa de um vídeo.";
  if (p.type === "carrossel" && (p.media.length < 2 || p.media.length > 10)) return "Carrossel precisa de 2 a 10 mídias.";
  const isJpeg = (m: Media) => (m.mime ? /jpe?g/i.test(m.mime) : /\.jpe?g$/i.test(m.path ?? m.name ?? ""));
  const badImage = [...p.media, ...(p.cover ? [p.cover] : [])].find((m) => m.kind === "image" && !isJpeg(m));
  if (badImage) return "O Instagram só aceita imagens em JPG. Reenvie as imagens em JPG.";
  return null;
}

/**
 * Avança a publicação de um post. `budgetMs` limita quanto tempo esta chamada espera a Meta processar.
 * Sempre devolve o post atualizado (com `publish` preenchido) para ser salvo.
 */
export async function stepPublish(c: Client, p: Post, budgetMs = 45_000): Promise<{ post: Post; outcome: StepOutcome; message: string }> {
  const deadline = Date.now() + budgetMs;
  const st: PublishState = { attempts: 0, ...(p.publish ?? {}) };
  if (st.igMediaId) return { post: p, outcome: "published", message: "Já publicado." };
  const problem = publishProblem(c, p);
  if (problem) return { post: { ...p, publish: { ...st, lastError: problem, lastTriedAt: new Date().toISOString() } }, outcome: "error", message: problem };

  const ig = c.igUserId!;
  const url = (m: Media | undefined) => signedMediaUrl(m?.path ?? "");
  st.startedAt ??= new Date().toISOString();
  st.lastTriedAt = new Date().toISOString();

  try {
    // Mídias do Drive: copia o original para o Blob antes (a Meta baixa do nosso link assinado).
    if (!st.containerId && [...p.media, p.cover].some((m) => m?.driveId && !m.path)) {
      p = { ...p, media: await Promise.all(p.media.map((m) => copyDriveToBlob(c.slug, m))), cover: p.cover ? await copyDriveToBlob(c.slug, p.cover) : undefined };
      if (Date.now() + 15_000 > deadline) return { post: { ...p, publish: st }, outcome: "pending", message: "Mídias copiadas do Drive. Publica na próxima rodada." };
    }
    if (!st.containerId) {
      if (p.type === "imagem") {
        st.containerId = (await post(`${ig}/media`, { image_url: url(p.media[0]), caption: p.caption })).id;
      } else if (p.type === "reels") {
        const params: Record<string, string> = { media_type: "REELS", video_url: url(p.media[0]), caption: p.caption, share_to_feed: "true" };
        if (p.cover) params.cover_url = url(p.cover);
        else if (p.coverOffsetMs) params.thumb_offset = String(Math.round(p.coverOffsetMs));
        st.containerId = (await post(`${ig}/media`, params)).id;
      } else {
        const children = st.childIds ?? [];
        for (let i = children.length; i < p.media.length; i++) {
          const m = p.media[i];
          const params: Record<string, string> = m.kind === "video"
            ? { media_type: "VIDEO", video_url: url(m), is_carousel_item: "true" }
            : { image_url: url(m), is_carousel_item: "true" };
          const id = (await post(`${ig}/media`, params)).id;
          if (id) children.push(id);
          st.childIds = children;
        }
        if ((await waitFinished(children, deadline)) === "pending") {
          return { post: { ...p, publish: st }, outcome: "pending", message: "A Meta ainda está processando os itens do carrossel." };
        }
        st.containerId = (await post(`${ig}/media`, { media_type: "CAROUSEL", children: children.join(","), caption: p.caption })).id;
      }
      if (!st.containerId) throw new Error("A Meta não devolveu o contêiner da mídia.");
    }

    if ((await waitFinished([st.containerId], deadline)) === "pending") {
      return { post: { ...p, publish: st }, outcome: "pending", message: "A Meta ainda está processando o vídeo. Publica na próxima rodada." };
    }

    const pub = await post(`${ig}/media_publish`, { creation_id: st.containerId });
    st.igMediaId = pub.id;
    st.publishedAt = new Date().toISOString();
    st.lastError = undefined;
    if (pub.id) st.permalink = String((await read(pub.id, "permalink").catch(() => ({} as Json))).permalink ?? "") || undefined;
    return { post: { ...p, status: "publicado", publish: st }, outcome: "published", message: "Publicado no Instagram." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    st.attempts += 1;
    st.lastError = msg;
    // Contêiner com erro não se recupera: começa do zero na próxima tentativa.
    if (/processar a mídia/.test(msg)) { st.containerId = undefined; st.childIds = undefined; }
    return { post: { ...p, publish: st }, outcome: "error", message: msg };
  }
}

/** Post agendado cuja hora chegou e que ainda tem tentativas. */
export function isDue(p: Post, now = new Date()): boolean {
  return p.status === "agendado" && !p.publish?.igMediaId && (p.publish?.attempts ?? 0) < MAX_ATTEMPTS && plannedAt(p) <= now;
}
