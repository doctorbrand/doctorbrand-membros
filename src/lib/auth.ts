import { createHash, createHmac } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUsers, type Role } from "./users";

export const COOKIE = "db_painel";
export const USER_COOKIE = "db_user";

export interface Session {
  role: Role;
  name: string;
  userId?: string;
  clientSlug?: string;
  /** Equipe vendo a área exatamente como o cliente vê (nada é salvo). */
  preview?: boolean;
  /** Nome de quem está na visualização (a equipe). */
  realName?: string;
}

export const PREVIEW_COOKIE = "db_preview";
export const PREVIEW_BLOCK = { ok: false, message: "Modo visualização: você está vendo como o cliente. Nada é salvo." } as const;

const secret = () => process.env.PANEL_PASSWORD ?? "";

export function expectedToken(): string {
  return createHash("sha256").update(`${secret()}:doctorbrand-painel:v1`).digest("hex");
}

export function signUser(userId: string): string {
  const sig = createHmac("sha256", `${secret()}:user`).update(userId).digest("hex");
  return `${userId}.${sig}`;
}

function verifyUser(token: string | undefined): string | null {
  if (!token) return null;
  const [id, sig] = token.split(".");
  if (!id || !sig) return null;
  const good = createHmac("sha256", `${secret()}:user`).update(id).digest("hex");
  return sig === good ? id : null;
}

/** Sessão de verdade, sem a visualização como cliente. */
export async function getRealSession(): Promise<Session | null> {
  if (!secret()) return null;
  const jar = await cookies();
  if (jar.get(COOKIE)?.value === expectedToken()) return { role: "admin", name: "Fernando (senha mestre)" };
  const uid = verifyUser(jar.get(USER_COOKIE)?.value);
  if (uid) {
    const u = (await getUsers()).find((x) => x.id === uid);
    if (u) return { role: u.role, name: u.name, userId: u.id, clientSlug: u.clientSlug };
  }
  return null;
}

/**
 * Sessão usada pelas páginas. Se a equipe ativou "Ver como o cliente", devolve uma sessão de cliente
 * daquele cliente, para a área inteira (menu, páginas e permissões) ficar igual à dele.
 */
export async function getSession(): Promise<Session | null> {
  const real = await getRealSession();
  if (real?.role !== "admin") return real;
  const slug = (await cookies()).get(PREVIEW_COOKIE)?.value;
  if (!slug) return real;
  const { getClient } = await import("./clients");
  const c = await getClient(slug).catch(() => undefined);
  if (!c) return real;
  return { role: "cliente", name: c.name, clientSlug: c.slug, preview: true, realName: real.name };
}

export async function isAuthed(): Promise<boolean> {
  return (await getSession()) !== null;
}

/** Exige login. Acesso de cliente só enxerga a própria página. */
/** Sem slug: páginas de todos (Ajuda). Com slug: o cliente só entra nas páginas dele. */
export async function requireAuth(allowedSlug?: string): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role === "cliente") {
    if (!s.clientSlug) redirect("/login?erro=sem-cliente");
    if (allowedSlug !== undefined && allowedSlug !== s.clientSlug) redirect(`/cliente/${s.clientSlug}`);
  }
  return s;
}

export async function requireAdmin(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role !== "admin") redirect(s.clientSlug ? `/cliente/${s.clientSlug}` : "/login");
  return s;
}
