import { cleanBox, type BrandColor, type BoxKind, type CarouselTemplate, type SlideLayout, type TemplateBox } from "./brand";

/**
 * Modelos levantados dos carrosséis reais do cliente no Canva (posições, tamanhos e cores medidos no arquivo).
 * Aplicados pelo botão "Carregar modelos do Canva" no Kit de marca. Coordenadas em % do slide.
 */

const nid = () => Math.random().toString(36).slice(2, 10);
const b = (kind: BoxKind, x: number, y: number, w: number, h: number, extra: Partial<TemplateBox> = {}): TemplateBox => cleanBox({ id: nid(), kind, x, y, w, h, ...extra })!;

export interface BrandPreset {
  source: string;
  colors: BrandColor[];
  templates: () => CarouselTemplate[];
}

/** Assinatura e rodapé que se repetem nos carrosséis do Fernando. */
const assinatura = () => [
  b("texto", 40.5, 4.5, 19, 2.6, { fixed: "DOCTORBRAND", size: 18, align: "center", color: "texto", font: "texto", maxWords: 1 }),
  b("texto", 38, 87.6, 24, 2.8, { fixed: "@fernandofontees", size: 22, align: "center", color: "texto", font: "texto", maxWords: 1 }),
];
const contador = () => b("texto", 84, 92.8, 11, 2.8, { auto: "contador", size: 24, align: "right", color: "texto", font: "texto", maxWords: 1 });

function editorial(): CarouselTemplate {
  const s = (layout: SlideLayout) => layout;
  return {
    id: nid(), name: "Editorial", base: "editorial",
    slides: {
      capa: s({ bg: { type: "cor", role: "fundo" }, boxes: [...assinatura(), contador(),
        b("titulo", 8.7, 34, 82, 31, { size: 108, color: "texto", font: "titulo", maxWords: 12 }),
        b("texto", 8.7, 67, 60, 8, { size: 37, color: "texto", font: "texto", maxWords: 14 }),
      ] }),
      texto: s({ bg: { type: "cor", role: "fundo" }, boxes: [...assinatura(), contador(),
        b("titulo", 8.7, 27, 82, 18, { size: 100, color: "texto", font: "titulo", maxWords: 8 }),
        b("texto", 8.7, 53, 70, 20, { size: 37, color: "texto", font: "texto", maxWords: 40 }),
      ] }),
      imagem: s({ bg: { type: "cor", role: "fundo" }, boxes: [...assinatura(), contador(),
        b("imagem", 8.7, 11, 82.6, 42),
        b("titulo", 8.7, 56, 82, 12, { size: 76, color: "texto", font: "titulo", maxWords: 8 }),
        b("texto", 8.7, 69, 70, 14, { size: 34, color: "texto", font: "texto", maxWords: 28 }),
      ] }),
      final: s({ bg: { type: "cor", role: "fundo" }, boxes: [...assinatura(), contador(),
        b("titulo", 8.7, 27, 82, 18, { size: 100, color: "destaque", font: "titulo", maxWords: 8 }),
        b("texto", 8.7, 53, 70, 20, { size: 37, color: "texto", font: "texto", maxWords: 40 }),
      ] }),
    },
  };
}

/** "Manifesto": fundo quase preto, frase curta em serifa no terço de baixo; capa com foto inteira. */
function manifesto(): CarouselTemplate {
  const frase = (y = 68) => b("titulo", 14, y, 64, 12, { size: 48, color: "texto", font: "titulo", maxWords: 14 });
  return {
    id: nid(), name: "Manifesto", base: "foto",
    slides: {
      capa: { bg: { type: "cor", role: "apoio" }, boxes: [b("imagem", 0, 0, 100, 100), frase(76)] },
      texto: { bg: { type: "cor", role: "apoio" }, boxes: [frase()] },
      imagem: { bg: { type: "cor", role: "apoio" }, boxes: [b("imagem", 0, 0, 100, 100), frase(76)] },
      final: { bg: { type: "cor", role: "apoio" }, boxes: [frase(60), b("texto", 14, 74, 64, 8, { size: 32, color: "destaque", font: "texto", maxWords: 16 }), b("texto", 38, 90, 24, 2.8, { fixed: "@fernandofontees", size: 22, align: "center", color: "texto", font: "texto", maxWords: 1 })] },
    },
  };
}

/** "Cinematográfico": foto inteira, assinatura no topo, título em serifa centralizado embaixo (padrão das capas de Reels). */
function cinematografico(): CarouselTemplate {
  const titulo = (y = 68) => b("titulo", 12, y, 76, 12, { size: 64, color: "texto", font: "titulo", align: "center", maxWords: 10 });
  return {
    id: nid(), name: "Cinematográfico", base: "foto",
    slides: {
      capa: { bg: { type: "cor", role: "apoio" }, boxes: [b("imagem", 0, 0, 100, 100), ...assinatura(), titulo()] },
      texto: { bg: { type: "cor", role: "fundo" }, boxes: [...assinatura(), contador(), b("titulo", 12, 34, 76, 16, { size: 72, color: "texto", font: "titulo", align: "center", maxWords: 10 }), b("texto", 14, 54, 72, 16, { size: 34, color: "texto", font: "texto", align: "center", maxWords: 35 })] },
      imagem: { bg: { type: "cor", role: "apoio" }, boxes: [b("imagem", 0, 0, 100, 100), ...assinatura(), titulo(72)] },
      final: { bg: { type: "cor", role: "fundo" }, boxes: [...assinatura(), b("titulo", 12, 38, 76, 14, { size: 72, color: "destaque", font: "titulo", align: "center", maxWords: 8 }), b("texto", 14, 54, 72, 12, { size: 34, color: "texto", font: "texto", align: "center", maxWords: 25 })] },
    },
  };
}

export const BRAND_PRESETS: Record<string, BrandPreset> = {
  "fernando-fontes": {
    source: "Canva: “Carrossel Instagram Follow-up DoctorBrand”, “Carrossel” e capas do “GRID - FERNANDO”",
    colors: [
      { name: "Grafite", hex: "#242424", role: "fundo" },
      { name: "Branco", hex: "#ffffff", role: "texto" },
      { name: "Areia", hex: "#bcb59e", role: "destaque" },
      { name: "Preto", hex: "#0b0b0b", role: "apoio" },
    ],
    templates: () => [editorial(), manifesto(), cinematografico()],
  },
};
