import { readDoc, writeDoc } from "./store";
import { MAX_TEMPLATES, type BrandKit, type CarouselTemplate } from "./brand";

/** Leitura e gravação do kit de marca (só no servidor). */

const EMPTY: BrandKit = { logos: {}, colors: [], fonts: {} };

/** Ponto de partida do piloto, com o que já está definido. O resto a equipe preenche. */
const SEED: Record<string, Partial<BrandKit>> = {
  "fernando-fontes": {
    colors: [
      { name: "Grafite", hex: "#1a1a1a", role: "fundo" },
      { name: "Branco", hex: "#ffffff", role: "texto" },
      { name: "Cobre", hex: "#d4875e", role: "destaque" },
    ],
    rules: [
      "Nunca usar emoji.",
      "Cases sempre anonimizados; números de marketing, nunca de paciente.",
      "Sem garantia de resultado e sem preço de procedimento.",
      "Fala do negócio do médico, não de medicina.",
    ].join("\n"),
  },
};

const docPath = (slug: string) => `marca/${slug}`;

export async function getBrand(slug: string): Promise<BrandKit> {
  const saved = await readDoc<BrandKit | null>(docPath(slug), null);
  if (saved) return { ...EMPTY, ...saved, logos: saved.logos ?? {}, colors: saved.colors ?? [], fonts: saved.fonts ?? {}, templates: saved.templates ?? [] };
  return { ...EMPTY, ...(SEED[slug] ?? {}) };
}

export async function saveBrand(slug: string, patch: Partial<BrandKit>, by: string): Promise<BrandKit> {
  const cur = await getBrand(slug);
  const next: BrandKit = { ...cur, ...patch, updatedAt: new Date().toISOString(), updatedBy: by };
  await writeDoc(docPath(slug), next);
  return next;
}

/** Grava os modelos de carrossel do cliente (no máximo MAX_TEMPLATES), junto do kit. */
export async function saveTemplates(slug: string, templates: CarouselTemplate[], by: string): Promise<BrandKit> {
  if (templates.length > MAX_TEMPLATES) throw new Error(`No máximo ${MAX_TEMPLATES} modelos por cliente.`);
  return saveBrand(slug, { templates }, by);
}
