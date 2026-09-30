/**
 * ZapSign (só leitura): status dos contratos e link do arquivo assinado.
 * Variável: ZAPSIGN_API_TOKEN (Configurações, Integrações, API ZapSign).
 * Os links de arquivo da ZapSign valem 60 minutos, por isso o botão passa por /api/contrato/<slug>.
 */
const API = () => (process.env.ZAPSIGN_API_URL ?? "https://api.zapsign.com.br/api/v1").replace(/\/$/, "");
export const zapsignOn = () => !!process.env.ZAPSIGN_API_TOKEN;

async function zs<T>(path: string, revalidate = 900): Promise<T> {
  const res = await fetch(`${API()}${path}`, { headers: { Authorization: `Bearer ${process.env.ZAPSIGN_API_TOKEN ?? ""}` }, next: { revalidate } });
  if (!res.ok) throw new Error(`ZapSign ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return (await res.json()) as T;
}

export interface ZsSigner { name: string; email?: string; status: string; signed_at: string | null }
export interface ZsDoc { token: string; name: string; status: "pending" | "signed" | "refused" | string; created_at: string; signers?: ZsSigner[]; signed_file?: string | null; original_file?: string | null }

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Todos os documentos da conta (até 10 páginas), com signatários. */
export async function listDocs(): Promise<ZsDoc[]> {
  const out: ZsDoc[] = [];
  for (let page = 1; page <= 10; page++) {
    const r = await zs<{ results: ZsDoc[]; next: string | null }>(`/docs/?page=${page}&include_signers=true`);
    out.push(...r.results);
    if (!r.next) break;
  }
  return out;
}

/** Quem assina pela DoctorBrand: não serve para identificar o cliente. */
const TEAM = () => (process.env.ZAPSIGN_TEAM_SIGNERS ?? "fernando fontes,fernando vieira fontes,doctorbrand,doctor brand,octo digital").split(",").map((x) => norm(x)).filter(Boolean);
const isTeam = (name: string) => { const n = norm(name); return TEAM().some((t) => n.includes(t)); };

/** Contratos do cliente: nome no título ou em algum signatário que não seja da equipe. Mais recente primeiro. */
export function docsFor(docs: ZsDoc[], names: string[]): ZsDoc[] {
  const keys = names.map(norm).filter((n) => n.length >= 5 && !isTeam(n));
  if (!keys.length) return [];
  const hit = (s: string) => { const n = norm(s); return keys.some((k) => n.includes(k)); };
  return docs.filter((d) => hit(d.name) || (d.signers ?? []).some((s) => !isTeam(s.name) && hit(s.name))).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getDoc(token: string): Promise<ZsDoc> {
  return zs<ZsDoc>(`/docs/${encodeURIComponent(token)}/`, 0);
}

export interface ZsStatus { token: string; name: string; status: string; created: string; signedAt?: string; pendentes: string[] }

export function summarizeDoc(d: ZsDoc): ZsStatus {
  const signers = d.signers ?? [];
  const signedAt = signers.map((s) => s.signed_at).filter((x): x is string => !!x).sort().at(-1);
  return { token: d.token, name: d.name, status: d.status, created: d.created_at.slice(0, 10), signedAt: signedAt?.slice(0, 10), pendentes: signers.filter((s) => s.status !== "signed").map((s) => s.name) };
}

/** Contrato principal do cliente na ZapSign: o escolhido pela equipe ou o mais recente com o nome dele. */
export async function clientContract(names: string[], chosen?: string): Promise<{ doc: ZsStatus; all: ZsStatus[] } | null> {
  if (!zapsignOn()) return null;
  try {
    const all = docsFor(await listDocs(), names).map(summarizeDoc);
    const doc = (chosen && all.find((d) => d.token === chosen)) || all.find((d) => d.status === "signed") || all[0];
    return doc ? { doc, all } : null;
  } catch {
    return null;
  }
}
