"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { DEFAULT_DELIVERABLES, defaultSteps, getProject, MATERIAL_KINDS, newId, saveProject, type MaterialKind, type Project, type StepStatus } from "@/lib/project";
import type { ActionResult } from "@/lib/types";

const path = (slug: string) => `/cliente/${slug}`;
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const STATUSES: StepStatus[] = ["nao_iniciada", "andamento", "concluida"];

async function edit(slug: string, fn: (p: Project) => Project | string): Promise<ActionResult> {
  const s = await requireAdmin();
  const cur = await getProject(slug);
  const next = fn(structuredClone(cur));
  if (typeof next === "string") return { ok: false, message: next };
  await saveProject(slug, next, s.name);
  revalidatePath(path(slug));
  return { ok: true, message: "Salvo." };
}

export async function saveProjectInfoAction(slug: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const whatsapp = str(fd, "whatsapp").replace(/\D/g, "");
  if (whatsapp && whatsapp.length < 10) return { ok: false, message: "WhatsApp com DDI e DDD, só números (ex.: 5521999999999)." };
  const calendarAliases = str(fd, "aliases").split(/[,;\n]/).map((a) => a.trim()).filter(Boolean).slice(0, 8);
  return edit(slug, (p) => ({ ...p, plano: str(fd, "plano"), whatsapp, calendarAliases }));
}

export async function addStepAction(slug: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const title = str(fd, "title");
  if (!title) return { ok: false, message: "Dê um nome para a etapa." };
  const due = str(fd, "due");
  return edit(slug, (p) => ({ ...p, steps: [...p.steps, { id: newId(), title, status: "nao_iniciada", due: due || undefined }] }));
}

export async function updateStepAction(slug: string, id: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const status = str(fd, "status") as StepStatus;
  if (!STATUSES.includes(status)) return { ok: false, message: "Status inválido." };
  const due = str(fd, "due"), note = str(fd, "note"), title = str(fd, "title");
  return edit(slug, (p) => {
    const st = p.steps.find((x) => x.id === id);
    if (!st) return "Etapa não encontrada.";
    Object.assign(st, { status, due: due || undefined, note: note || undefined, title: title || st.title });
    return p;
  });
}

export async function deleteStepAction(slug: string, id: string, _prev: ActionResult | null): Promise<ActionResult> {
  return edit(slug, (p) => ({ ...p, steps: p.steps.filter((x) => x.id !== id) }));
}

export async function moveStepAction(slug: string, id: string, dir: -1 | 1, _prev: ActionResult | null): Promise<ActionResult> {
  return edit(slug, (p) => {
    const i = p.steps.findIndex((x) => x.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= p.steps.length) return p;
    [p.steps[i], p.steps[j]] = [p.steps[j], p.steps[i]];
    return p;
  });
}

export async function applyDefaultStepsAction(slug: string, _prev: ActionResult | null): Promise<ActionResult> {
  return edit(slug, (p) => (p.steps.length ? "Este projeto já tem etapas." : { ...p, steps: defaultSteps() }));
}

export async function addMaterialAction(slug: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const url = str(fd, "url"), kind = str(fd, "kind") as MaterialKind;
  if (!/^https?:\/\//i.test(url)) return { ok: false, message: "Cole um link que comece com https://" };
  if (!MATERIAL_KINDS.some((k) => k.key === kind)) return { ok: false, message: "Escolha o tipo do material." };
  const title = str(fd, "title") || MATERIAL_KINDS.find((k) => k.key === kind)!.label;
  return edit(slug, (p) => ({ ...p, materialsEdited: true, materials: [...p.materials, { id: newId(), title, kind, url }] }));
}

export async function deleteMaterialAction(slug: string, id: string, _prev: ActionResult | null): Promise<ActionResult> {
  return edit(slug, (p) => ({ ...p, materialsEdited: true, materials: p.materials.filter((x) => x.id !== id) }));
}

// ─── Entregas recorrentes ─────────────────────────────────────────────

export async function addDeliverableAction(slug: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const title = str(fd, "title");
  const perMonth = Number(str(fd, "perMonth") || "1");
  if (!title) return { ok: false, message: "Dê um nome para a entrega." };
  if (!Number.isFinite(perMonth) || perMonth < 1 || perMonth > 60) return { ok: false, message: "Quantidade por mês entre 1 e 60." };
  return edit(slug, (p) => ({ ...p, deliverables: [...(p.deliverables ?? []), { id: newId(), title, perMonth: Math.round(perMonth), log: [] }] }));
}

export async function applyDefaultDeliverablesAction(slug: string, _prev: ActionResult | null): Promise<ActionResult> {
  return edit(slug, (p) => (p.deliverables?.length ? "Este projeto já tem entregas." : { ...p, deliverables: DEFAULT_DELIVERABLES.map((d) => ({ id: newId(), ...d, log: [] })) }));
}

export async function updateDeliverableAction(slug: string, id: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const title = str(fd, "title");
  const perMonth = Number(str(fd, "perMonth"));
  if (!Number.isFinite(perMonth) || perMonth < 1 || perMonth > 60) return { ok: false, message: "Quantidade por mês entre 1 e 60." };
  return edit(slug, (p) => {
    const d = p.deliverables?.find((x) => x.id === id);
    if (!d) return "Entrega não encontrada.";
    d.title = title || d.title;
    d.perMonth = Math.round(perMonth);
    return p;
  });
}

export async function deleteDeliverableAction(slug: string, id: string, _prev: ActionResult | null): Promise<ActionResult> {
  return edit(slug, (p) => ({ ...p, deliverables: (p.deliverables ?? []).filter((x) => x.id !== id) }));
}

export async function logDeliveryAction(slug: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = str(fd, "deliverable"), date = str(fd, "date"), url = str(fd, "url"), note = str(fd, "note");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: "Escolha a data da entrega." };
  if (url && !/^https?:\/\//i.test(url)) return { ok: false, message: "O link precisa começar com https://" };
  return edit(slug, (p) => {
    const d = p.deliverables?.find((x) => x.id === id);
    if (!d) return "Escolha qual entrega foi feita.";
    d.log.push({ id: newId(), date, url: url || undefined, note: note || undefined });
    return p;
  });
}

export async function deleteDeliveryAction(slug: string, deliverableId: string, entryId: string, _prev: ActionResult | null): Promise<ActionResult> {
  return edit(slug, (p) => {
    const d = p.deliverables?.find((x) => x.id === deliverableId);
    if (d) d.log = d.log.filter((e) => e.id !== entryId);
    return p;
  });
}
