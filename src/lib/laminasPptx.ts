import PptxGenJS from "pptxgenjs";
import type { Media } from "./content";
import { desenhar, H, W, type Estilo, type Lamina } from "./laminas";

/**
 * Arquivo .pptx de um carrossel, para arrastar no Canva: cada lâmina vira uma página editável, com textos
 * em caixas de texto, fotos já recortadas e as fontes pelo nome do Brand Kit. 1 px = 1/96 pol (como o Canva lê).
 */

const pol = (px: number) => px / 96;
const pt = (px: number) => Math.round(px * 0.75 * 10) / 10;
const hex = (c: string) => c.replace("#", "").toUpperCase();

/** Carrega a foto já no tamanho e recorte da área (JPEG em base64, sem o prefixo "data:"). */
export type CarregarFoto = (m: Media, w: number, h: number, pb: boolean, cantos?: { raio: number; fundo: string }) => Promise<string | null>;

export async function gerarPptx(itens: Lamina[], estilo: Estilo, titulo: string, carregar: CarregarFoto): Promise<Buffer> {
  const p = new PptxGenJS();
  p.defineLayout({ name: "IG45", width: pol(W), height: pol(H) });
  p.layout = "IG45";
  p.title = titulo;
  p.author = "DoctorBrand";
  for (let i = 0; i < itens.length; i++) {
    const s = p.addSlide();
    s.background = { color: hex(estilo.cores.fundo) };
    for (const e of desenhar(itens, i, estilo)) {
      const box = { x: pol(e.x), y: pol(e.y), w: pol(e.w), h: pol(e.h) };
      if (e.k === "rect") {
        if (e.x === 0 && e.y === 0 && e.w === W && e.h === H && !e.alfa && !e.borda) continue; // já é o fundo da página
        s.addShape(e.elipse ? p.ShapeType.ellipse : p.ShapeType.rect, {
          ...box,
          fill: e.borda ? { type: "none" } : { color: hex(e.cor), transparency: e.alfa !== undefined ? Math.round((1 - e.alfa) * 100) : 0 },
          line: e.borda ? { color: hex(e.borda), width: 1.25 } : { type: "none" },
        });
      } else if (e.k === "vaga") {
        // Lugar da foto: um retângulo com a indicação do roteiro. No Canva, troca pela foto.
        s.addShape(e.raio ? p.ShapeType.roundRect : p.ShapeType.rect, { ...box, fill: { color: hex(e.cor) }, line: { type: "none" }, ...(e.raio ? { rectRadius: pol(e.raio) } : {}) });
        s.addText([{ text: "FOTO", options: { fontSize: pt(18), charSpacing: pt(4), bold: true, breakLine: true } }, { text: e.nota, options: { fontSize: pt(22) } }], {
          ...box, fontFace: e.fonte, color: hex(e.corTexto), align: "center", valign: "middle", margin: pol(40) * 72, isTextBox: true, fit: "none", wrap: true,
        });
      } else if (e.k === "foto") {
        const data = await carregar(e.foto, e.w, e.h, !!e.pb, e.raio && e.fundo ? { raio: e.raio, fundo: e.fundo } : undefined);
        if (data) s.addImage({ data: `image/jpeg;base64,${data}`, ...box });
      } else {
        // Cada quebra de linha fecha o parágrafo no próprio pedaço (senão o pedaço seguinte, em negrito ou itálico, pula de linha).
        const runs = e.trechos.flatMap((t) => t.t.split("\n").map((parte, k, todas) => ({
          text: parte, options: { italic: !!(t.italico || e.italico), bold: !!(t.negrito || e.negrito), ...(k < todas.length - 1 ? { breakLine: true } : {}) },
        })));
        s.addText(runs, {
          ...box,
          fontFace: e.fonte,
          fontSize: pt(e.tam),
          color: hex(e.cor),
          italic: !!e.italico,
          bold: !!e.negrito,
          align: e.alinhar,
          valign: "top",
          margin: 0,
          lineSpacing: pt(e.tam * e.entrelinha),
          charSpacing: e.espaco ? pt(e.espaco) : undefined,
          paraSpaceBefore: 0,
          paraSpaceAfter: 0,
          isTextBox: true,
          fit: "none",
          wrap: true,
        });
      }
    }
  }
  const out = (await p.write({ outputType: "nodebuffer" })) as Buffer;
  return out;
}
