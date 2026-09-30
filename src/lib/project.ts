import { readDoc, writeDoc } from "./store";
import { SEED_MATERIALS } from "./projectSeed";
import { seedKey } from "./seedKey";

/**
 * Projeto do cliente: o essencial do antigo painel no Notion, sem excesso.
 * Etapas (o que a DoctorBrand está fazendo), materiais (links para o que já foi entregue)
 * e o contato da equipe. Cada cliente tem o seu documento: projeto/<slug>.
 */
export type StepStatus = "nao_iniciada" | "andamento" | "concluida";

export interface ProjectStep {
  id: string;
  title: string;
  status: StepStatus;
  /** Data prevista ou marcada (AAAA-MM-DD), opcional. */
  due?: string;
  /** Nota curta para o cliente (ex.: "precisamos do acesso ao Business Manager"). */
  note?: string;
}

export type MaterialKind = "pasta" | "identidade" | "guidelines" | "moodboard" | "roteiro" | "planejamento" | "stories" | "site" | "links" | "documento";

export interface ProjectMaterial {
  id: string;
  title: string;
  kind: MaterialKind;
  url: string;
}

/** Entrega recorrente contratada (ex.: 1 captação audiovisual por mês), com o registro de cada entrega feita. */
export interface Deliverable {
  id: string;
  title: string;
  /** Quantidade prevista por mês. */
  perMonth: number;
  log: DeliveryEntry[];
}

export interface DeliveryEntry {
  id: string;
  /** Data da entrega (AAAA-MM-DD). */
  date: string;
  note?: string;
  url?: string;
}

export interface Project {
  plano?: string;
  deliverables?: Deliverable[];
  /** WhatsApp da equipe para o cliente (só números, com DDI). */
  whatsapp?: string;
  /** WhatsApp do cliente (ou da secretária), para a equipe mandar os avisos. Só a equipe vê. */
  clienteWhatsapp?: string;
  steps: ProjectStep[];
  materials: ProjectMaterial[];
  /** A equipe já mexeu nos materiais (daí em diante os do Drive não entram sozinhos). */
  materialsEdited?: boolean;
  /** Outros nomes do cliente na agenda (ex.: "Dr. Carlos", "Picasso"). */
  calendarAliases?: string[];
  /** Pasta do cliente no ClickUp (id), quando o nome não bate sozinho. */
  clickupFolder?: string;
  /** Etapa atual no método D.O.M.Í.N.I.O. (0 a 6). */
  metodoEtapa?: number;
  /** Objetivo e metas do trimestre. */
  metas?: Metas;
  updatedAt?: string;
  updatedBy?: string;
}

export type MetaFonte = "manual" | "entregas" | "posts" | "contatos";

export interface MetaKR {
  id: string;
  titulo: string;
  alvo: number;
  /** Valor atual, quando a fonte é manual. */
  atual: number;
  fonte: MetaFonte;
}

export interface Metas {
  /** Trimestre (AAAA-T1 a T4). */
  periodo: string;
  objetivo: string;
  krs: MetaKR[];
}

export const META_FONTES: { key: MetaFonte; label: string }[] = [
  { key: "manual", label: "A equipe atualiza" },
  { key: "entregas", label: "Entregas concluídas" },
  { key: "posts", label: "Posts publicados" },
  { key: "contatos", label: "Contatos pelos anúncios" },
];

export const STEP_LABEL: Record<StepStatus, string> = { nao_iniciada: "A seguir", andamento: "Em andamento", concluida: "Concluída" };

export const MATERIAL_KINDS: { key: MaterialKind; label: string }[] = [
  { key: "pasta", label: "Pasta do projeto" },
  { key: "identidade", label: "Identidade visual" },
  { key: "planejamento", label: "Planejamento" },
  { key: "guidelines", label: "Guidelines e tom de voz" },
  { key: "moodboard", label: "Moodboard" },
  { key: "roteiro", label: "Roteiros de captação" },
  { key: "stories", label: "Cronograma de stories" },
  { key: "site", label: "Site ou landing page" },
  { key: "links", label: "Página de links" },
  { key: "documento", label: "Documento" },
];

/**
 * Materiais em lugares fixos, iguais para todos os clientes: o cliente vê só o mais recente de cada.
 * O que não cabe num lugar (ou ficou antigo) fica no histórico, visível só para a equipe.
 */
export type MaterialSlot = "pasta" | "identidade" | "guia" | "roteiros" | "planejamento" | "site";

export const MATERIAL_SLOTS: { key: MaterialSlot; label: string; kind: MaterialKind; hint: string }[] = [
  { key: "pasta", label: "Pasta do projeto", kind: "pasta", hint: "Tudo o que produzimos, no Drive" },
  { key: "identidade", label: "Identidade visual", kind: "identidade", hint: "Logo, cores e tipografia" },
  { key: "guia", label: "Guia da marca", kind: "guidelines", hint: "Posicionamento e tom de voz" },
  { key: "roteiros", label: "Roteiros vigentes", kind: "roteiro", hint: "Os da próxima captação" },
  { key: "planejamento", label: "Planejamento vigente", kind: "planejamento", hint: "A linha editorial do período" },
  { key: "site", label: "Site e página de links", kind: "site", hint: "Onde o paciente chega" },
];

export function slotOf(m: ProjectMaterial): MaterialSlot | null {
  switch (m.kind) {
    case "pasta": return "pasta";
    case "identidade": return "identidade";
    case "guidelines": case "moodboard": return "guia";
    case "roteiro": return "roteiros";
    case "planejamento": case "stories": return "planejamento";
    case "site": case "links": return "site";
    default: return /^pasta\b/i.test(m.title) ? "pasta" : null;
  }
}

/** O material em destaque de cada lugar (o último adicionado) e o resto, para o histórico. */
export function arrangeMaterials(list: ProjectMaterial[]) {
  // No mesmo lugar, o tipo principal vence o secundário (guia antes de moodboard); no mesmo tipo, o mais recente.
  const rank = (m: ProjectMaterial) => (["moodboard", "stories", "links", "documento"].includes(m.kind) ? 0 : 1);
  const featured = new Map<MaterialSlot, ProjectMaterial>();
  for (const m of list) {
    const s = slotOf(m);
    if (!s) continue;
    const cur = featured.get(s);
    if (!cur || rank(m) >= rank(cur)) featured.set(s, m);
  }
  const shown = new Set([...featured.values()].map((m) => m.id));
  return {
    slots: MATERIAL_SLOTS.filter((s) => featured.has(s.key)).map((s) => ({ ...s, material: featured.get(s.key)! })),
    others: list.filter((m) => !shown.has(m.id)),
  };
}

/** Etapas padrão do projeto DoctorBrand (as mesmas do quadro que existia no Notion). */
export const DEFAULT_STEPS: string[] = [
  "Reunião de onboarding",
  "Solicitação de acessos",
  "Moodboard",
  "Roteiro de captação",
  "Captação audiovisual",
  "Planejamento de conteúdo",
  "Criação de landing page",
  "Página de links",
  "Setup de performance (Google)",
];

/** Entregas recorrentes padrão. A equipe ajusta a quantidade de cada cliente. */
export const DEFAULT_DELIVERABLES: { title: string; perMonth: number }[] = [
  { title: "Captação audiovisual", perMonth: 1 },
  { title: "Planejamento mensal", perMonth: 1 },
];

/** Entregas feitas num mês (AAAA-MM). */
export function deliveredIn(d: Deliverable, month: string): DeliveryEntry[] {
  return d.log.filter((e) => e.date.startsWith(month)).sort((a, b) => a.date.localeCompare(b.date));
}

const newId = () => Math.random().toString(36).slice(2, 10);

export function defaultSteps(): ProjectStep[] {
  return DEFAULT_STEPS.map((title) => ({ id: newId(), title, status: "nao_iniciada" as const }));
}

/** Situação do Carlos Picasso como estava no quadro "Tarefas do projeto" do Notion. */
const SEED: Record<string, Project> = {
  "carlos-picasso": {
    plano: "Growth",
    steps: [
      { id: "p1", title: "Reunião de onboarding", status: "andamento" },
      { id: "p2", title: "Solicitação de acessos", status: "andamento" },
      { id: "p3", title: "Moodboard", status: "andamento" },
      { id: "p4", title: "Roteiro de captação", status: "andamento" },
      { id: "p5", title: "Captação audiovisual", status: "andamento" },
      { id: "p6", title: "Planejamento de conteúdo", status: "nao_iniciada" },
      { id: "p7", title: "Criação de landing page", status: "nao_iniciada" },
      { id: "p8", title: "Página de links", status: "nao_iniciada" },
      { id: "p9", title: "Setup de performance (Google)", status: "nao_iniciada" },
    ],
    materials: [],
  },
  // Cliente desde fev/2025 (Gestão Core). Etapas conforme o Drive: guia de roteiros 25/08 e captação 27/08/2026.
  "brunno-bernardo": {
    plano: "Core",
    metodoEtapa: 4,
    steps: [
      { id: "b1", title: "Reunião de onboarding", status: "concluida" },
      { id: "b2", title: "Solicitação de acessos", status: "concluida" },
      { id: "b3", title: "Identidade visual", status: "concluida" },
      { id: "b4", title: "Sistema editorial", status: "concluida", due: "2026-05-07" },
      { id: "b5", title: "Roteiro de captação", status: "concluida", due: "2026-08-25" },
      { id: "b6", title: "Captação audiovisual", status: "concluida", due: "2026-08-27" },
      { id: "b7", title: "Edição dos vídeos da captação", status: "andamento" },
      { id: "b8", title: "Carrossel com as fotos de bastidor", status: "nao_iniciada", note: "Aguardando as fotos de bastidor." },
      { id: "b9", title: "Planejamento de conteúdo", status: "andamento" },
    ],
    deliverables: [
      { id: "bd1", title: "Captação audiovisual", perMonth: 1, log: [{ id: "bl1", date: "2026-08-27", note: "Captação 27/08" }] },
      { id: "bd2", title: "Planejamento mensal", perMonth: 1, log: [] },
    ],
    materials: [],
  },
  // Marca pessoal do Fernando (@fernandofontees).
  "fernando-fontes": {
    plano: "Marca pessoal",
    metodoEtapa: 4,
    steps: [
      { id: "f1", title: "Dossiê narrativo", status: "concluida", due: "2026-02-21" },
      { id: "f2", title: "Estratégia de conteúdo master", status: "concluida" },
      { id: "f3", title: "Captação audiovisual", status: "concluida", due: "2026-03-25" },
      { id: "f4", title: "Pilares editoriais (Negócio, Bastidor, Pessoal)", status: "concluida", due: "2026-07-23" },
      { id: "f5", title: "Calendário editorial no Notion", status: "andamento" },
      { id: "f6", title: "Planejamento de conteúdo", status: "andamento" },
      { id: "f7", title: "Definir o CTA dos posts", status: "nao_iniciada", note: "Keyword ou link: decidir antes de aumentar o volume." },
    ],
    deliverables: [
      { id: "fd1", title: "Captação audiovisual", perMonth: 1, log: [] },
      { id: "fd2", title: "Planejamento mensal", perMonth: 1, log: [] },
    ],
    materials: [],
  },
};

/** Nomes que a equipe usa na agenda além do nome cadastrado (a abreviação "Nome S." já é automática). */
export const DEFAULT_ALIASES: Record<string, string[]> = {
  glaciale: ["Glaciale"],
  viegas: ["Diego Viégas", "Dr. Viégas", "Viegas"],
  "jose-mauro": ["José Mauro Monteiro", "JM"],
  "flavio-pinheiro": ["Dream Smile"],
  "eric-reis": ["COER"],
  "erica-barros": ["EB Dermatologia"],
  "brunno-bernardo": ["Brunno B.", "Brunno Bernardo", "Dr. Brunno"],
};

export function calendarAliases(slug: string, p: Project): string[] {
  return [...new Set([...(DEFAULT_ALIASES[slug] ?? DEFAULT_ALIASES[seedKey(slug)] ?? []), ...(p.calendarAliases ?? [])])];
}

/** WhatsApp padrão da equipe DoctorBrand, quando o projeto não tem um próprio. */
export const TEAM_WHATSAPP = "5521993280308";

export async function getProject(slug: string): Promise<Project> {
  const p = await loadProject(slug);
  return { ...p, whatsapp: p.whatsapp || TEAM_WHATSAPP };
}

async function loadProject(slug: string): Promise<Project> {
  const p = await readDoc<Project | null>(`projeto/${slug}`, null);
  const key = SEED[slug] || SEED_MATERIALS[slug] ? slug : seedKey(slug);
  const base = p ?? SEED[key] ?? { steps: [], materials: [] };
  // Materiais levantados no Drive entram enquanto a equipe não tiver salvo os seus.
  if (!p?.materialsEdited && !base.materials.length && SEED_MATERIALS[key]) return { ...base, materials: SEED_MATERIALS[key] };
  return base;
}

export async function saveProject(slug: string, p: Project, by: string): Promise<void> {
  await writeDoc(`projeto/${slug}`, { ...p, updatedAt: new Date().toISOString(), updatedBy: by });
}

export { newId };
