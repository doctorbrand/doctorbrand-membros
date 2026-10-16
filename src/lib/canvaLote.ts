import type { CanvaModelo } from "./brand";

/**
 * Lote de carrosséis para o "Criar em massa" do Canva: a planilha (CSV, uma linha por carrossel, uma coluna
 * por campo de texto do modelo) e, na volta, a leitura do ZIP baixado do Canva (um design por carrossel).
 * Puro: vale no navegador e no servidor.
 */

export interface Lote {
  id: string;
  at: string;
  by: string;
  modeloId: string;
  modeloTitulo: string;
  /** Posts na ordem das linhas da planilha (é a ordem em que o Canva cria os designs). */
  postIds: string[];
}

const celula = (v: string) => {
  const t = String(v ?? "").replace(/\r?\n+/g, " ").trim();
  return /[",;\n]/.test(t) || /^\s|\s$/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/** CSV para o Criar em massa: primeira coluna "post" (só para conferir; não precisa ligar no Canva). */
export function planilhaCsv(modelo: CanvaModelo, linhas: { titulo: string; campos: Record<string, string> }[]): string {
  const cols = modelo.campos.filter((c) => c.tipo === "text").map((c) => c.nome);
  const head = ["post", ...cols].map(celula).join(",");
  const body = linhas.map((l, i) => [`${String(i + 1).padStart(2, "0")} ${l.titulo}`, ...cols.map((c) => l.campos[c] ?? "")].map(celula).join(","));
  return [head, ...body].join("\r\n") + "\r\n";
}

export const IMG = /\.(png|jpe?g)$/i;
const natural = (a: string, b: string) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });
const ignorar = (n: string) => /(^|\/)(__MACOSX|\.)/.test(n);

export interface DesignZip { nome: string; arquivos: string[] }

/**
 * Agrupa os arquivos de imagem do ZIP em designs (um por carrossel), cada um com as lâminas em ordem.
 * - Pastas: cada pasta com imagens é um design (é como o Canva baixa vários designs de uma vez).
 * - Arquivos soltos na raiz: "Nome-1.png", "Nome-2.png" viram o design "Nome"; só números ("1.png") viram um design só.
 */
export function agruparDesigns(nomes: string[]): DesignZip[] {
  const imgs = nomes.filter((n) => IMG.test(n) && !ignorar(n));
  const grupos = new Map<string, string[]>();
  for (const n of imgs) {
    const partes = n.split("/").filter(Boolean);
    let chave: string;
    if (partes.length > 1) chave = partes.slice(0, -1).join("/");
    else {
      const stem = partes[0].replace(IMG, "");
      if (/^\d+$/.test(stem)) chave = "";
      else chave = stem.replace(/[\s_-]*\(?\d+\)?$/, "").trim() || stem;
    }
    grupos.set(chave, [...(grupos.get(chave) ?? []), n]);
  }
  return [...grupos.entries()]
    .map(([chave, arquivos]) => ({ nome: chave.split("/").pop() || "Design", chave, arquivos: arquivos.sort(natural) }))
    .sort((a, b) => natural(a.chave, b.chave))
    .map(({ nome, arquivos }) => ({ nome, arquivos }));
}
