import { scanCfmText } from "./cfm";
import type { FeedPlan, PostType } from "./content";
import type { ClientProfile } from "./profile";
import { readDoc, writeDoc } from "./store";

/**
 * Diagnóstico do feed publicado hoje. Sem custo:
 * 1. Conta ligada pela Meta: Graph API (grátis, mesmo token da publicação).
 * 2. Sem conta ligada: Apify Instagram Scraper com APIFY_TOKEN (crédito grátis mensal).
 * A nota é por regras, sem IA. O visual entra pela nota dada pela equipe.
 */

const GRAPH = process.env.META_GRAPH_URL ?? "https://graph.facebook.com/v21.0";
const APIFY = process.env.APIFY_API_URL ?? "https://api.apify.com/v2";

export interface FeedPost { type: PostType; at: string; likes: number; comments: number; caption: string; hashtags: number; permalink?: string }
export interface FeedSnapshot { source: "meta" | "apify"; handle?: string; followers?: number; bio?: string; link?: string; posts: FeedPost[] }
export interface AuditItem { key: string; label: string; score: number | null; detail: string; tip?: string }
export interface FeedAudit { at: string; by: string; source: FeedSnapshot["source"]; handle?: string; followers?: number; postsRead: number; total: number; items: AuditItem[] }

const tags = (s: string) => (s.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;

async function fromMeta(igUserId: string): Promise<FeedSnapshot> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN não configurado.");
  const get = async (path: string) => {
    const r = await fetch(`${GRAPH}/${path}${path.includes("?") ? "&" : "?"}access_token=${token}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(`Meta: ${j.error?.message ?? r.status}`);
    return j;
  };
  const [p, m] = await Promise.all([
    get(`${igUserId}?fields=username,biography,website,followers_count`),
    get(`${igUserId}/media?fields=media_type,media_product_type,timestamp,caption,like_count,comments_count,permalink&limit=30`),
  ]);
  const posts: FeedPost[] = (m.data ?? []).map((x: { media_type: string; media_product_type?: string; timestamp: string; caption?: string; like_count?: number; comments_count?: number; permalink?: string }) => ({
    type: x.media_type === "CAROUSEL_ALBUM" ? "carrossel" : x.media_type === "VIDEO" ? "reels" : "imagem",
    at: x.timestamp, likes: Math.max(0, x.like_count ?? 0), comments: x.comments_count ?? 0, caption: x.caption ?? "", hashtags: tags(x.caption ?? ""), permalink: x.permalink,
  }));
  return { source: "meta", handle: p.username, followers: p.followers_count, bio: p.biography, link: p.website, posts };
}

async function fromApify(handle: string): Promise<FeedSnapshot> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("Sem conta ligada e sem APIFY_TOKEN. Ligue o Instagram pela Meta ou cadastre o token grátis do Apify na Vercel.");
  const url = `https://www.instagram.com/${handle}/`;
  const run = async (input: object, fields: string) => {
    const r = await fetch(`${APIFY}/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}&timeout=50&fields=${fields}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input), cache: "no-store",
    });
    if (!r.ok) throw new Error(`Apify respondeu ${r.status}.`);
    return (await r.json()) as Record<string, unknown>[];
  };
  const [details, items] = await Promise.all([
    run({ directUrls: [url], resultsType: "details", resultsLimit: 1, addParentData: false }, "username,followersCount,biography,externalUrl,error"),
    run({ directUrls: [url], resultsType: "posts", resultsLimit: 24, addParentData: false }, "type,productType,timestamp,caption,likesCount,commentsCount,hashtags,url,error"),
  ]);
  const d = details[0] ?? {};
  if (d.error) throw new Error("Perfil privado, restrito ou inexistente para leitura pública.");
  const posts: FeedPost[] = items.filter((x) => !x.error && x.timestamp).map((x) => ({
    type: x.type === "Sidecar" ? "carrossel" : x.type === "Video" ? "reels" : "imagem",
    at: String(x.timestamp), likes: Math.max(0, Number(x.likesCount ?? 0)), comments: Number(x.commentsCount ?? 0),
    caption: String(x.caption ?? ""), hashtags: Array.isArray(x.hashtags) ? x.hashtags.length : tags(String(x.caption ?? "")), permalink: x.url ? String(x.url) : undefined,
  }));
  return { source: "apify", handle: String(d.username ?? handle), followers: d.followersCount ? Number(d.followersCount) : undefined, bio: d.biography ? String(d.biography) : undefined, link: d.externalUrl ? String(d.externalUrl) : undefined, posts };
}

export async function readFeed(igUserId: string | undefined, handle: string | undefined): Promise<FeedSnapshot> {
  if (igUserId) return fromMeta(igUserId);
  const h = handle?.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*$/, "").trim();
  if (!h) throw new Error("Informe o @ do Instagram no perfil do cliente ou ligue a conta pela Meta.");
  return fromApify(h);
}

const clamp = (n: number) => Math.max(0, Math.min(10, Math.round(n * 10) / 10));
const DAY = 86_400_000;

export function scoreFeedNow(s: FeedSnapshot, plan: FeedPlan, profile: ClientProfile, now = Date.now()): Omit<FeedAudit, "at" | "by"> {
  const posts = [...s.posts].sort((a, b) => b.at.localeCompare(a.at));
  const items: AuditItem[] = [];
  const last30 = posts.filter((p) => now - Date.parse(p.at) <= 30 * DAY);

  // 1. Frequência (últimos 30 dias contra a meta do plano)
  const perWeek = last30.length / (30 / 7);
  items.push({ key: "freq", label: "Frequência", score: clamp((perWeek / plan.postsPerWeek) * 10),
    detail: `${perWeek.toFixed(1).replace(".", ",")} posts por semana nos últimos 30 dias (meta: ${plan.postsPerWeek}).`,
    tip: perWeek < plan.postsPerWeek ? "Programar os posts aprovados com antecedência para manter a cadência." : undefined });

  // 2. Constância (maior intervalo sem postar nos últimos 60 dias)
  const recent = posts.filter((p) => now - Date.parse(p.at) <= 60 * DAY).map((p) => Date.parse(p.at));
  let gap = recent.length ? (now - recent[0]) / DAY : 60;
  for (let i = 1; i < recent.length; i++) gap = Math.max(gap, (recent[i - 1] - recent[i]) / DAY);
  items.push({ key: "const", label: "Constância", score: gap <= 7 ? 10 : gap <= 10 ? 8 : gap <= 14 ? 6 : gap <= 21 ? 3 : 1,
    detail: `Maior intervalo sem publicar: ${Math.round(gap)} dias.`, tip: gap > 10 ? "Evitar buracos longos: o alcance cai quando o perfil some." : undefined });

  // 3. Mix de formatos (últimos 12 posts contra o plano)
  const base = posts.slice(0, 12);
  const share = (t: PostType) => (base.length ? (base.filter((p) => p.type === t).length / base.length) * 100 : 0);
  const diff = (["reels", "carrossel", "imagem"] as PostType[]).reduce((a, t) => a + Math.abs(share(t) - plan.mix[t]), 0);
  items.push({ key: "mix", label: "Mix de formatos", score: base.length ? clamp(10 - diff / 12) : null,
    detail: `Reels ${Math.round(share("reels"))}% · Carrossel ${Math.round(share("carrossel"))}% · Foto ${Math.round(share("imagem"))}% (plano: ${plan.mix.reels}/${plan.mix.carrossel}/${plan.mix.imagem}).`,
    tip: share("reels") < plan.mix.reels - 15 ? "Faltam Reels: é o formato que leva o perfil para quem ainda não segue." : share("carrossel") < plan.mix.carrossel - 15 ? "Faltam carrosséis: são os que mais geram salvamento e autoridade." : undefined });

  // 4. Engajamento médio por post (curtidas + comentários / seguidores)
  const eng = s.followers && base.length ? (base.reduce((a, p) => a + p.likes + p.comments, 0) / base.length / s.followers) * 100 : null;
  items.push({ key: "eng", label: "Engajamento", score: eng === null ? null : eng >= 3 ? 10 : eng >= 2 ? 8 : eng >= 1 ? 6 : eng >= 0.5 ? 4 : 2,
    detail: eng === null ? "Sem número de seguidores para calcular." : `${eng.toFixed(2).replace(".", ",")}% por post (média dos últimos ${base.length}).`,
    tip: eng !== null && eng < 1 ? "Ganchos mais fortes nos 3 primeiros segundos e CTA de comentário ou salvamento." : undefined });

  // 5. Legendas (tamanho útil)
  const good = base.filter((p) => p.caption.trim().length >= 120 && p.caption.length <= 2200).length;
  items.push({ key: "leg", label: "Legendas", score: base.length ? clamp((good / base.length) * 10) : null,
    detail: `${good} de ${base.length} com legenda desenvolvida (120+ caracteres).`, tip: good < base.length * 0.7 ? "Legenda curta demais desperdiça o post: contexto, prova e um próximo passo." : undefined });

  // 6. Hashtags
  const avgTags = base.length ? base.reduce((a, p) => a + p.hashtags, 0) / base.length : 0;
  items.push({ key: "tags", label: "Hashtags", score: base.length ? (avgTags === 0 ? 6 : avgTags <= plan.hashtagsMax ? 10 : clamp(10 - (avgTags - plan.hashtagsMax))) : null,
    detail: `${avgTags.toFixed(1).replace(".", ",")} por post (limite do plano: ${plan.hashtagsMax}).`, tip: avgTags > plan.hashtagsMax ? `Reduzir para até ${plan.hashtagsMax} hashtags específicas da especialidade e da região.` : undefined });

  // 7. Conformidade CFM nas legendas
  const hits = base.flatMap((p) => scanCfmText(p.caption));
  const alta = hits.filter((h) => h.severity === "alta").length, cinza = hits.length - alta;
  items.push({ key: "cfm", label: "Conformidade CFM", score: base.length ? clamp(10 - alta * 3 - cinza) : null,
    detail: hits.length ? `${alta} ponto(s) de risco e ${cinza} de atenção: ${[...new Set(hits.map((h) => `"${h.match}"`))].slice(0, 4).join(", ")}.` : "Nenhum termo de risco encontrado nas legendas.",
    tip: alta ? "Revisar promessas de resultado, superlativos e antes/depois (Resolução CFM 2.336/2023)." : undefined });

  // 8. Bio e perfil
  const bio = s.bio ?? "";
  const bioScore = (bio.length >= 60 ? 4 : bio.length >= 20 ? 2 : 0) + (s.link ? 3 : 0) + (/\b(crm|rqe)\b/i.test(bio) ? 3 : 0);
  items.push({ key: "bio", label: "Bio e perfil", score: s.bio === undefined ? null : clamp(bioScore),
    detail: `${bio.length} caracteres${s.link ? ", com link" : ", sem link"}${/\b(crm|rqe)\b/i.test(bio) ? ", com CRM/RQE" : ", sem CRM/RQE"}.`,
    tip: !/\b(crm|rqe)\b/i.test(bio) ? "Incluir CRM e RQE na bio (obrigatório para médicos)." : !s.link ? "Colocar o link de agendamento na bio." : undefined });

  // 9. Visual (nota da equipe)
  items.push({ key: "visual", label: "Visual", score: typeof profile.visualScore === "number" ? clamp(profile.visualScore) : null,
    detail: typeof profile.visualScore === "number" ? `Nota da equipe${profile.visualNota ? `: ${profile.visualNota}` : "."}` : "Ainda sem nota da equipe.", tip: undefined });

  const valid = items.filter((i) => i.score !== null) as (AuditItem & { score: number })[];
  const total = valid.length ? Math.round((valid.reduce((a, i) => a + i.score, 0) / valid.length) * 10) : 0;
  return { source: s.source, handle: s.handle, followers: s.followers, postsRead: posts.length, total, items };
}

export const getAudits = (slug: string) => readDoc<FeedAudit[]>(`diagnostico/${slug}`, []);

export async function saveAudit(slug: string, a: FeedAudit): Promise<void> {
  const cur = await getAudits(slug);
  await writeDoc(`diagnostico/${slug}`, [a, ...cur].slice(0, 24));
}
