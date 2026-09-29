"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";
import { requireAdmin } from "@/lib/auth";
import { createUser, deleteUser, type Role } from "@/lib/users";

export async function createUserAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    const role = String(fd.get("role") ?? "cliente") as Role;
    await createUser({ name: String(fd.get("name") ?? ""), email: String(fd.get("email") ?? ""), role, clientSlug: role === "cliente" ? String(fd.get("clientSlug") ?? "") : undefined, password: String(fd.get("password") ?? "") });
    revalidatePath("/admin/usuarios");
    return { ok: true, message: "Acesso criado." };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : String(e) }; }
}

export async function deleteUserAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  await deleteUser(String(fd.get("id") ?? ""));
  revalidatePath("/admin/usuarios");
  return { ok: true, message: "Acesso removido." };
}
