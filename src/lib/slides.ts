/**
 * Texto dos slides de um carrossel (capa, slides e convite final), como veio do documento importado ou do
 * Estúdio. O desenho é do Canva: aqui fica só o texto, que o Estúdio encaixa no modelo do cliente.
 */
export interface SlideTexto {
  tipo: "capa" | "slide" | "final";
  titulo: string;
  /** Linhas de apoio, separadas por linha em branco. */
  texto: string;
  /** Indicação da foto (ex.: "Fernando em plano médio, escritório ao fundo"). */
  foto?: string;
}

export const MAX_SLIDES = 10;

/** Slides válidos: textos limpos e com tamanho máximo, capa primeiro e final por último, até 10. */
export function slidesLimpos(v: unknown): SlideTexto[] {
  const lista = Array.isArray(v) ? v.slice(0, MAX_SLIDES) : [];
  const txt = (x: unknown, n: number) => String(x ?? "").replace(/\r/g, "").trim().slice(0, n);
  const out: SlideTexto[] = lista.map((s, i) => {
    const o = (s ?? {}) as Partial<SlideTexto>;
    const tipo = i === 0 ? "capa" : i === lista.length - 1 && lista.length > 1 ? "final" : o.tipo === "capa" || o.tipo === "final" ? "slide" : "slide";
    const foto = txt(o.foto, 240);
    return { tipo, titulo: txt(o.titulo, 400), texto: txt(o.texto, 1500), ...(foto ? { foto } : {}) };
  });
  return out.filter((s) => s.titulo || s.texto);
}
