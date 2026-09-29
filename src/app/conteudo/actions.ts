"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { addClient, updateClient } from "@/lib/clients";
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

export async function editClientAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await requireAdmin();
  const slug = String(fd.get("slug") ?? "");
  const name = String(fd.get("name") ?? "").trim();
  const specialty = String(fd.get("specialty") ?? "").trim();
  if (!slug || name.length < 2) return { ok: false, message: "Informe o nome do cliente." };
  await updateClient(slug, { name, specialty }, s.name);
  revalidatePath("/conteudo");
  return { ok: true, message: "Cliente atualizado." };
}
