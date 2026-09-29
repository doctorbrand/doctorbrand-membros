import { createHash, randomBytes } from "crypto";
import { readDoc, writeDoc } from "./store";

export type Role = "admin" | "cliente";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  clientSlug?: string;
  salt: string;
  hash: string;
  createdAt: string;
  lastLoginAt?: string;
}

export async function getUsers(): Promise<User[]> {
  return readDoc<User[]>("users", []);
}

export function hashPassword(pw: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${pw}`).digest("hex");
}

export async function createUser(u: { name: string; email: string; role: Role; clientSlug?: string; password: string }): Promise<User> {
  const users = await getUsers();
  const email = u.email.trim().toLowerCase();
  if (users.some((x) => x.email === email)) throw new Error("Já existe um acesso com esse e-mail.");
  if (u.password.length < 8) throw new Error("Senha precisa ter 8+ caracteres.");
  const salt = randomBytes(8).toString("hex");
  const user: User = { id: crypto.randomUUID(), name: u.name.trim(), email, role: u.role, clientSlug: u.role === "cliente" ? u.clientSlug : undefined, salt, hash: hashPassword(u.password, salt), createdAt: new Date().toISOString() };
  users.push(user);
  await writeDoc("users", users);
  return user;
}

export async function deleteUser(id: string): Promise<void> {
  const users = await getUsers();
  await writeDoc("users", users.filter((u) => u.id !== id));
}

export async function authenticate(email: string, password: string): Promise<User | null> {
  const users = await getUsers();
  const u = users.find((x) => x.email === email.trim().toLowerCase());
  if (!u || hashPassword(password, u.salt) !== u.hash) return null;
  u.lastLoginAt = new Date().toISOString();
  await writeDoc("users", users).catch(() => undefined);
  return u;
}
