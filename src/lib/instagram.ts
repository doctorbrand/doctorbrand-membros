/**
 * Perfil e posts já publicados no Instagram do cliente, para a prévia do feed.
 * Usa o token de sistema da Meta (mesmo das campanhas). Se falhar, a prévia mostra só o planejado.
 */

const API = process.env.META_GRAPH_URL ?? "https://graph.facebook.com/v21.0";

export interface IgProfile {
  username?: string;
  name?: string;
  biography?: string;
  website?: string;
  picture?: string;
  followers?: number;
  follows?: number;
  mediaCount?: number;
}

export interface IgMedia {
  id: string;
  type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  thumb?: string;
  permalink?: string;
  timestamp?: string;
}

async function graph<T>(path: string, revalidate: number): Promise<T | null> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(`${API}/${path}${sep}access_token=${token}`, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function igProfile(igUserId: string | undefined): Promise<IgProfile | null> {
  if (!igUserId) return null;
  const j = await graph<{ username?: string; name?: string; biography?: string; website?: string; profile_picture_url?: string; followers_count?: number; follows_count?: number; media_count?: number }>(
    `${igUserId}?fields=username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count`, 3600);
  if (!j) return null;
  return { username: j.username, name: j.name, biography: j.biography, website: j.website, picture: j.profile_picture_url, followers: j.followers_count, follows: j.follows_count, mediaCount: j.media_count };
}

export async function igRecentMedia(igUserId: string | undefined, limit = 18): Promise<IgMedia[]> {
  if (!igUserId) return [];
  const j = await graph<{ data?: { id: string; media_type: IgMedia["type"]; media_url?: string; thumbnail_url?: string; permalink?: string; timestamp?: string }[] }>(
    `${igUserId}/media?fields=id,media_type,media_url,thumbnail_url,permalink,timestamp&limit=${limit}`, 1800);
  return (j?.data ?? []).map((m) => ({ id: m.id, type: m.media_type, thumb: m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url, permalink: m.permalink, timestamp: m.timestamp }));
}

export interface IgAccount { igUserId: string; username?: string; pageId: string; pageName: string }

/** Contas do Instagram que o token de sistema enxerga (páginas com conta profissional ligada). */
export async function igAccounts(): Promise<IgAccount[]> {
  const j = await graph<{ data?: { id: string; name: string; instagram_business_account?: { id: string; username?: string } }[] }>(
    "me/accounts?fields=id,name,instagram_business_account{id,username}&limit=100", 600);
  return (j?.data ?? []).filter((p) => p.instagram_business_account).map((p) => ({
    igUserId: p.instagram_business_account!.id, username: p.instagram_business_account!.username, pageId: p.id, pageName: p.name,
  }));
}
