import { readDoc, writeDoc } from "./store";
import { SEED_MATERIALS } from "./projectSeed";

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

export type MaterialKind = "identidade" | "guidelines" | "moodboard" | "roteiro" | "stories" | "site" | "links" | "documento";

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
  steps: ProjectStep[];
  materials: ProjectMaterial[];
  /** A equipe já mexeu nos materiais (daí em diante os do Drive não entram sozinhos). */
  materialsEdited?: boolean;
  /** Outros nomes do cliente na agenda (ex.: "Dr. Carlos", "Picasso"). */
  calendarAliases?: string[];
  updatedAt?: string;
  updatedBy?: string;
}

export const STEP_LABEL: Record<StepStatus, string> = { nao_iniciada: "A seguir", andamento: "Em andamento", concluida: "Concluída" };

export const MATERIAL_KINDS: { key: MaterialKind; label: string }[] = [
  { key: "identidade", label: "Identidade visual" },
  { key: "guidelines", label: "Guidelines e tom de voz" },
  { key: "moodboard", label: "Moodboard" },
  { key: "roteiro", label: "Roteiros de captação" },
  { key: "stories", label: "Cronograma de stories" },
  { key: "site", label: "Site ou landing page" },
  { key: "links", label: "Página de links" },
  { key: "documento", label: "Documento" },
];

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
};

/** Nomes que a equipe usa na agenda além do nome cadastrado (a abreviação "Nome S." já é automática). */
export const DEFAULT_ALIASES: Record<string, string[]> = {
  glaciale: ["Glaciale"],
  viegas: ["Diego Viégas", "Dr. Viégas", "Viegas"],
  "jose-mauro": ["José Mauro Monteiro", "JM"],
  "flavio-pinheiro": ["Dream Smile"],
  "eric-reis": ["COER"],
  "erica-barros": ["EB Dermatologia"],
};

export function calendarAliases(slug: string, p: Project): string[] {
  return [...new Set([...(DEFAULT_ALIASES[slug] ?? []), ...(p.calendarAliases ?? [])])];
}

export async function getProject(slug: string): Promise<Project> {
  const p = await readDoc<Project | null>(`projeto/${slug}`, null);
  const base = p ?? SEED[slug] ?? { steps: [], materials: [] };
  // Materiais levantados no Drive entram enquanto a equipe não tiver salvo os seus.
  if (!p?.materialsEdited && !base.materials.length && SEED_MATERIALS[slug]) return { ...base, materials: SEED_MATERIALS[slug] };
  return base;
}

export async function saveProject(slug: string, p: Project, by: string): Promise<void> {
  await writeDoc(`projeto/${slug}`, { ...p, updatedAt: new Date().toISOString(), updatedBy: by });
}

export { newId };
