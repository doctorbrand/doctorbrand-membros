import { clientMeetings, meetingDate, meetingTime } from "./agenda";
import { listClients, type Client } from "./clients";
import { getPosts, type Post } from "./content";
import { igInsights } from "./instagram";
import { calendarAliases, getProject } from "./project";
import { avisarCliente, getPushDoc, horaBR, horarioOk, pushLigado, type TipoPush } from "./push";
import { previousMonth, reportLink, monthName } from "./report";
import { readDoc, writeDoc } from "./store";
import { getUsers } from "./users";
import { todayISO } from "./periods";

/**
 * Rodada das notificações dos clientes, chamada pelo cron de publicação (a cada 5 min, no máximo uma vez a cada 10).
 * Só entre 8h e 21h. O que já foi avisado fica em push/estado/<cliente>, para não repetir.
 */

interface Estado {
  aprovacaoEm?: string;
  publicados?: string[];
  resultados?: string[];
  semana?: string;
  reunioes?: string[];
  relatorio?: string;
}

const MIN = 60_000, HORA = 60 * MIN;
const fmt = (n: number) => n.toLocaleString("pt-BR");
const ultimos = (xs: string[]) => xs.slice(-80);
const publicadoEm = (p: Post) => p.publish?.publishedAt ?? [...p.history].reverse().find((h) => h.action === "publicado")?.at;
const enviadoEm = (p: Post) => [...p.history].reverse().find((h) => h.action === "enviado")?.at ?? p.updatedAt;
const nomeCurto = (p: Post) => (p.title.length > 60 ? `${p.title.slice(0, 57)}...` : p.title);

/** Clientes com pelo menos um acesso que ativou as notificações. */
async function clientesInscritos(): Promise<Set<string>> {
  const users = (await getUsers()).filter((u) => u.role === "cliente" && u.clientSlug);
  const out = new Set<string>();
  for (const u of users) {
    if (out.has(u.clientSlug!)) continue;
    const d = await getPushDoc(u.id).catch(() => null);
    if (d?.subs.length) out.add(u.clientSlug!);
  }
  return out;
}

async function rodadaCliente(c: Client, agora: Date, ate: number): Promise<string[]> {
  const feitos: string[] = [];
  const path = `push/estado/${c.slug}`;
  const e = await readDoc<Estado>(path, {});
  const antes = JSON.stringify(e);
  const posts = await getPosts(c.slug);
  const base = `/cliente/${c.slug}`;
  const t = agora.getTime();
  const enviar = async (tipo: TipoPush, title: string, body: string, url: string, tag?: string) => {
    const n = await avisarCliente(c.slug, tipo, { title, body, url, tag });
    feitos.push(`${tipo}:${n}`);
  };

  // 1. Posts para aprovar: avisa 10 min depois do último envio (junta os posts mandados em sequência)
  //    e, se continuarem parados, lembra uma vez por dia a partir das 10h.
  const aguardando = posts.filter((p) => p.status === "aguardando");
  if (aguardando.length) {
    const ultimoEnvio = Math.max(...aguardando.map((p) => Date.parse(enviadoEm(p)) || 0));
    const ultimoAviso = e.aprovacaoEm ? Date.parse(e.aprovacaoEm) : 0;
    const n = aguardando.length, s = n === 1 ? "post" : "posts";
    if (ultimoEnvio > ultimoAviso && t - ultimoEnvio >= 10 * MIN) {
      await enviar("aprovacao", n === 1 ? "Um post para aprovar" : `${n} posts para aprovar`, n === 1 ? `"${nomeCurto(aguardando[0])}" está esperando a sua aprovação.` : `A equipe enviou ${n} ${s}. Veja e aprove pelo app.`, `${base}/conteudo`, "aprovacao");
      e.aprovacaoEm = agora.toISOString();
    } else if (ultimoAviso && t - ultimoAviso >= 24 * HORA && horaBR(agora) >= 10) {
      await enviar("aprovacao", `${n} ${s} esperando você`, n === 1 ? `"${nomeCurto(aguardando[0])}" ainda está esperando a sua aprovação.` : `Ainda há ${n} ${s} esperando a sua aprovação.`, `${base}/conteudo`, "aprovacao");
      e.aprovacaoEm = agora.toISOString();
    }
  }

  // 2. Post publicado (nas últimas 48 h, uma vez por post).
  e.publicados ??= [];
  for (const p of posts) {
    const em = publicadoEm(p);
    if (p.status !== "publicado" || !em || t - Date.parse(em) > 48 * HORA || e.publicados.includes(p.id)) continue;
    await enviar("publicado", p.type === "reels" ? "Reels no ar" : p.type === "carrossel" ? "Carrossel no ar" : "Post no ar", `"${nomeCurto(p)}" foi publicado no seu Instagram.`, `${base}/conteudo?post=${p.id}#post`, `pub-${p.id}`);
    e.publicados = ultimos([...e.publicados, p.id]);
  }

  // 3. Resultado do post: entre 48 h e 72 h depois de publicar.
  e.resultados ??= [];
  for (const p of posts) {
    if (Date.now() > ate) break;
    const em = publicadoEm(p);
    const idade = em ? t - Date.parse(em) : -1;
    if (!p.publish?.igMediaId || idade < 48 * HORA || idade > 72 * HORA || e.resultados.includes(p.id)) continue;
    const ins = await igInsights(p.publish.igMediaId).catch(() => null);
    if (!ins?.reach) continue;
    const partes = [`${fmt(ins.reach)} contas alcançadas`];
    if (ins.saved) partes.push(`${fmt(ins.saved)} ${ins.saved === 1 ? "salvamento" : "salvamentos"}`);
    if (ins.shares) partes.push(`${fmt(ins.shares)} ${ins.shares === 1 ? "envio" : "envios"}`);
    await enviar("resultado", `Resultado: ${nomeCurto(p)}`, `Em dois dias: ${partes.join(", ")}.`, `${base}/conteudo?post=${p.id}#post`, `res-${p.id}`);
    e.resultados = ultimos([...e.resultados, p.id]);
  }

  // 4. Resumo da semana: segunda, a partir das 9h.
  const hoje = todayISO();
  const diaSemana = new Date(`${hoje}T12:00:00Z`).getUTCDay();
  if (diaSemana === 1 && horaBR(agora) >= 9 && e.semana !== hoje && Date.now() < ate) {
    const semana = posts.filter((p) => { const em = publicadoEm(p); return p.status === "publicado" && em && t - Date.parse(em) <= 7 * 24 * HORA; });
    if (semana.length) {
      let alcance = 0;
      for (const p of semana) if (p.publish?.igMediaId) alcance += (await igInsights(p.publish.igMediaId).catch(() => null))?.reach ?? 0;
      const s = semana.length === 1 ? "post foi" : "posts foram";
      await enviar("semana", "Sua semana no Instagram", `${semana.length} ${s} ao ar${alcance ? `, com ${fmt(alcance)} contas alcançadas` : ""}. Veja a evolução no app.`, `${base}/evolucao`, "semana");
    }
    e.semana = hoje;
  }

  // 5. Reunião amanhã: a partir das 17h da véspera.
  e.reunioes ??= [];
  if (horaBR(agora) >= 17 && Date.now() < ate) {
    const amanha = new Date(Date.parse(`${hoje}T12:00:00Z`) + 24 * HORA).toISOString().slice(0, 10);
    const project = await getProject(c.slug).catch(() => null);
    const ms = await clientMeetings(c.name, project ? calendarAliases(c.slug, project) : [], agora, new Date(t + 36 * HORA)).catch(() => null);
    for (const m of ms ?? []) {
      if (meetingDate(m.start) !== amanha || e.reunioes.includes(m.id)) continue;
      await enviar("reuniao", "Reunião amanhã", `${m.title}${m.allDay ? "" : `, às ${meetingTime(m)}`}.`, `${base}/calendario`, `reu-${m.id}`);
      e.reunioes = ultimos([...e.reunioes, m.id]);
    }
  }

  // 6. Relatório do mês anterior: do dia 1 ao dia 5, a partir das 10h.
  const mes = previousMonth(hoje);
  if (Number(hoje.slice(8, 10)) <= 5 && horaBR(agora) >= 10 && e.relatorio !== mes) {
    await enviar("relatorio", `Relatório de ${monthName(mes)}`, `O relatório de ${monthName(mes)} está pronto. Toque para ver os resultados do mês.`, reportLink(c.slug, mes), `rel-${mes}`);
    e.relatorio = mes;
  }

  if (JSON.stringify(e) !== antes) await writeDoc(path, e);
  return feitos;
}

export async function rodadaNotificacoes(prazoMs: number): Promise<{ clientes: number; feitos: Record<string, string[]> } | { pulou: string }> {
  if (!pushLigado()) return { pulou: "sem chaves" };
  const agora = new Date();
  if (!horarioOk(agora)) return { pulou: "fora do horário" };
  const ultima = await readDoc<{ em?: number }>("push/rodada", {});
  if ((ultima.em ?? 0) > agora.getTime() - 9 * MIN) return { pulou: "rodou há pouco" };
  await writeDoc("push/rodada", { em: agora.getTime() });

  const ate = Date.now() + prazoMs;
  const inscritos = await clientesInscritos();
  const feitos: Record<string, string[]> = {};
  for (const c of (await listClients()).filter((c) => !c.removed && inscritos.has(c.slug))) {
    if (Date.now() > ate) break;
    try {
      const f = await rodadaCliente(c, agora, ate);
      if (f.length) feitos[c.slug] = f;
    } catch (err) {
      feitos[c.slug] = [`erro: ${err instanceof Error ? err.message : String(err)}`];
    }
  }
  return { clientes: inscritos.size, feitos };
}
