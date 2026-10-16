import { readDoc, writeDoc } from "./store";
import type { BrandKit } from "./brand";

/** Leitura e gravação do kit de marca (só no servidor). */

const EMPTY: BrandKit = {};

/** Ponto de partida do piloto, com o que já está definido. O resto a equipe preenche. */
const SEED: Record<string, Partial<BrandKit>> = {
  "fernando-fontes": {
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
  if (saved) return { ...EMPTY, ...saved, canvaModelos: saved.canvaModelos ?? [] };
  return { ...EMPTY, ...(SEED[slug] ?? {}), canvaModelos: [] };
}

export async function saveBrand(slug: string, patch: Partial<BrandKit>, by: string): Promise<BrandKit> {
  const saved = await readDoc<BrandKit | null>(docPath(slug), null);
  const cur = saved ?? (await getBrand(slug));
  const next: BrandKit = { ...cur, ...patch, updatedAt: new Date().toISOString(), updatedBy: by };
  await writeDoc(docPath(slug), next);
  return next;
}
