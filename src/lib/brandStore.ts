import { put } from "@vercel/blob";
import { localDir, readDoc, writeDoc } from "./store";
import { ASSINATURA_CREME, ASSINATURA_ESCURA } from "./seeds/doctorbrandLogos";
import { MAX_TEMPLATES, type BrandColor, type BrandKit, type CarouselTemplate } from "./brand";

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

// ─── Design system DoctorBrand no kit do Fernando ─────────────────────────
// Como pede o guia "Kit de marca na área de membros" do design system DoctorBrand e a skill
// carrossel-fernandofontees: logos, cores com papel, regras e os 5 modelos fixos. Aplica uma vez cada
// passo, sem passar por cima do que a equipe já mudou à mão.

const DS_KEY = "fernando-fontes:design-system-doctorbrand";
const FIXOS_KEY = "fernando-fontes:carrossel-5-modelos";
const DS_COLORS: BrandColor[] = [
  { name: "Brown deep", hex: "#0c0a08", role: "fundo" },
  { name: "Cream", hex: "#d8d3c7", role: "texto" },
  { name: "Gold", hex: "#c9a96e", role: "destaque" },
  { name: "Cream light", hex: "#e6e1d5", role: "apoio" },
  { name: "Gold light", hex: "#e0c98a", role: "apoio" },
  { name: "Brown medium", hex: "#3a3028", role: "apoio" },
];
/** Cores que podem ser trocadas: as do piloto antes do design system. */
const OLD_SEEDS = [["#1a1a1a", "#ffffff", "#d4875e"]];
/** Regras da skill carrossel-fernandofontees (versão dos 5 modelos). */
const DS_RULES = [
  "Fundo sempre brown-deep #0c0a08, nunca cinza neutro nem preto puro.",
  "Fontes: Denton (serifa), Aktiv Grotesk (grotesca) e Sloop (script, só onde o modelo pede). Nunca fonte do sistema.",
  "Um modelo por carrossel, do início ao fim: Autoridade, Editorial, Manchete, Consultoria ou Bastidor. Sem foto, Autoridade.",
  "Um destaque dourado por lâmina, no máximo.",
  "Texto de apoio nunca abaixo de 60% de opacidade.",
  "Lâmina clara: fundo cream-light #e6e1d5, texto brown-deep e brown-medium.",
  "Uma ideia por lâmina. Se precisar de \"e também\", são duas.",
  "CTA com keyword para comentar (no Consultoria pode levar ao diagnóstico). Nunca \"me segue\".",
  "Fotos autorais: rosto na metade de cima, texto na de baixo. Sem foto de banco.",
  "Sem emoji, sem ícone decorativo, sem sombra. O único degradê é o véu escuro sobre a foto.",
  "Nada de número inventado: dado só com fonte confirmada.",
];
/** Regras da primeira versão do design system (3 modelos de caixa), trocadas pelas de cima. */
const OLD_DS_RULES = [
  "Fundo sempre brown-deep #0c0a08, nunca cinza neutro nem preto puro.",
  "Títulos em Denton 400; texto em Inter. Nunca fonte do sistema.",
  "Uma palavra em dourado por carrossel, quase sempre na capa.",
  "Ênfase no título: a frase continua em itálico, creme a 60%.",
  "Texto de apoio nunca abaixo de 60% de opacidade.",
  "Moldura fixa: DOCTORBRAND no topo, @fernandofontees e contador embaixo.",
  "Uma ideia por slide. Capa até 10 palavras; título de slide até 8; texto até 40.",
  "Só a lâmina de citação é clara (fundo #e6e1d5).",
  "CTA sempre com keyword para comentar; nunca \"link na bio\".",
  "Sem foto de banco, sem emoji, sem gradiente, sem sombra.",
];
/** Regras de conteúdo do piloto que continuam valendo junto das visuais. */
const KEEP_RULES = ["Cases sempre anonimizados; números de marketing, nunca de paciente.", "Sem garantia de resultado e sem preço de procedimento.", "Fala do negócio do médico, não de medicina."];

async function saveSvg(path: string, svg: string) {
  const dir = localDir();
  if (dir) {
    const fs = await import("fs/promises");
    await fs.mkdir(`${dir}/${path.slice(0, path.lastIndexOf("/"))}`, { recursive: true });
    await fs.writeFile(`${dir}/${path}`, svg);
  } else {
    await put(path, svg, { access: "private", contentType: "image/svg+xml", allowOverwrite: true, addRandomSuffix: false });
  }
}

const lines = (r?: string) => (r ?? "").split("\n").map((x) => x.trim()).filter(Boolean);

/** Aplica o design system DoctorBrand no kit do Fernando (cada passo uma vez). Devolve o que mudou. */
export async function runBrandUpgrades(slug: string): Promise<string[]> {
  if (slug !== "fernando-fontes") return [];
  const done = await readDoc<Record<string, string>>("marca-upgrades", {});
  if (done[DS_KEY] && done[FIXOS_KEY]) return [];
  const k = await getBrand(slug);
  const patch: Partial<BrandKit> = {};
  const feito: string[] = [];
  const now = new Date().toISOString();

  if (!done[DS_KEY]) {
    const hexes = [...k.colors.map((c) => c.hex)].sort().join();
    if (!k.colors.length || OLD_SEEDS.some((o) => [...o].sort().join() === hexes)) { patch.colors = DS_COLORS; feito.push("cores"); }
    if (!k.logos.principal && !k.logos.claro && !k.logos.escuro) {
      const base = `content-media/${slug}/brand`;
      const escura = `${base}/claro-assinatura-doctorbrand.svg`, creme = `${base}/escuro-assinatura-doctorbrand-creme.svg`;
      await saveSvg(escura, ASSINATURA_ESCURA);
      await saveSvg(creme, ASSINATURA_CREME);
      patch.logos = { principal: { path: creme, name: "assinatura-creme.svg" }, claro: { path: escura, name: "assinatura.svg" }, escuro: { path: creme, name: "assinatura-creme.svg" } };
      feito.push("logos");
    }
  }

  if (!done[FIXOS_KEY]) {
    patch.modelosFixos = "doctorbrand";
    patch.handle = k.handle || "@fernandofontees";
    feito.push("5 modelos fixos");
    // Regras: as do piloto (ou as da primeira versão do design system) viram as da skill; as escritas à mão ficam.
    const rules = lines(k.rules);
    const auto = new Set(["Nunca usar emoji.", ...KEEP_RULES, ...OLD_DS_RULES]);
    const next = rules.every((r) => auto.has(r))
      ? [...DS_RULES, ...KEEP_RULES]
      : [...rules.filter((r) => !OLD_DS_RULES.includes(r)), ...DS_RULES.filter((r) => !rules.includes(r))];
    if (next.join("\n") !== rules.join("\n")) { patch.rules = next.join("\n"); feito.push("regras"); }
  }

  if (Object.keys(patch).length) await saveBrand(slug, patch, "DoctorBrand");
  await writeDoc("marca-upgrades", { ...done, [DS_KEY]: done[DS_KEY] ?? now, [FIXOS_KEY]: now });
  return feito;
}
