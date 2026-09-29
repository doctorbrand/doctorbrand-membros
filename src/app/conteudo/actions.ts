"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { addClient, getClient, updateClient } from "@/lib/clients";
import { deleteUser, getUsers } from "@/lib/users";
import { storeEnabled } from "@/lib/store";
import type { ActionResult } from "@/lib/types";

export async function addClientAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await requireAdmin();
  const name = String(fd.get("name") ?? "").trim();
  const specialty = String(fd.get("specialty") ?? "").trim();
  if (name.length < 2) return { ok: false, message: "Informe o nome do cliente." };
  if (!storeEnabled()) return { ok: false, message: "Armazenamento não configurado (BLOB_READ_WRITE_TOKEN)." };
  const c = await addClient(name, specialty, s.name);
  revalidatePath("/conteudo");
  return { ok: true, message: `${c.name} adicionado. Crie o acesso dele em Acessos.` };
}

/** Tira o cliente da área de membros e remove os acessos dele. Os posts ficam guardados no armazenamento. */
export async function removeClientAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await requireAdmin();
  const slug = String(fd.get("slug") ?? "");
  const c = await getClient(slug);
  if (!c) return { ok: false, message: "Cliente não encontrado." };
  await updateClient(slug, { removed: true, igUserId: undefined, pageId: undefined }, s.name);
  for (const u of (await getUsers()).filter((u) => u.clientSlug === slug)) await deleteUser(u.id);
  revalidatePath("/conteudo");
  revalidatePath("/admin/usuarios");
  return { ok: true, message: `${c.name} saiu da área de membros.` };
}
