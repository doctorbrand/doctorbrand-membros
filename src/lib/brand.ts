/**
 * Kit de marca do cliente na área de membros. O visual (logos, cores, fontes e o desenho dos carrosséis)
 * mora no Canva. Aqui fica só o que a área usa para produzir: os modelos do Canva deste cliente com as
 * colunas da planilha do "Criar em massa" (e o limite de palavras de cada uma), as regras de texto que o
 * Claude lê antes de escrever e a pasta de fotos do Drive.
 * Guardado no Blob em `marca/<slug>` (leitura e escrita em brandStore.ts). Este arquivo vale também no navegador.
 */

/** Uma coluna da planilha do "Criar em massa": no Canva, cada coluna é ligada a uma caixa de texto ou foto. */
export interface CanvaCampo {
  nome: string;
  tipo: "text" | "image";
  /** Texto: máximo de palavras que cabe na caixa (o Canva não encolhe a letra). */
  limite?: number;
}

/** Um modelo do Canva usado por este cliente. */
export interface CanvaModelo {
  id: string;
  titulo: string;
  /** Link do modelo no Canva, para abrir direto. */
  link?: string;
  campos: CanvaCampo[];
  addedAt?: string;
}

/** Nome de coluna limpo: minúsculas, sem acento, só letras, números e _. */
export const nomeCampo = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);

/** "capa_titulo 10" ou "foto_capa foto", uma por linha. */
export function lerCampos(texto: string): CanvaCampo[] {
  const out: CanvaCampo[] = [];
  for (const linha of texto.split(/\r?\n/)) {
    // O último pedaço é o limite (número) ou "foto"; o resto é o nome da coluna.
    const m = linha.trim().match(/^(.*?)(?:\s+(\d+|foto|imagem|image))?$/i);
    const [bruto, extra] = [m?.[1] ?? "", m?.[2]];
    const nome = nomeCampo(bruto);
    if (!nome || out.some((c) => c.nome === nome)) continue;
    if (/^(foto|imagem|image)$/i.test(extra ?? "") || /^(foto|imagem)(_|\d|$)/.test(nome)) { out.push({ nome, tipo: "image" }); continue; }
    const n = Math.round(Number(extra));
    out.push({ nome, tipo: "text", limite: Number.isFinite(n) && n >= 1 ? Math.min(n, 200) : limitePadrao(nome) });
  }
  return out.slice(0, 60);
}

const SECAO: Record<string, string> = {
  capa: "Capa", cta: "Final", argumento: "Argumento", numero: "Número", citacao: "Citação", resumo: "Resumo",
  zigue: "Zigue-zague", frase: "Frase", comparacao: "Comparação", texto: "Texto", secao: "Seção", etapas: "Etapas",
  fototexto: "Foto e texto", telas: "Telas",
};
const PAPEL: Record<string, string> = {
  titulo: "título", texto: "texto", keyword: "palavra para comentar", kicker: "chamada pequena", eyebrow: "chamada pequena",
  italico: "trecho em itálico", script: "assinatura escrita à mão", rotulo: "rótulo", rotulo2: "segundo rótulo", numero: "número",
  assinatura: "assinatura", antes: "texto antes do número", fecho: "fecho", frase: "frase",
};
const comNumero = (s: string, dic: Record<string, string>) => {
  if (dic[s]) return dic[s];
  const m = s.match(/^([a-z]+?)(\d+)$/);
  if (m) {
    const nomes: Record<string, string> = { l: "Lâmina", lamina: "Lâmina", item: "item", bloco: "bloco", card: "Card", etapa: "Etapa", status: "status" };
    return `${nomes[m[1]] ?? m[1]} ${m[2]}`;
  }
  return s;
};
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Nome de coluna em português legível: "capa_titulo" vira { secao: "Capa", papel: "título" }. */
export function rotuloCampo(nome: string): { secao: string; papel: string } {
  const partes = nome.split("_").filter(Boolean);
  if (partes[0] === "foto" || partes[0] === "imagem") return { secao: maiuscula(comNumero(partes.slice(1).join(" ") || "foto", SECAO)), papel: "foto" };
  if (partes.length < 2) return { secao: maiuscula(comNumero(partes[0] ?? nome, SECAO)), papel: "texto" };
  const papel = partes.slice(1).map((p) => comNumero(p, PAPEL)).join(" ");
  return { secao: maiuscula(comNumero(partes[0], SECAO)), papel };
}

/** Colunas de texto agrupadas por parte do carrossel, na ordem do modelo. */
export function secoesTexto(cs: CanvaCampo[]): { secao: string; campos: (CanvaCampo & { papel: string })[] }[] {
  const out: { secao: string; campos: (CanvaCampo & { papel: string })[] }[] = [];
  for (const c of cs) {
    if (c.tipo !== "text") continue;
    const r = rotuloCampo(c.nome);
    const g = out.find((x) => x.secao === r.secao) ?? (out.push({ secao: r.secao, campos: [] }), out[out.length - 1]);
    g.campos.push({ ...c, papel: r.papel });
  }
  return out;
}

export const camposTexto = (cs: CanvaCampo[]) => cs.map((c) => (c.tipo === "image" ? `${c.nome} foto` : `${c.nome} ${c.limite ?? ""}`.trim())).join("\n");

export interface BrandKit {
  /** Link da pasta de fotos no Google Drive (compartilhada por link). As fotos vão para as colunas de foto no Canva. */
  driveFolder?: string;
  /** Regras de texto e de marca, uma por linha. O Claude lê antes de escrever. */
  rules?: string;
  /** Modelos do Canva deste cliente. */
  canvaModelos?: CanvaModelo[];
  updatedAt?: string;
  updatedBy?: string;
}

export const MAX_MODELOS = 8;

/** Quanto do kit está pronto, por item. Usado no topo da página. */
export function brandChecklist(k: BrandKit): { label: string; done: boolean }[] {
  return [
    { label: "Modelo do Canva", done: (k.canvaModelos ?? []).some((m) => m.campos.length > 0) },
    { label: "Regras de texto", done: !!k.rules?.trim() },
    { label: "Pasta de fotos", done: !!k.driveFolder },
  ];
}

/** Limite padrão de palavras pelo nome do campo (a equipe ajusta na tela). */
export function limitePadrao(nome: string): number {
  const n = nome.toLowerCase();
  if (/numero|número|contador|kicker|eyebrow|rotulo|rótulo|keyword|palavra/.test(n)) return 3;
  if (/titulo|título|chamada|frase|script|italico|itálico/.test(n)) return 10;
  if (/item|card|etapa/.test(n)) return 12;
  return 40;
}

/** Tipo de conteúdo pelo nome do arquivo (para servir arquivos antigos do kit, como logos e fontes). */
export function brandMime(path: string): string | undefined {
  const ext = path.split(".").pop()?.toLowerCase();
  return ({ png: "image/png", svg: "image/svg+xml", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", ttf: "font/ttf", otf: "font/otf", woff2: "font/woff2", woff: "font/woff" } as Record<string, string>)[ext ?? ""];
}
