import { readDoc, writeDoc } from "./store";

/**
 * Planejamento de conteúdo por cliente (aprovação do feed).
 * Documento `content/<slug>` no Blob privado: posts + metas do feed.
 * Mídias: enviadas ao Blob (`content-media/<slug>/...`, servidas por `/api/media`) ou apontando para o
 * arquivo final no Google Drive (`driveId`). As do Drive são copiadas em qualidade original para o Blob
 * só na hora de publicar.
 */

export type PostType = "imagem" | "carrossel" | "reels";
export type PostStatus = "rascunho" | "aguardando" | "alteracao" | "aprovado" | "agendado" | "publicado";

export interface Media {
  /** Caminho no Blob (content-media/<slug>/...). Nas mídias do Drive, preenchido quando é copiada para publicar. */
  path?: string;
  /** Arquivo no Google Drive (compartilhado "qualquer pessoa com o link"). */
  driveId?: string;
  kind: "image" | "video";
  name?: string;
  mime?: string;
  /** Versão da mídia: muda quando a equipe atualiza do Drive, para a miniatura não ficar presa no cache. */
  rev?: number;
}

export interface HistoryEntry {
  at: string;           // ISO
  by: string;           // nome de quem agiu
  role: "admin" | "cliente";
  action: "criado" | "editado" | "enviado" | "aprovado" | "alteracao" | "agendado" | "publicado" | "voltou" | "capa";
  note?: string;
  /** Slide/mídia específica (1-based) a que o comentário se refere. */
  slide?: number;
  /** Parte do post do pedido de alteração, quando não é uma imagem específica. */
  alvo?: "capa" | "legenda" | "video";
}

/** "na capa", "na imagem 3", "no vídeo"… para o texto do pedido de alteração. */
export function ondeLabel(h: Pick<HistoryEntry, "slide" | "alvo">): string {
  if (h.slide) return `na imagem ${h.slide}`;
  if (h.alvo === "capa") return "na capa";
  if (h.alvo === "legenda") return "na legenda";
  if (h.alvo === "video") return "no vídeo";
  return "";
}

/** Estado da publicação automática no Instagram. */
export interface PublishState {
  /** Contêiner final (foto, Reels ou carrossel) pronto para media_publish. */
  containerId?: string;
  /** Itens do carrossel já criados, na ordem. */
  childIds?: string[];
  attempts: number;
  startedAt?: string;
  lastError?: string;
  lastTriedAt?: string;
  igMediaId?: string;
  permalink?: string;
  publishedAt?: string;
}

export interface Post {
  id: string;
  type: PostType;
  title: string;
  caption: string;
  media: Media[];
  /** Capa do Reels (imagem enviada ou frame escolhido do vídeo). */
  cover?: Media;
  /** Momento do vídeo usado como capa (ms), quando a capa veio de um frame. */
  coverOffsetMs?: number;
  /** Pilar editorial (das metas do cliente). */
  pillar?: string;
  /** Link do Drive de onde vieram as mídias (pasta ou arquivo). "Atualizar do Drive" relê daqui. */
  source?: string;
  /** Data e hora planejadas (America/Sao_Paulo). */
  date: string;         // YYYY-MM-DD
  time: string;         // HH:MM
  status: PostStatus;
  publish?: PublishState;
  history: HistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

/** Metas do feed do cliente (usadas na pontuação do planejamento). */
export interface FeedPlan {
  postsPerWeek: number;
  /** % desejado de cada formato (soma 100). */
  mix: Record<PostType, number>;
  /** Pilares editoriais com % desejado (soma 100). */
  pillars: { name: string; target: number }[];
  hashtagsMax: number;
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_PLAN: FeedPlan = {
  postsPerWeek: 3,
  mix: { reels: 40, carrossel: 40, imagem: 20 },
  pillars: [
    { name: "Autoridade", target: 30 },
    { name: "Educação", target: 30 },
    { name: "Prova e resultado", target: 15 },
    { name: "Bastidores e humanização", target: 15 },
    { name: "Conversão", target: 10 },
  ],
  hashtagsMax: 5,
};

export const STATUS_LABEL: Record<PostStatus, string> = {
  rascunho: "Rascunho",
  aguardando: "Aguardando aprovação",
  alteracao: "Alteração pedida",
  aprovado: "Aprovado",
  agendado: "Agendado",
  publicado: "Publicado",
};

export const STATUS_PILL: Record<PostStatus, string> = {
  rascunho: "pill",
  aguardando: "pill-yellow",
  alteracao: "pill-red",
  aprovado: "pill-green",
  agendado: "pill-info",
  publicado: "pill-ok",
};

export const TYPE_LABEL: Record<PostType, string> = { imagem: "Foto única", carrossel: "Carrossel", reels: "Reels" };

/** O cliente não enxerga rascunhos da equipe. */
export function visibleTo(post: Post, role: "admin" | "cliente"): boolean {
  return role === "admin" || post.status !== "rascunho";
}

interface ContentDoc { posts: Post[]; plan?: FeedPlan }
const docPath = (slug: string) => `content/${slug}`;
const readContent = (slug: string) => readDoc<ContentDoc>(docPath(slug), { posts: [] });

export async function getPosts(slug: string): Promise<Post[]> {
  return (await readContent(slug)).posts ?? [];
}

export async function savePosts(slug: string, posts: Post[]): Promise<void> {
  const d = await readContent(slug);
  await writeDoc(docPath(slug), { ...d, posts });
}

export async function getPlan(slug: string): Promise<FeedPlan> {
  const p = (await readContent(slug)).plan;
  return p ? { ...DEFAULT_PLAN, ...p, mix: { ...DEFAULT_PLAN.mix, ...p.mix } } : DEFAULT_PLAN;
}

export async function savePlan(slug: string, plan: FeedPlan): Promise<void> {
  const d = await readContent(slug);
  await writeDoc(docPath(slug), { ...d, plan });
}

/** Ordem do feed: mais recente primeiro (como no Instagram). */
export function feedOrder(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
}

/** Ordem de publicação: mais antigo primeiro. */
export function scheduleOrder(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
}

export { mediaKey, mediaUrl, sameOriginVideo, videoSource } from "./content-media";

/** Imagem que representa o post no grid (capa do Reels, 1º slide, ou a foto). Nunca carrega vídeo. */
export function thumbOf(p: Post): Media | undefined {
  if (p.type === "reels") return p.cover ?? (p.media[0]?.driveId ? p.media[0] : undefined);
  const first = p.media[0];
  if (first?.kind === "video" && !first.driveId) return p.media.find((m) => m.kind === "image");
  return first;
}

/** Checa se um caminho de mídia pertence ao cliente. */
export function mediaBelongsTo(path: string, slug: string): boolean {
  return path.startsWith(`content-media/${slug}/`) && !path.includes("..");
}

export async function updatePost(slug: string, id: string, fn: (p: Post) => Post | null): Promise<Post | null> {
  const posts = await getPosts(slug);
  const i = posts.findIndex((p) => p.id === id);
  if (i < 0) return null;
  const next = fn(posts[i]);
  if (next === null) posts.splice(i, 1);
  else posts[i] = { ...next, updatedAt: new Date().toISOString() };
  await savePosts(slug, posts);
  return next;
}

/** Instante planejado (Brasil sem horário de verão desde 2019: UTC-3 fixo). */
export function plannedAt(p: Pick<Post, "date" | "time">): Date {
  return new Date(`${p.date}T${p.time || "12:00"}:00-03:00`);
}

export const MAX_ATTEMPTS = 3;

export function dayLabel(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return "Data a definir";
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const wd = dt.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "");
  return `${wd} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}${time ? ` · ${time}` : ""}`;
}

/** Horário planejado ainda dá para agendar (pelo menos 5 min à frente). */
export function canScheduleAt(p: Pick<Post, "date" | "time">, marginMin = 5): boolean {
  return plannedAt(p).getTime() > Date.now() + marginMin * 60_000;
}
