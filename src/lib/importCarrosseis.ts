import { MAX_SLIDES, type SlideTexto } from "./slides";

/**
 * Lê um documento de carrosséis já escritos (Markdown) e devolve cada carrossel com o texto de cada slide,
 * sem reescrever nada. O Estúdio de Carrosséis encaixa esse texto no modelo do cliente no Canva. Formato esperado (o mesmo dos documentos de roteiro da equipe):
 *
 *   ## 01 · Título do carrossel
 *   Base: … · Keyword: ERROS · 9 slides
 *   Modelo: Editorial            (opcional: o modelo do Canva, pelo nome no kit de marca)
 *   **Slide 1 (capa):** Frase da capa
 *   - Foto: o que vai na foto
 *   **Slide 2:** Título do slide
 *   - Linha de texto
 *   - Outra linha
 *   **Slide 9 (CTA):** Chamada final
 *   - Comenta “ERROS” e eu te mando a lista.
 *   **Legenda:**
 *   Parágrafos da legenda…
 *
 * Puro: vale no navegador (prévia) e no servidor (importação).
 */

export interface CarrosselDoc {
  titulo: string;
  keyword?: string;
  /** Nome do modelo do Canva indicado no documento (linha "Modelo: ..."). */
  modelo?: string;
  slides: SlideTexto[];
  legenda: string;
  /** O trecho original do documento (vira o roteiro do post). */
  roteiro: string;
  avisos: string[];
}

const limpa = (s: string) => s.replace(/\s+/g, " ").trim();
/** Tira negrito/itálico de Markdown que veio do documento (a ênfase das lâminas é escolhida no editor). */
const semMd = (s: string) => s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/(^|\s)_([^_]+)_(?=\s|$)/g, "$1$2");

export function lerCarrosseis(texto: string): CarrosselDoc[] {
  const blocos = texto.replace(/\r\n?/g, "\n").split(/^##\s+/m).slice(1);
  const out: CarrosselDoc[] = [];
  for (const bloco of blocos) {
    const linhas = bloco.split("\n");
    const titulo = limpa(linhas[0].replace(/^\d{1,3}\s*[·.\-–—)]\s*/, "")).slice(0, 120);
    if (!titulo) continue;
    const keyword = bloco.match(/Keyword:\s*([^\s·|]+)/i)?.[1];
    // "Modelo: Editorial" numa linha antes do primeiro slide (sozinha ou junto de Base/Keyword, separada por ·).
    const cabecalho = bloco.split(/^\*\*\s*(?:Slide|Lâmina|Lamina)/im)[0];
    const modelo = cabecalho.match(/(?:^|[·|]\s*|\n\s*)Modelo\s*:\s*([^·|\n*]+)/i)?.[1]?.trim().slice(0, 40);
    const slides: { cab: string; tipo: SlideTexto["tipo"] | "auto"; linhas: string[]; foto?: string }[] = [];
    const legenda: string[] = [];
    let naLegenda = false;
    for (const bruta of linhas.slice(1)) {
      const l = bruta.trim();
      const s = l.match(/^\*\*\s*(?:Slide|Lâmina|Lamina)\s*\d+\s*(?:\(([^)]*)\))?\s*:?\s*\*\*\s*:?\s*(.*)$/i);
      if (s) {
        naLegenda = false;
        const marca = (s[1] ?? "").toLowerCase();
        slides.push({ cab: limpa(semMd(s[2])), tipo: /capa/.test(marca) ? "capa" : /cta|final|fecho/.test(marca) ? "final" : "auto", linhas: [] });
        continue;
      }
      if (/^\*\*\s*Legenda\s*:?\s*\*\*/i.test(l)) { naLegenda = true; const resto = l.replace(/^\*\*\s*Legenda\s*:?\s*\*\*\s*:?/i, "").trim(); if (resto) legenda.push(resto); continue; }
      if (naLegenda) { legenda.push(bruta.trimEnd()); continue; }
      const atual = slides[slides.length - 1];
      if (!atual || !l) continue;
      const item = l.replace(/^[-*•]\s+/, "");
      const foto = item.match(/^Foto\s*:\s*(.+)$/i);
      if (foto) atual.foto = limpa(foto[1]).slice(0, 200);
      else if (/^[-*•]\s+/.test(l) || !atual.linhas.length) atual.linhas.push(limpa(semMd(item)));
      else atual.linhas[atual.linhas.length - 1] += ` ${limpa(semMd(item))}`;
    }
    if (!slides.length) continue;
    const avisos: string[] = [];
    let lams: SlideTexto[] = slides.map((x, i) => {
      const tipo: SlideTexto["tipo"] = x.tipo !== "auto" ? x.tipo : i === 0 ? "capa" : i === slides.length - 1 ? "final" : "slide";
      return { tipo, titulo: x.cab, texto: x.linhas.join("\n\n"), ...(x.foto ? { foto: x.foto } : {}) };
    });
    if (lams[0].tipo !== "capa") lams[0] = { ...lams[0], tipo: "capa" };
    if (lams.length > 1 && lams[lams.length - 1].tipo !== "final") lams[lams.length - 1] = { ...lams[lams.length - 1], tipo: "final" };
    if (lams.length > MAX_SLIDES) {
      avisos.push(`tinha ${lams.length} slides; entraram os ${MAX_SLIDES - 1} primeiros e o final`);
      lams = [...lams.slice(0, MAX_SLIDES - 1), lams[lams.length - 1]];
    }
    out.push({
      titulo,
      ...(keyword ? { keyword } : {}),
      ...(modelo ? { modelo } : {}),
      slides: lams,
      legenda: legenda.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 2200),
      roteiro: `## ${bloco.trim()}`.slice(0, 12000),
      avisos,
    });
  }
  return out.slice(0, 60);
}
