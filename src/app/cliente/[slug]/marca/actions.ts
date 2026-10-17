"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { saveBrand } from "@/lib/brandStore";
import { getClient } from "@/lib/clients";
import { parseDriveLinks } from "@/lib/drive";
import { linkCanvaValido } from "@/lib/studio";
import type { ActionResult } from "@/lib/types";

const page = (slug: string) => `/cliente/${slug}/marca`;

/** Id da pasta do Canva a partir do link (canva.com/folder/<id>) ou do próprio id. */
function pastaCanva(v: string): string | undefined | null {
  if (!v) return undefined;
  const m = v.match(/canva\.com\/folder\/([\w-]+)/i);
  if (m) return m[1];
  return /^[\w-]{4,80}$/.test(v) ? v : null;
}

/** Canva (modelo e pasta), tom de voz e regras, e pasta de fotos do Drive. */
export async function saveBrandAction(slug: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await requireAdmin();
  if (!(await getClient(slug))) return { ok: false, message: "Cliente não encontrado." };
  const str = (k: string) => String(fd.get(k) ?? "").trim();
  const drive = str("driveFolder");
  if (drive && parseDriveLinks(drive).folders.length === 0) return { ok: false, message: "O link da pasta do Drive não parece ser de uma pasta (drive.google.com/drive/folders/...)." };
  const modelo = str("canvaModelo");
  if (modelo && !linkCanvaValido(modelo)) return { ok: false, message: "O link do modelo precisa ser do Canva (https://www.canva.com/design/... ou https://canva.link/...)." };
  const pasta = pastaCanva(str("canvaPasta"));
  if (pasta === null) return { ok: false, message: "A pasta do Canva precisa ser o link da pasta (canva.com/folder/...) ou o id dela." };
  await saveBrand(slug, {
    driveFolder: drive || undefined,
    rules: str("rules").replace(/\r\n?/g, "\n").slice(0, 6000),
    canvaModelo: modelo || undefined,
    canvaPasta: pasta,
  }, s.name);
  revalidatePath(page(slug));
  return { ok: true, message: "Kit de marca salvo." };
}
