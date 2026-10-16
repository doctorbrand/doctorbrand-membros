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
    if (/^(foto|imagem|image)$/i.test(extra ?? "") || /^(foto|imagem)/.test(nome)) { out.push({ nome, tipo: "image" }); continue; }
    const n = Math.round(Number(extra));
    out.push({ nome, tipo: "text", limite: Number.isFinite(n) && n >= 1 ? Math.min(n, 200) : limitePadrao(nome) });
  }
  return out.slice(0, 60);
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
