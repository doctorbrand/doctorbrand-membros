"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";
import { requireAdmin } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { publicBase } from "@/lib/signed";
import { createUser, deleteUser, generatePassword, resetPassword, updateUser, type Role } from "@/lib/users";

/** Resultado com a senha, mostrada uma única vez para a equipe mandar ao dono do acesso. */
export type AccessResult = ActionResult & { cred?: { name: string; email: string; password: string; message: string } };

/** "equipe" ou "cliente:<slug>"; aceita também os campos antigos role/clientSlug. */
function vinculo(fd: FormData): { role: Role; clientSlug?: string } {
  const v = String(fd.get("vinculo") ?? "");
  if (v === "equipe") return { role: "admin" };
  if (v.startsWith("cliente:")) return { role: "cliente", clientSlug: v.slice(8) || undefined };
  const role = (String(fd.get("role") ?? "cliente") === "admin" ? "admin" : "cliente") as Role;
  return { role, clientSlug: role === "cliente" ? String(fd.get("clientSlug") ?? "") || undefined : undefined };
}

const first = (name: string) => name.replace(/^(dra?\.?\s+)/i, "").split(" ")[0];

function mensagem(name: string, email: string, password: string, role: Role): string {
  const base = publicBase();
  return role === "admin"
    ? `Oi, ${first(name)}! Seu acesso de equipe à área de membros da DoctorBrand:\n${base}/login\nE-mail: ${email}\nSenha: ${password}`
    : `Olá, ${first(name)}! Seu acesso à área de membros da DoctorBrand está pronto. Lá você aprova os posts, acompanha o projeto e fala com a equipe.\n${base}/login\nE-mail: ${email}\nSenha: ${password}\nGuarde esta senha. Se esquecer, é só pedir uma nova para a equipe.`;
}

export async function createAccessAction(_prev: AccessResult | null, fd: FormData): Promise<AccessResult> {
  await requireAdmin();
  try {
    const { role, clientSlug } = vinculo(fd);
    if (role === "cliente" && !clientSlug) throw new Error("Escolha de qual cliente é o acesso.");
    if (clientSlug && !(await getClient(clientSlug))) throw new Error("Cliente não encontrado.");
    const name = String(fd.get("name") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const typed = String(fd.get("password") ?? "").trim();
    const password = typed || generatePassword();
    if (/^\S+@\S+\.\S+$/.test(email) === false) throw new Error("E-mail inválido.");
    await createUser({ name, email, role, clientSlug, password });
    revalidatePath("/admin/usuarios");
    return { ok: true, message: "Acesso criado.", cred: { name, email, password, message: mensagem(name, email, password, role) } };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : String(e) }; }
}

export async function resetAccessAction(id: string, _prev: AccessResult | null): Promise<AccessResult> {
  await requireAdmin();
  try {
    const { user, password } = await resetPassword(id);
    revalidatePath("/admin/usuarios");
    return { ok: true, message: "Senha nova gerada. A antiga deixou de funcionar.", cred: { name: user.name, email: user.email, password, message: mensagem(user.name, user.email, password, user.role) } };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : String(e) }; }
}

export async function updateAccessAction(id: string, _prev: AccessResult | null, fd: FormData): Promise<AccessResult> {
  await requireAdmin();
  try {
    const { role, clientSlug } = vinculo(fd);
    if (role === "cliente" && !clientSlug) throw new Error("Escolha de qual cliente é o acesso.");
    if (clientSlug && !(await getClient(clientSlug))) throw new Error("Cliente não encontrado.");
    await updateUser(id, { name: String(fd.get("name") ?? ""), email: String(fd.get("email") ?? "").trim().toLowerCase(), role, clientSlug });
    revalidatePath("/admin/usuarios");
    return { ok: true, message: "Acesso atualizado." };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : String(e) }; }
}

export async function deleteAccessAction(id: string, _prev: AccessResult | null): Promise<AccessResult> {
  await requireAdmin();
  await deleteUser(id);
  revalidatePath("/admin/usuarios");
  return { ok: true, message: "Acesso removido." };
}
