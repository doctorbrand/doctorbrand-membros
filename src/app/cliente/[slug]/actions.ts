"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireAuth } from "@/lib/auth";
import { sendAlert } from "@/lib/alerts";
import { getClient } from "@/lib/clients";
import { addNps, adiarNps, grupo, GRUPO_LABEL } from "@/lib/nps";
import { publicBase } from "@/lib/signed";
import { DEFAULT_DELIVERABLES, defaultSteps, getProject, MATERIAL_KINDS, MATERIAL_SLOTS, newId, saveProject, type MaterialKind, type MetaFonte, type Project, type RegraRenovacao, type StepStatus, META_FONTES } from "@/lib/project";
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
  revalidatePath(path(slug), "layout");
  return { ok: true, message: "Salvo." };
}

export async function saveProjectInfoAction(slug: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const whatsapp = str(fd, "whatsapp").replace(/\D/g, "");
  if (whatsapp && whatsapp.length < 10) return { ok: false, message: "WhatsApp com DDI e DDD, só números (ex.: 5521999999999)." };
  const clienteWhatsapp = str(fd, "clienteWhatsapp").replace(/\D/g, "");
  if (clienteWhatsapp && clienteWhatsapp.length < 10) return { ok: false, message: "WhatsApp do cliente com DDI e DDD, só números (ex.: 5521999999999)." };
  const calendarAliases = str(fd, "aliases").split(/[,;\n]/).map((a) => a.trim()).filter(Boolean).slice(0, 8);
  return edit(slug, (p) => ({ ...p, plano: str(fd, "plano"), whatsapp, clienteWhatsapp: clienteWhatsapp || undefined, calendarAliases }));
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
  const title = str(fd, "title") || MATERIAL_SLOTS.find((k) => k.kind === kind)?.label || MATERIAL_KINDS.find((k) => k.key === kind)!.label;
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

// ─── Evolução: método, ClickUp e metas ───────────────────────────

export async function saveEvolucaoAction(slug: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const etapa = Number(str(fd, "etapa"));
  const folder = str(fd, "clickup").replace(/\D/g, "");
  if (!Number.isInteger(etapa) || etapa < 0 || etapa > 6) return { ok: false, message: "Escolha a etapa do método." };
  return edit(slug, (p) => ({ ...p, metodoEtapa: etapa, clickupFolder: folder || undefined }));
}

export async function saveObjetivoAction(slug: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const objetivo = str(fd, "objetivo"), periodo = str(fd, "periodo");
  if (!/^\d{4}-T[1-4]$/.test(periodo)) return { ok: false, message: "Trimestre inválido." };
  if (!objetivo) return { ok: false, message: "Escreva o objetivo do trimestre." };
  // Trimestre novo começa com as metas zeradas, mantendo os títulos para a equipe ajustar.
  return edit(slug, (p) => ({ ...p, metas: { periodo, objetivo, krs: p.metas?.periodo === periodo ? p.metas.krs : (p.metas?.krs ?? []).map((k) => ({ ...k, atual: 0 })) } }));
}

function krFields(fd: FormData): { titulo: string; alvo: number; atual: number; fonte: MetaFonte } | string {
  const titulo = str(fd, "titulo"), fonte = str(fd, "fonte") as MetaFonte;
  const alvo = Number(str(fd, "alvo").replace(",", ".")), atual = Number((str(fd, "atual") || "0").replace(",", "."));
  if (!titulo) return "Dê um nome para a meta.";
  if (!META_FONTES.some((f) => f.key === fonte)) return "Escolha de onde vem o número.";
  if (!Number.isFinite(alvo) || alvo <= 0) return "O alvo precisa ser maior que zero.";
  if (!Number.isFinite(atual) || atual < 0) return "Valor atual inválido.";
  return { titulo, alvo, atual, fonte };
}

export async function addKrAction(slug: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const f = krFields(fd);
  if (typeof f === "string") return { ok: false, message: f };
  return edit(slug, (p) => {
    if (!p.metas) return "Defina o objetivo do trimestre primeiro.";
    if (p.metas.krs.length >= 5) return "No máximo 5 metas por trimestre.";
    return { ...p, metas: { ...p.metas, krs: [...p.metas.krs, { id: newId(), ...f }] } };
  });
}

export async function updateKrAction(slug: string, id: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const f = krFields(fd);
  if (typeof f === "string") return { ok: false, message: f };
  return edit(slug, (p) => (p.metas ? { ...p, metas: { ...p.metas, krs: p.metas.krs.map((k) => (k.id === id ? { ...k, ...f } : k)) } } : "Sem metas."));
}

export async function deleteKrAction(slug: string, id: string, _prev: ActionResult | null): Promise<ActionResult> {
  return edit(slug, (p) => (p.metas ? { ...p, metas: { ...p.metas, krs: p.metas.krs.filter((k) => k.id !== id) } } : "Sem metas."));
}

// ─── Contrato ─────────────────────────────────────────────────────────

export async function saveContratoAction(slug: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const inicio = str(fd, "inicio"), renovacao = str(fd, "renovacao"), url = str(fd, "url"), regra = str(fd, "regra") as RegraRenovacao;
  const meses = Number(str(fd, "meses") || "0");
  if (url && !/^https?:\/\//i.test(url)) return { ok: false, message: "O link do contrato precisa começar com https://" };
  if (!["iguais", "mensal", "nova"].includes(regra)) return { ok: false, message: "Escolha como o contrato renova." };
  if (!Number.isInteger(meses) || meses < 0 || meses > 60) return { ok: false, message: "Prazo em meses, de 1 a 60." };
  return edit(slug, (p) => ({ ...p, contrato: { inicio: inicio || undefined, meses: meses || undefined, regra, url: url || undefined, renovacao: renovacao || undefined } }));
}

// ─── Termômetro (NPS) ─────────────────────────────────────────────────

export async function responderNpsAction(slug: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await requireAuth(slug);
  if (s.role !== "cliente") return { ok: false, message: "Só o cliente responde. Esta é a prévia do que ele vê." };
  const score = Number(str(fd, "score"));
  if (!Number.isInteger(score) || score < 0 || score > 10) return { ok: false, message: "Escolha uma nota de 0 a 10." };
  const comentario = str(fd, "comentario").slice(0, 1000) || undefined;
  await addNps(slug, { score, comentario, por: s.name });
  const c = await getClient(slug).catch(() => undefined);
  await sendAlert(`*Termômetro · ${c?.name ?? slug}*\nNota ${score} (${GRUPO_LABEL[grupo(score)]})${comentario ? `\n"${comentario}"` : ""}\n${publicBase()}/admin/avisos`).catch(() => undefined);
  revalidatePath(path(slug), "layout");
  return { ok: true, message: "Obrigado! A sua resposta chegou para a equipe." };
}

export async function adiarNpsAction(slug: string, _prev: ActionResult | null): Promise<ActionResult> {
  const s = await requireAuth(slug);
  if (s.role === "cliente") await adiarNps(slug);
  revalidatePath(path(slug), "layout");
  return { ok: true, message: "Tudo bem, perguntamos outro dia." };
}
