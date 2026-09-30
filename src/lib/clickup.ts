/**
 * Leitura do ClickUp (só leitura): as tarefas da pasta de cada cliente viram o histórico de entregas
 * que o cliente vê em "Sua evolução". Tarefas internas da equipe (cobrança, follow-up, registros) ficam de fora.
 *
 * Variáveis: CLICKUP_API_TOKEN (token pessoal, obrigatório), CLICKUP_TEAM_ID e CLICKUP_SPACE_IDS (opcionais).
 */

const API = () => (process.env.CLICKUP_API_URL ?? "https://api.clickup.com/api/v2").replace(/\/$/, "");
const TEAM = () => process.env.CLICKUP_TEAM_ID ?? "9013380107";
/** Espaços com pastas de clientes: Fee Mensal, Doctorbrand.co (implementação) e Projetos encerrados. */
const SPACES = () => (process.env.CLICKUP_SPACE_IDS ?? "90131737811,901310177345,901313987812").split(",").map((s) => s.trim()).filter(Boolean);

export const clickupOn = () => !!process.env.CLICKUP_API_TOKEN;

async function cu<T>(path: string): Promise<T> {
  const res = await fetch(`${API()}${path}`, { headers: { Authorization: process.env.CLICKUP_API_TOKEN ?? "" }, next: { revalidate: 1800 } });
  if (!res.ok) throw new Error(`ClickUp ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return (await res.json()) as T;
}

interface CuFolder { id: string; name: string }
interface CuTask {
  id: string;
  name: string;
  status: { status: string; type: string };
  date_created: string;
  date_closed: string | null;
  date_done?: string | null;
  list: { name: string };
}

export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const stripTitle = (s: string) => norm(s).replace(/^(dr|dra)\s+/, "");

export async function listFolders(): Promise<CuFolder[]> {
  const all = await Promise.all(SPACES().map((sp) => cu<{ folders: CuFolder[] }>(`/space/${sp}/folder?archived=false`).then((r) => r.folders).catch(() => [])));
  return all.flat();
}

/** Pasta do cliente: "Brunno Bernardo — Core" casa com "Brunno Bernardo" (ou com um dos apelidos). */
export function matchFolder(folders: CuFolder[], names: string[]): CuFolder | undefined {
  const wanted = names.map(stripTitle).filter((n) => n.length >= 4);
  const base = (f: CuFolder) => stripTitle(f.name.split(/\s[—–-]\s/)[0]);
  return folders.find((f) => wanted.includes(base(f))) ?? folders.find((f) => wanted.some((w) => base(f).startsWith(w) || w.startsWith(base(f))));
}

async function folderTasks(folderId: string): Promise<CuTask[]> {
  const out: CuTask[] = [];
  for (let page = 0; page < 10; page++) {
    const r = await cu<{ tasks: CuTask[]; last_page?: boolean }>(`/team/${TEAM()}/task?project_ids[]=${folderId}&include_closed=true&subtasks=true&order_by=created&page=${page}`);
    out.push(...r.tasks);
    if (r.last_page || r.tasks.length < 100) break;
  }
  return out;
}

// ─── Classificação ────────────────────────────────────────────────────

export type WorkCat = "roteiro" | "planejamento" | "captacao" | "carrossel" | "video" | "foto" | "design" | "site" | "trafego" | "publicacao" | "estrategia" | "outra";

export const WORK_LABEL: Record<WorkCat, { one: string; many: string }> = {
  roteiro: { one: "Roteiro", many: "Roteiros escritos" },
  planejamento: { one: "Planejamento", many: "Planejamentos" },
  captacao: { one: "Captação", many: "Captações" },
  carrossel: { one: "Carrossel", many: "Carrosséis" },
  video: { one: "Vídeo", many: "Vídeos editados" },
  foto: { one: "Fotos", many: "Fotos editadas" },
  design: { one: "Design", many: "Peças de design" },
  site: { one: "Site", many: "Site e páginas" },
  trafego: { one: "Anúncios", many: "Campanhas e criativos" },
  publicacao: { one: "Publicação", many: "Publicações e legendas" },
  estrategia: { one: "Estratégia", many: "Estratégia e reuniões" },
  outra: { one: "Entrega", many: "Outras entregas" },
};

/** Tarefas de bastidor da equipe: não são entrega para o cliente. */
const INTERNAL = /^fase \d|cobrar|follow ?up|memoria|notificar|registrar|subir conteudo|atualizacao notion|estrutura do planej|revisao final|revisar planejamento|revisao de|monitorar|^teste|template/;

export function classify(name: string, list: string): WorkCat | null {
  const t = norm(name), l = norm(list);
  if (INTERNAL.test(t)) return null;
  if (/roteiro|script/.test(t)) return "roteiro";
  if (/carross/.test(t)) return "carrossel";
  if (/^\d+\.\s/.test(name.trim())) return "roteiro";
  if (/planej/.test(t)) return "planejamento";
  if (/foto/.test(t)) return "foto";
  if (/captac|gravac/.test(t)) return "captacao";
  if (/design|capa|arte|grid|visual|\bfeed\b|grafica|identidade|logo|cartao/.test(t)) return "design";
  if (/video|reels|edit/.test(t)) return "video";
  if (/site|landing/.test(l) || /\blp\b|site|landing|pagina/.test(t)) return "site";
  if (/trafego/.test(l) || /campanha|anuncio|criativo|pixel/.test(t)) return "trafego";
  if (/agendar|program|post|legenda|publica|copy/.test(t)) return "publicacao";
  if (/reuniao|alinhamento|diagnostico|analise|estrateg|onboarding/.test(t)) return "estrategia";
  return "outra";
}

/** Título para o cliente: sem o nome dele no fim, sem marcações internas. */
export function cleanTitle(name: string, clientNames: string[]): string {
  const prefixes = [...new Set(clientNames.flatMap((n) => n.split(/\s+/)).map(norm).filter((x) => x.length >= 4).map((x) => x.slice(0, 4)))];
  const isName = (w: string) => { const n = norm(w); return n.length >= 4 && prefixes.some((p) => n.startsWith(p)); };
  const words = name.replace(/\p{Extended_Pictographic}/gu, "").replace(/^\((postado|ok|feito)\)\s*/i, "").replace(/\.(mp4|mov|png|jpe?g|docx?|pdf|md)$/i, "").split(/\s+/);
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    if (/^(dr|dra)\.?$/i.test(words[i]) && words[i + 1] && isName(words[i + 1])) continue;
    if (isName(words[i])) { if (words[i + 1] && /^[A-Z]\.?$/.test(words[i + 1])) i++; continue; }
    out.push(words[i]);
  }
  const t = out.join(" ").replace(/\s+v_?\d+$/i, "").replace(/\s+[|—–-]\s+(?=[|—–-]|$)/g, " ").replace(/(\s+[|—–-])+\s*$/g, "").replace(/^\s*[|—–-]\s+/, "").replace(/\s+\|\s+/g, " · ").replace(/\s{2,}/g, " ").trim();
  return t || name;
}

export interface WorkItem { title: string; date: string; cat: WorkCat }
export interface WorkSummary {
  folder: string;
  done: number;
  open: number;
  hidden: number;
  since: string | null;
  byCat: { cat: WorkCat; count: number }[];
  months: { month: string; count: number }[];
  recent: WorkItem[];
  now: (WorkItem & { status: string })[];
  doneDates: WorkItem[];
}

const isoDay = (ms: string | null | undefined) => (ms ? new Date(Number(ms) - 3 * 3600e3).toISOString().slice(0, 10) : "");

export function summarize(tasks: CuTask[], clientNames: string[], folder: string, today: string): WorkSummary {
  const done: WorkItem[] = [], open: (WorkItem & { status: string })[] = [];
  let hidden = 0, since: string | null = null;
  for (const t of tasks) {
    const cat = classify(t.name, t.list?.name ?? "");
    const created = isoDay(t.date_created);
    if (created && (!since || created < since)) since = created;
    if (!cat) { hidden++; continue; }
    const closed = t.status?.type === "closed" || t.status?.type === "done" || !!t.date_closed;
    const title = cleanTitle(t.name, clientNames);
    if (closed) done.push({ title, cat, date: isoDay(t.date_done ?? t.date_closed) || created });
    else open.push({ title, cat, date: created, status: t.status?.status ?? "" });
  }
  done.sort((a, b) => b.date.localeCompare(a.date));
  const counts = new Map<WorkCat, number>();
  for (const d of done) counts.set(d.cat, (counts.get(d.cat) ?? 0) + 1);
  const months: { month: string; count: number }[] = [];
  const [ty, tm] = today.split("-").map(Number);
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(ty, tm - 1 - i, 1));
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    months.push({ month: ym, count: done.filter((x) => x.date.startsWith(ym)).length });
  }
  return {
    folder,
    done: done.length,
    open: open.length,
    hidden,
    since,
    byCat: [...counts.entries()].map(([cat, count]) => ({ cat, count })).sort((a, b) => (a.cat === "outra" ? 1 : b.cat === "outra" ? -1 : b.count - a.count)),
    months,
    recent: done.slice(0, 12),
    now: open.filter((o) => !/^a fazer$|^to do$|^backlog$/i.test(o.status)).slice(0, 6),
    doneDates: done,
  };
}

export type WorkResult = { ok: true; data: WorkSummary } | { ok: false; reason: "off" | "sem-pasta" | "erro"; message: string };

export async function getWork(names: string[], override: string | undefined, today: string): Promise<WorkResult> {
  if (!clickupOn()) return { ok: false, reason: "off", message: "CLICKUP_API_TOKEN não configurado no Vercel." };
  try {
    const folders = await listFolders();
    const folder: CuFolder | undefined = override ? folders.find((f) => f.id === override) ?? { id: override, name: override } : matchFolder(folders, names);
    if (!folder) return { ok: false, reason: "sem-pasta", message: `Nenhuma pasta do ClickUp com o nome "${names[0]}".` };
    const tasks = await folderTasks(folder.id);
    return { ok: true, data: summarize(tasks, names, folder.name, today) };
  } catch (e) {
    return { ok: false, reason: "erro", message: e instanceof Error ? e.message : String(e) };
  }
}
