import { getAds } from "./ads";
import { getBrand } from "./brandStore";
import { getCircle } from "./circle";
import { getClient, listClients } from "./clients";
import { mediaUrl } from "./content-media";
import { getPlan, getPosts, type Media, type Post } from "./content";
import { getAudits } from "./feedAudit";
import { getNps } from "./nps";
import { getOnboarding } from "./onboarding";
import { getOrders } from "./orders";
import { previousMonth, buildReport } from "./report";
import { getProfile } from "./profile";
import { getProject } from "./project";
import { signedMediaUrl } from "./signed";
import { getUsers } from "./users";

/**
 * Leitura de todo o conteúdo da área de membros para o Jarvis (assistente da DoctorBrand), pela API
 * /api/jarvis e pelas ferramentas de leitura do conector. Só leitura. Nunca sai senha, hash, token ou chave:
 * semSegredos() tira esses campos de tudo o que é devolvido.
 */

/** Nomes de campo que nunca saem: senhas e hashes de login, tokens (inclusive o da ZapSign), chaves, cookies. */
const SENSIVEL = /^(salt|hash|zapsign)$|senha|password|passwd|token|secret|api_?key|cookie|chat_?id/i;

export function semSegredos<T>(v: T): T {
  if (Array.isArray(v)) return v.map(semSegredos) as T;
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (!SENSIVEL.test(k)) out[k] = semSegredos(x);
    return out as T;
  }
  return v;
}

/** Link para abrir a mídia sem login: miniatura pública do Drive ou link assinado do Blob (vale 24 h). */
function comLink(m: Media) {
  const url = m.driveId ? mediaUrl(m) : m.path ? signedMediaUrl(m.path, 24 * 3600) : undefined;
  return { ...m, ...(url ? { url } : {}) };
}

function postParaLer(p: Post) {
  return { ...p, media: p.media.map(comLink), ...(p.cover ? { cover: comLink(p.cover) } : {}) };
}

export const SECOES = ["cadastro", "perfil", "projeto", "plano", "conteudo", "kit", "onboarding", "pedidos", "diagnosticos", "nps", "anuncios", "relatorio"] as const;
export type Secao = (typeof SECOES)[number];
/** Anúncios e relatório consultam o painel de tráfego e o Instagram na hora: só vêm quando pedidos. */
export const SECOES_PADRAO: Secao[] = SECOES.filter((s) => s !== "anuncios" && s !== "relatorio");

export function lerSecoes(v: unknown): Secao[] {
  const lista = (Array.isArray(v) ? v : String(v ?? "").split(",")).map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  if (!lista.length) return SECOES_PADRAO;
  if (lista.includes("tudo")) return [...SECOES];
  return SECOES.filter((s) => lista.includes(s));
}

/** Lista curta dos clientes (sem os removidos), com a contagem de posts por status. */
export async function resumoClientes() {
  const cs = (await listClients()).filter((c) => !c.removed);
  return Promise.all(cs.map(async (c) => {
    const posts = await getPosts(c.slug);
    const status: Record<string, number> = {};
    for (const p of posts) status[p.status] = (status[p.status] ?? 0) + 1;
    return semSegredos({ slug: c.slug, nome: c.name, especialidade: c.specialty, criadoEm: c.createdAt, posts: { total: posts.length, ...status } });
  }));
}

/** Tudo de um cliente, nas seções pedidas. Cada seção falha sozinha: o erro vem no lugar dela. */
export async function clienteCompleto(slug: string, secoes: Secao[] = SECOES_PADRAO) {
  const c = await getClient(slug);
  if (!c) return null;
  const tarefas: Record<Secao, () => Promise<unknown>> = {
    cadastro: async () => c,
    perfil: () => getProfile(slug),
    projeto: () => getProject(slug),
    plano: () => getPlan(slug),
    conteudo: async () => (await getPosts(slug)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).map(postParaLer),
    kit: () => getBrand(slug),
    onboarding: () => getOnboarding(slug),
    pedidos: () => getOrders(slug),
    diagnosticos: () => getAudits(slug),
    nps: () => getNps(slug),
    anuncios: () => getAds(slug, "30d"),
    relatorio: async () => { const mes = previousMonth(); return { mes, relatorio: await buildReport(slug, mes) }; },
  };
  const out: Record<string, unknown> = { slug: c.slug, nome: c.name };
  await Promise.all(secoes.map(async (s) => {
    try { out[s] = await tarefas[s](); } catch (e) { out[s] = { erro: e instanceof Error ? e.message : String(e) }; }
  }));
  return semSegredos(out);
}

/** Equipe e acessos de clientes: nome, e-mail, papel e último login. Nunca a senha. */
export async function equipe() {
  return (await getUsers()).map((u) => ({ id: u.id, nome: u.name, email: u.email, papel: u.role, cliente: u.clientSlug ?? null, criadoEm: u.createdAt, ultimoLogin: u.lastLoginAt ?? null }));
}

/** Indicações do Circle DoctorBrand. */
export async function indicacoes() {
  return semSegredos(await getCircle());
}

/** Tudo de todos os clientes, mais equipe e indicações. */
export async function tudo(secoes: Secao[] = SECOES_PADRAO) {
  const cs = (await listClients()).filter((c) => !c.removed);
  const clientes = [];
  // Um cliente por vez: são vários documentos por cliente e o Blob não gosta de rajadas.
  for (const c of cs) clientes.push(await clienteCompleto(c.slug, secoes));
  return { geradoEm: new Date().toISOString(), secoes, clientes, equipe: await equipe(), indicacoes: await indicacoes() };
}
