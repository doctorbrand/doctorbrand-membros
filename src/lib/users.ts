import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from "crypto";
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

/** Formato antigo (sha256), mantido só para conferir senhas já criadas. */
function legacyHash(pw: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${pw}`).digest("hex");
}

/** scrypt: lento de propósito, para senha vazada não ser descoberta por força bruta. */
export function hashPassword(pw: string, salt: string): string {
  return `s1$${scryptSync(pw, salt, 32, { N: 16384, r: 8, p: 1 }).toString("hex")}`;
}

function checkPassword(u: User, pw: string): boolean {
  const got = Buffer.from(u.hash.startsWith("s1$") ? hashPassword(pw, u.salt) : legacyHash(pw, u.salt));
  const want = Buffer.from(u.hash);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Senha fácil de ditar e digitar: sem letras que se confundem (l, 1, O, 0). */
export function generatePassword(): string {
  const A = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const part = () => Array.from({ length: 4 }, () => A[randomInt(A.length)]).join("");
  return `${part()}-${part()}-${part()}`;
}

export async function createUser(u: { name: string; email: string; role: Role; clientSlug?: string; password: string }): Promise<User> {
  const users = await getUsers();
  const email = u.email.trim().toLowerCase();
  if (!email || !u.name.trim()) throw new Error("Nome e e-mail são obrigatórios.");
  if (users.some((x) => x.email === email)) throw new Error("Já existe um acesso com esse e-mail.");
  if (u.role === "cliente" && !u.clientSlug) throw new Error("Escolha o cliente vinculado.");
  if (u.password.length < 8) throw new Error("Senha precisa ter 8+ caracteres.");
  const salt = randomBytes(16).toString("hex");
  const user: User = { id: crypto.randomUUID(), name: u.name.trim(), email, role: u.role, clientSlug: u.role === "cliente" ? u.clientSlug : undefined, salt, hash: hashPassword(u.password, salt), createdAt: new Date().toISOString() };
  users.push(user);
  await writeDoc("users", users);
  return user;
}

export async function updateUser(id: string, patch: { name: string; email: string; role: Role; clientSlug?: string; password?: string }): Promise<void> {
  const users = await getUsers();
  const u = users.find((x) => x.id === id);
  if (!u) throw new Error("Acesso não encontrado.");
  const email = patch.email.trim().toLowerCase();
  if (!email || !patch.name.trim()) throw new Error("Nome e e-mail são obrigatórios.");
  if (users.some((x) => x.id !== id && x.email === email)) throw new Error("Já existe outro acesso com esse e-mail.");
  if (patch.role === "cliente" && !patch.clientSlug) throw new Error("Escolha o cliente vinculado.");
  u.name = patch.name.trim();
  u.email = email;
  u.role = patch.role;
  u.clientSlug = patch.role === "cliente" ? patch.clientSlug : undefined;
  if (patch.password) {
    if (patch.password.length < 8) throw new Error("Senha precisa ter 8+ caracteres.");
    u.salt = randomBytes(16).toString("hex");
    u.hash = hashPassword(patch.password, u.salt);
  }
  await writeDoc("users", users);
}

export async function deleteUser(id: string): Promise<void> {
  const users = await getUsers();
  await writeDoc("users", users.filter((u) => u.id !== id));
}

export async function authenticate(email: string, password: string): Promise<User | null> {
  const users = await getUsers();
  const u = users.find((x) => x.email === email.trim().toLowerCase());
  if (!u || !checkPassword(u, password)) return null;
  // Senha no formato antigo é regravada no novo, sem a pessoa perceber.
  if (!u.hash.startsWith("s1$")) { u.salt = randomBytes(16).toString("hex"); u.hash = hashPassword(password, u.salt); }
  u.lastLoginAt = new Date().toISOString();
  await writeDoc("users", users).catch(() => undefined);
  return u;
}

/** Troca só a senha (gerada pelo sistema) e devolve a nova, para a equipe mandar. */
export async function resetPassword(id: string): Promise<{ user: User; password: string }> {
  const users = await getUsers();
  const u = users.find((x) => x.id === id);
  if (!u) throw new Error("Acesso não encontrado.");
  const password = generatePassword();
  u.salt = randomBytes(16).toString("hex");
  u.hash = hashPassword(password, u.salt);
  await writeDoc("users", users);
  return { user: u, password };
}
