import { readDoc, writeDoc } from "./store";

/** Cliente da área de membros: só o que o planejamento de conteúdo precisa. */
export interface Client {
  slug: string;
  name: string;
  specialty: string;
  /** Conta profissional do Instagram (IG user id), ligada pela tela de Conteúdo. */
  igUserId?: string;
  /** Página do Facebook ligada ao Instagram. */
  pageId?: string;
  createdAt?: string;
  /** Tirado da área de membros (os posts ficam guardados). */
  removed?: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

/** Carteira inicial. Clientes novos entram pela tela "Clientes" e ficam salvos no Blob (doc "clients"). */
const SEED: Client[] = [
  { slug: "vivian-ferrari", name: "Vivian Ferrari", specialty: "Cirurgia Plástica" },
  { slug: "viegas", name: "Viégas", specialty: "Cirurgia Plástica (mama)" },
  { slug: "carlos-picasso", name: "Carlos Picasso", specialty: "Cirurgia Plástica" },
  { slug: "flavio-pinheiro", name: "Flávio Pinheiro", specialty: "Odontologia (Dream Smile)" },
  { slug: "eric-reis", name: "Eric Reis", specialty: "Oftalmologia" },
  { slug: "erica-barros", name: "Érica Barros", specialty: "Dermatologia" },
  { slug: "danilo-tacinari", name: "Danilo Tacinari", specialty: "Cirurgia Plástica" },
  { slug: "jose-mauro", name: "José Mauro", specialty: "Cirurgia Plástica" },
  { slug: "glaciale", name: "Glaciale", specialty: "Gelato artesanal" },
];

const DOC = "clients";

async function stored(): Promise<Client[]> {
  return readDoc<Client[]>(DOC, []);
}

/** Todos os clientes: carteira inicial + os cadastrados, com o que foi salvo sobrescrevendo. */
export async function listClients(): Promise<Client[]> {
  const saved = await stored();
  const map = new Map(SEED.map((c) => [c.slug, c]));
  for (const c of saved) map.set(c.slug, { ...map.get(c.slug), ...c });
  return [...map.values()].filter((c) => !c.removed).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function getClient(slug: string): Promise<Client | undefined> {
  return (await listClients()).find((c) => c.slug === slug);
}

export async function updateClient(slug: string, patch: Partial<Client>, by: string): Promise<void> {
  const saved = await stored();
  const i = saved.findIndex((c) => c.slug === slug);
  const base = i >= 0 ? saved[i] : SEED.find((c) => c.slug === slug) ?? { slug, name: slug, specialty: "" };
  const next = { ...base, ...patch, slug, updatedAt: new Date().toISOString(), updatedBy: by };
  if (i >= 0) saved[i] = next; else saved.push(next);
  await writeDoc(DOC, saved);
}

export function slugify(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

export async function addClient(name: string, specialty: string, by: string): Promise<Client> {
  const all = await listClients();
  let slug = slugify(name) || "cliente";
  for (let n = 2; all.some((c) => c.slug === slug); n++) slug = `${slugify(name)}-${n}`;
  const c: Client = { slug, name, specialty, createdAt: new Date().toISOString(), removed: false };
  await updateClient(slug, c, by);
  return c;
}
