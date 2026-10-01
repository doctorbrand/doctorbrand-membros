import { clickupOn, listFolders, matchFolder } from "./clickup";
import { getClient } from "./clients";
import { TYPE_LABEL, type Post } from "./content";
import { calendarAliases, getProject } from "./project";
import { publicBase } from "./signed";
import { readDoc, writeDoc } from "./store";

/**
 * Pedido de alteração do cliente vira tarefa no ClickUp para a Alexandra (design).
 * A tarefa entra na lista "Social Media" da pasta do cliente; sem pasta, na lista de avisos da área de membros.
 * Novo pedido no mesmo post, com a tarefa ainda aberta, entra como comentário na mesma tarefa.
 * Variáveis opcionais: CLICKUP_ALEXANDRA_ID e CLICKUP_AVISOS_LIST.
 */
const API = () => (process.env.CLICKUP_API_URL ?? "https://api.clickup.com/api/v2").replace(/\/$/, "");
const ALEXANDRA = () => Number(process.env.CLICKUP_ALEXANDRA_ID ?? 118039934);
const FALLBACK_LIST = () => process.env.CLICKUP_AVISOS_LIST ?? "1400320000002416";
const DOC = "alteracoes/clickup";

export interface AlteracaoTask { taskId: string; url: string; at: string }
export const getAlteracaoTasks = () => readDoc<Record<string, AlteracaoTask>>(DOC, {});
export const alteracaoKey = (slug: string, postId: string) => `${slug}:${postId}`;

async function cu<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API()}${path}`, {
    method, cache: "no-store", signal: AbortSignal.timeout(8000),
    headers: { Authorization: process.env.CLICKUP_API_TOKEN ?? "", ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`ClickUp ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return (await res.json()) as T;
}

const flat = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Lista "Social Media" da pasta do cliente no ClickUp. */
async function listaDoCliente(slug: string): Promise<{ id: string; folder?: string }> {
  const [client, project] = await Promise.all([getClient(slug), getProject(slug).catch(() => null)]);
  try {
    const names = [client?.name ?? slug, ...(project ? calendarAliases(slug, project) : [])];
    const folder = project?.clickupFolder ? { id: project.clickupFolder, name: "" } : matchFolder(await listFolders(), names);
    if (!folder) return { id: FALLBACK_LIST() };
    const { lists } = await cu<{ lists: { id: string; name: string }[] }>("GET", `/folder/${folder.id}/list?archived=false`);
    const social = lists.find((l) => flat(l.name).includes("social")) ?? lists.find((l) => /legad|conteudo/.test(flat(l.name)));
    return social ? { id: social.id, folder: folder.name } : { id: FALLBACK_LIST() };
  } catch {
    return { id: FALLBACK_LIST() };
  }
}

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Prazo: véspera da publicação às 18h (Brasília), no máximo em 2 dias e no mínimo 2 horas a partir de agora. */
function prazo(post: Post, now = Date.now()): { due: number; priority: number } {
  const pub = Date.parse(`${post.date}T${post.time ?? "12:00"}:00-03:00`);
  const vespera = Date.parse(`${post.date}T18:00:00-03:00`) - 86_400_000;
  const due = Math.max(now + 2 * 3_600_000, Math.min(vespera, now + 2 * 86_400_000));
  const falta = pub - now;
  const priority = falta < 86_400_000 ? 1 : falta < 2 * 86_400_000 ? 2 : 3;
  return { due, priority };
}

export type AlteracaoResult = { ok: true; url: string; comment: boolean } | { ok: false; error: string };

/** Cria a tarefa (ou comenta na que já está aberta). Nunca lança erro: quem chama não pode travar o pedido do cliente. */
export async function tarefaAlteracao(slug: string, post: Post, pedido: { by: string; note: string; onde?: string }): Promise<AlteracaoResult> {
  if (!clickupOn()) return { ok: false, error: "ClickUp não configurado (CLICKUP_API_TOKEN)." };
  try {
    const key = alteracaoKey(slug, post.id);
    const client = await getClient(slug);
    const link = `${publicBase()}/cliente/${slug}/conteudo?post=${encodeURIComponent(post.id)}`;
    const onde = pedido.onde ? ` ${pedido.onde}` : " no post";
    const quote = pedido.note.split(/\r?\n/).map((l) => `> ${l}`).join("\n");

    const prev = (await getAlteracaoTasks())[key];
    if (prev) {
      const open = await cu<{ status?: { type?: string } }>("GET", `/task/${prev.taskId}`).then((t) => t.status?.type !== "closed" && t.status?.type !== "done").catch(() => false);
      if (open) {
        await cu("POST", `/task/${prev.taskId}/comment`, { comment_text: `${pedido.by} pediu mais uma alteração${onde}:\n"${pedido.note}"\n${link}`, assignee: ALEXANDRA(), notify_all: true });
        return { ok: true, url: prev.url, comment: true };
      }
    }

    const list = await listaDoCliente(slug);
    const { due, priority } = prazo(post);
    const markdown_content = [
      `**${pedido.by}** pediu alteração${onde} pela área de membros.`,
      "",
      quote,
      "",
      `- ${TYPE_LABEL[post.type]} · publicação prevista ${dm(post.date)} às ${post.time ?? "12:00"}`,
      `- [Abrir o post na área de membros](${link})`,
      "",
      "Depois de ajustar, troque a mídia ou a capa no post e mande de novo para aprovação. O cliente recebe a nova versão lá.",
    ].join("\n");
    const task = await cu<{ id: string; url: string }>("POST", `/list/${list.id}/task`, {
      name: `Ajuste pedido · ${client?.name ?? slug} · ${post.title}${pedido.onde ? ` (${pedido.onde.replace(/^(na|no) /, "")})` : ""}`,
      markdown_content, assignees: [ALEXANDRA()], due_date: due, due_date_time: true, priority, tags: ["ajuste-cliente"],
    });
    const all = await getAlteracaoTasks();
    await writeDoc(DOC, { ...all, [key]: { taskId: task.id, url: task.url, at: new Date().toISOString() } });
    return { ok: true, url: task.url, comment: false };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
