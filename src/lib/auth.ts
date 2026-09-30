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
}

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

export async function getSession(): Promise<Session | null> {
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

export async function isAuthed(): Promise<boolean> {
  return (await getSession()) !== null;
}

/** Exige login. Acesso de cliente só enxerga a própria página. */
export async function requireAuth(allowedSlug?: string): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role === "cliente") {
    if (!s.clientSlug) redirect("/login?erro=sem-cliente");
    if (allowedSlug !== s.clientSlug) redirect(`/cliente/${s.clientSlug}`);
  }
  return s;
}

export async function requireAdmin(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role !== "admin") redirect(s.clientSlug ? `/cliente/${s.clientSlug}` : "/login");
  return s;
}
