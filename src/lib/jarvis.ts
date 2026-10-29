import { getAds } from "./ads";
import { getBrand } from "./brandStore";
import { getCircle } from "./circle";
import { getClient, listClients } from "./clients";
import { mediaUrl } from "./content-media";
import { getPlan, getPosts, MAX_ATTEMPTS, plannedAt, type Media, type Post } from "./content";
import { getAudits } from "./feedAudit";
import { scoreFeed } from "./feedScore";
import { getCrm } from "./clickup";
import { contratoStatus } from "./contrato";
import { getNps, grupo, npsPendente, ultima as ultimaNps } from "./nps";
import { getOnboarding } from "./onboarding";
import { getOrders } from "./orders";
import { previousMonth, buildReport } from "./report";
import { getProfile } from "./profile";
import { calendarAliases, getProject } from "./project";
import { todayISO } from "./periods";
import { signedMediaUrl } from "./signed";
import { getUsers } from "./users";
import { clientContract } from "./zapsign";

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

/** Uma data ISO (instante) como dia no fuso da agência: 23h no Rio ainda é o mesmo dia. */
function diaRio(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

/** Quando o post foi para aprovação pela última vez: o último "enviado" do histórico, senão a última edição. */
function enviadoEm(p: Post): string {
  return [...p.history].reverse().find((h) => h.action === "enviado")?.at ?? p.updatedAt;
}

/** Quando o post foi publicado: o registro da publicação, senão o histórico. */
function publicadoEm(p: Post): string | undefined {
  return p.publish?.publishedAt ?? [...p.history].reverse().find((h) => h.action === "publicado")?.at;
}

const falhou = (p: Post) => p.status === "agendado" && (p.publish?.attempts ?? 0) >= MAX_ATTEMPTS;

/**
 * O conteúdo de todos os clientes, em números, para o briefing e o registro diário do Jarvis
 * (GET /api/jarvis/resumo; formato em doctorbrand/jarvis, docs/members-api.md). Os números são os da
 * tabela "Conteúdo de todos os clientes" (/conteudo), mais três que dizem urgência: há quantos dias o post
 * mais antigo espera aprovação, as publicações que falharam e a data da última publicação.
 * Os avisos trazem o texto que o cliente escreveu no pedido de alteração e o erro de cada falha.
 */
export async function resumoConteudo() {
  const cs = (await listClients()).filter((c) => !c.removed);
  const hoje = todayISO();
  const agora = Date.now();
  const avisos: { client: string; kind: "change_request" | "failed_publication"; text: string; at: string }[] = [];

  const clients = await Promise.all(cs.map(async (c) => {
    const [posts, plan, nps, project] = await Promise.all([getPosts(c.slug), getPlan(c.slug), getNps(c.slug), getProject(c.slug).catch(() => null)]);
    // Contrato: prazo e renovação (projeto ou CRM do ClickUp) e assinatura na ZapSign, como em avisos.ts.
    const nomes = [c.name, ...(project ? calendarAliases(c.slug, project) : [])];
    const [crm, zs] = await Promise.all([getCrm(nomes).catch(() => null), clientContract(nomes, project?.contrato?.zapsign)]);
    const ct = contratoStatus(project?.contrato, hoje, crm?.desde, crm?.renovacao);
    const npsUltima = ultimaNps(nps);
    const visiveis = posts.filter((p) => p.status !== "rascunho");
    const aguardando = posts.filter((p) => p.status === "aguardando");
    const alteracao = posts.filter((p) => p.status === "alteracao");
    const agendados = posts.filter((p) => p.status === "agendado");
    const falhas = posts.filter(falhou);
    const proxima = [...agendados].sort((a, b) => plannedAt(a).getTime() - plannedAt(b).getTime())[0];
    const maisAntigo = aguardando.map((p) => new Date(enviadoEm(p)).getTime()).filter(Number.isFinite).sort((a, b) => a - b)[0];
    const ultima = posts.filter((p) => p.status === "publicado").map(publicadoEm).filter((d): d is string => !!d).sort().at(-1);

    for (const p of alteracao) {
      const pedido = [...p.history].reverse().find((h) => h.action === "alteracao");
      if (pedido) avisos.push({ client: c.slug, kind: "change_request", text: pedido.note?.trim() || `Alteração pedida em "${p.title}"`, at: pedido.at });
    }
    for (const p of falhas) {
      avisos.push({ client: c.slug, kind: "failed_publication", text: `"${p.title}" não publicou: ${p.publish?.lastError ?? "sem detalhe do erro"}`, at: p.publish?.lastTriedAt ?? p.updatedAt });
    }

    return {
      slug: c.slug,
      name: c.name,
      specialty: c.specialty ?? null,
      score: visiveis.length ? scoreFeed(posts, plan, hoje).total : null,
      changeRequests: alteracao.length,
      awaitingApproval: aguardando.length,
      oldestAwaitingDays: maisAntigo === undefined ? null : Math.max(0, Math.floor((agora - maisAntigo) / 86_400_000)),
      scheduled: agendados.length,
      drafts: posts.filter((p) => p.status === "rascunho").length,
      failedPublications: falhas.length,
      nextPublication: proxima ? plannedAt(proxima).toISOString() : null,
      lastPublished: ultima ? diaRio(ultima) : null,
      instagramConnected: !!c.igUserId,
      nps: {
        lastScore: npsUltima?.score ?? null,
        lastGroup: npsUltima ? grupo(npsUltima.score) : null,
        lastAt: npsUltima?.at.slice(0, 10) ?? null,
        lastComment: npsUltima?.comentario ?? null,
        pending: npsPendente(nps, ct.desde),
      },
      contract: {
        clientSince: ct.desde ?? null,
        renewal: ct.proxima ?? null,
        daysToRenewal: ct.diasParaProxima ?? null,
        expired: ct.vencido,
        needsNewContract: project?.contrato?.regra === "nova",
        signature: zs ? zs.doc.status : null,
        awaitingSignatureFrom: zs && zs.doc.status === "pending" ? zs.doc.pendentes : [],
      },
    };
  }));

  clients.sort((a, b) => (b.changeRequests + b.failedPublications) - (a.changeRequests + a.failedPublications) || b.awaitingApproval - a.awaitingApproval || a.name.localeCompare(b.name, "pt-BR"));
  avisos.sort((a, b) => b.at.localeCompare(a.at));
  return semSegredos({ generatedAt: new Date().toISOString(), clients, notices: avisos.slice(0, 20) });
}
