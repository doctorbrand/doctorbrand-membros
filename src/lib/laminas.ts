import type { Media } from "./content";

/**
 * Lâminas de um carrossel: capa, slides e tela final. Cada lâmina tem título, subtítulo, descrição e, se
 * quiser, uma foto no fundo ou numa moldura. O estilo (cores, fontes e a base do desenho) vem do kit de marca.
 *
 * O motor `desenhar` devolve os elementos de cada lâmina em 1080 × 1350 (retângulos, textos e fotos).
 * A mesma lista vira a prévia na área de membros e o arquivo .pptx que abre editável no Canva, então as
 * duas saem iguais. Puro: vale no navegador e no servidor.
 */

export type TipoLamina = "capa" | "slide" | "final";
export type ModoFoto = "fundo" | "moldura";
/** Onde fica a foto em moldura: em cima do texto, embaixo ou ao lado (saindo pela borda). */
export type PosFoto = "cima" | "baixo" | "lado";

export interface Lamina {
  tipo: TipoLamina;
  titulo: string;
  subtitulo: string;
  descricao: string;
  foto?: Media;
  modoFoto?: ModoFoto;
  posFoto?: PosFoto;
  /** Indicação da foto que vai nesta lâmina (vinda do roteiro), enquanto a foto não é escolhida. */
  notaFoto?: string;
}

export interface LaminasPost {
  estiloId: string;
  itens: Lamina[];
  at: string;
  by: string;
}

export const MIN_LAMINAS = 3;
export const MAX_LAMINAS = 10;
export const PADRAO_LAMINAS = 6;
/** Palavras que cabem em cada campo sem quebrar o desenho. O Claude escreve dentro disso. */
export const LIMITE = { titulo: 16, subtitulo: 18, descricao: 50 } as const;

export const NOME_TIPO: Record<TipoLamina, string> = { capa: "Capa", slide: "Slide", final: "Tela final" };

export const laminaVazia = (tipo: TipoLamina): Lamina => ({ tipo, titulo: "", subtitulo: "", descricao: "" });

/** Capa, slides e tela final, nesta ordem, entre 3 e 10 lâminas. */
export function ordenar(itens: Lamina[]): Lamina[] {
  const capa = itens.find((l) => l.tipo === "capa") ?? laminaVazia("capa");
  const final = [...itens].reverse().find((l) => l.tipo === "final") ?? laminaVazia("final");
  const slides = itens.filter((l) => l.tipo === "slide").slice(0, MAX_LAMINAS - 2);
  while (slides.length < MIN_LAMINAS - 2) slides.push(laminaVazia("slide"));
  return [capa, ...slides, final];
}

export const novasLaminas = (n = PADRAO_LAMINAS): Lamina[] => ordenar([laminaVazia("capa"), ...Array.from({ length: n - 2 }, () => laminaVazia("slide")), laminaVazia("final")]);

/** Nome da lâmina na tela: "Capa", "Slide 3", "Tela final". */
export function nomeLamina(itens: Lamina[], i: number): string {
  const l = itens[i];
  if (l.tipo !== "slide") return NOME_TIPO[l.tipo];
  return `Slide ${itens.slice(0, i + 1).filter((x) => x.tipo === "slide").length}`;
}

/** Texto sem as marcas de ênfase (*itálico* e **negrito**). */
export const semMarcas = (s: string) => s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/\*/g, "");
export const palavras = (s: string) => { const t = semMarcas(s).trim(); return t ? t.split(/\s+/).length : 0; };

/** Um pedaço de texto com a ênfase dele. "*palavra*" é itálico e "**trecho**" é negrito. */
export interface Trecho { t: string; italico?: boolean; negrito?: boolean }
export function trechos(s: string): Trecho[] {
  const out: Trecho[] = [];
  for (const p of s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/)) {
    if (!p) continue;
    if (/^\*\*[^*]+\*\*$/.test(p)) out.push({ t: p.slice(2, -2), negrito: true });
    else if (/^\*[^*]+\*$/.test(p)) out.push({ t: p.slice(1, -1), italico: true });
    else out.push({ t: p.replace(/\*/g, "") });
  }
  return out;
}

// ─── Estilos ────────────────────────────────────────────────────────────

/**
 * Base do desenho. A base decide onde vão texto e foto; cores e fontes vêm do estilo.
 * - classico: texto à esquerda; foto na moldura em cima, com filete na cor de destaque.
 * - editorial: texto centralizado; foto de ponta a ponta em cima; título em caixa alta.
 * - manchete: foto grande no alto, chamada com ponto, texto à esquerda embaixo.
 * - revista: fundo liso, linha fina com a assinatura no topo, título com trecho em itálico e foto em moldura
 *   de cantos arredondados (em cima, embaixo ou ao lado do texto). Capa com foto de ponta a ponta.
 */
export type Base = "classico" | "editorial" | "manchete" | "revista";
export const BASES: { id: Base; nome: string; desc: string }[] = [
  { id: "classico", nome: "Clássico", desc: "Texto à esquerda, foto em moldura com filete" },
  { id: "editorial", nome: "Editorial", desc: "Texto centralizado, foto de ponta a ponta" },
  { id: "manchete", nome: "Manchete", desc: "Foto grande no alto, texto embaixo" },
  { id: "revista", nome: "Revista", desc: "Fundo liso, linha no topo, foto arredondada em cima, embaixo ou ao lado" },
];

export interface Estilo {
  id: string;
  titulo: string;
  base: Base;
  /** Cores em hexadecimal (#rrggbb). */
  cores: { fundo: string; texto: string; destaque: string; suave: string };
  /** Nomes das fontes exatamente como estão no Canva (Brand Kit). */
  fontes: { titulo: string; texto: string };
  tituloCaixaAlta?: boolean;
  fotoPB?: boolean;
  /** Assinatura no rodapé (ex.: @perfil). */
  rodape?: string;
  /** Sem o número do slide (01, 02…) acima do título. */
  semNumero?: boolean;
  /** Cantos arredondados nas fotos em moldura, em px (0 = retos). */
  raioFoto?: number;
  addedAt?: string;
}

export const MAX_ESTILOS = 8;

const DB = { fundo: "#161210", escuro: "#0c0a08", creme: "#e6e1d5", ouro: "#c9a96e", areia: "#a89e8e", clara: "#e6e1d5", marrom: "#2a2218" };

/** Os estilos do design system DoctorBrand (perfil @fernandofontees). Fontes com o nome que têm no Canva. */
export const ESTILOS_DOCTORBRAND: Estilo[] = [
  { id: "db-autoridade", titulo: "Autoridade", base: "classico", cores: { fundo: DB.fundo, texto: DB.creme, destaque: DB.ouro, suave: DB.areia }, fontes: { titulo: "Denton Test Light", texto: "Aktiv Grotesk Trial" }, rodape: "@fernandofontees" },
  { id: "db-editorial", titulo: "Editorial", base: "editorial", cores: { fundo: DB.escuro, texto: DB.creme, destaque: DB.ouro, suave: DB.areia }, fontes: { titulo: "Denton Test", texto: "Aktiv Grotesk Trial Light" }, tituloCaixaAlta: true, fotoPB: true, rodape: "@fernandofontees" },
  { id: "db-manchete", titulo: "Manchete", base: "manchete", cores: { fundo: DB.escuro, texto: DB.creme, destaque: DB.ouro, suave: DB.areia }, fontes: { titulo: "Denton Test Light", texto: "Aktiv Grotesk Trial" }, rodape: "@fernandofontees" },
  { id: "db-consultoria", titulo: "Consultoria", base: "classico", cores: { fundo: DB.escuro, texto: DB.creme, destaque: DB.ouro, suave: DB.areia }, fontes: { titulo: "Denton Test", texto: "Aktiv Grotesk Trial Light" }, tituloCaixaAlta: true, fotoPB: true, rodape: "@fernandofontees" },
  { id: "db-bastidor", titulo: "Bastidor", base: "manchete", cores: { fundo: DB.clara, texto: DB.marrom, destaque: "#8a6d3b", suave: "#7a705e" }, fontes: { titulo: "Denton Test", texto: "Aktiv Grotesk Trial" }, rodape: "@fernandofontees" },
  { id: "db-revista", titulo: "Revista", base: "revista", cores: { fundo: "#f4f1ea", texto: "#1c1814", destaque: "#1c1814", suave: "#857c70" }, fontes: { titulo: "Denton Test Light", texto: "Aktiv Grotesk Trial" }, rodape: "Fernando Fontes", semNumero: true, raioFoto: 22 },
];

/** Os modelos DoctorBrand são do perfil do Fernando; os outros clientes têm os próprios. */
export const usaEstilosDoctorbrand = (slug: string) => slug === "fernando-fontes";

export const ESTILO_PADRAO: Estilo = { id: "padrao", titulo: "Padrão", base: "classico", cores: { fundo: "#161210", texto: "#f2efe8", destaque: "#c9a96e", suave: "#a89e8e" }, fontes: { titulo: "Playfair Display", texto: "Inter" } };

export const corValida = (s: string) => /^#[0-9a-f]{6}$/i.test(s);

// ─── Motor ──────────────────────────────────────────────────────────────

export const W = 1080;
export const H = 1350;

export type Elemento =
  | { k: "rect"; x: number; y: number; w: number; h: number; cor: string; alfa?: number; borda?: string; raio?: number; elipse?: boolean }
  | { k: "foto"; x: number; y: number; w: number; h: number; foto: Media; pb?: boolean; raio?: number; fundo?: string }
  /** Lugar reservado para a foto que ainda vai ser escolhida, com a indicação do roteiro. */
  | { k: "vaga"; x: number; y: number; w: number; h: number; nota: string; cor: string; corTexto: string; fonte: string; raio?: number }
  | { k: "texto"; x: number; y: number; w: number; h: number; texto: string; trechos: Trecho[]; fonte: string; tam: number; cor: string; italico?: boolean; negrito?: boolean; alinhar: "left" | "center" | "right"; entrelinha: number; espaco?: number; serifa: boolean };

/** Largura média de um caractere, em fração do tamanho da letra (estimativa para quebrar linhas). */
function larguraMedia(serifa: boolean, caixaAlta: boolean) {
  return (serifa ? 0.47 : 0.52) * (caixaAlta ? 1.22 : 1);
}

/** Quantas linhas o texto ocupa numa largura, quebrando por palavra. */
export function linhas(texto: string, tam: number, largura: number, serifa: boolean, caixaAlta = false, espaco = 0): number {
  const cw = tam * larguraMedia(serifa, caixaAlta) + espaco;
  let n = 0;
  for (const par of texto.split(/\n/)) {
    const ps = par.split(/\s+/).filter(Boolean);
    if (!ps.length) { n++; continue; }
    let linha = 0;
    n++;
    for (const p of ps) {
      const w = p.length * cw;
      const sp = linha ? cw : 0;
      if (linha && linha + sp + w > largura) { n++; linha = w; } else linha += sp + w;
    }
  }
  return n;
}

interface Bloco { texto: string; tam: number; min: number; serifa: boolean; cor: string; fonte: string; italico?: boolean; caixa?: boolean; entrelinha: number; espaco?: number; antes: number }
type Caixa = { x: number; y: number; w: number; h: number };
type Texto = Extract<Elemento, { k: "texto" }>;

/** Empilha os blocos numa caixa, reduzindo as letras até caber. Devolve os textos posicionados. */
function empilhar(blocos: Bloco[], caixa: Caixa, ancora: "topo" | "centro" | "baixo", alinhar: "left" | "center"): Texto[] {
  const vivos = blocos.filter((b) => semMarcas(b.texto).trim());
  if (!vivos.length) return [];
  let f = 1;
  const medir = () => vivos.map((b, i) => {
    const tam = Math.max(b.min, Math.round(b.tam * f));
    const esp = (b.espaco ?? 0) * tam;
    const h = linhas(semMarcas(b.texto), tam, caixa.w, b.serifa, b.caixa, esp) * tam * b.entrelinha;
    return { b, tam, h, gap: i ? b.antes * Math.min(1, f + 0.15) : 0 };
  });
  let m = medir();
  const total = () => m.reduce((a, x) => a + x.h + x.gap, 0);
  for (let i = 0; i < 24 && total() > caixa.h; i++) { f *= 0.94; m = medir(); }
  let y = ancora === "topo" ? caixa.y : ancora === "baixo" ? caixa.y + caixa.h - total() : caixa.y + (caixa.h - total()) / 2;
  const out: Texto[] = [];
  for (const x of m) {
    y += x.gap;
    const ts = trechos(x.b.texto).map((t) => ({ ...t, t: x.b.caixa ? t.t.toUpperCase() : t.t }));
    out.push({ k: "texto", x: caixa.x, y: Math.round(y), w: caixa.w, h: Math.ceil(x.h + x.tam * 0.25), texto: ts.map((t) => t.t).join(""), trechos: ts, fonte: x.b.fonte, tam: x.tam, cor: x.b.cor, italico: x.b.italico, alinhar, entrelinha: x.b.entrelinha, espaco: x.b.espaco ? x.b.espaco * x.tam : undefined, serifa: x.b.serifa });
    y += x.h;
  }
  return out;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const fim = (ts: Texto[]) => (ts.length ? ts[ts.length - 1].y + ts[ts.length - 1].h : 0);

/** Elementos de uma lâmina, na ordem de desenho (o de baixo primeiro). */
export function desenhar(itens: Lamina[], i: number, e: Estilo): Elemento[] {
  const l = itens[i];
  const total = itens.length;
  const nSlide = itens.slice(0, i + 1).filter((x) => x.tipo === "slide").length;
  const M = 88;
  const c = e.cores;
  const revista = e.base === "revista";
  const out: Elemento[] = [{ k: "rect", x: 0, y: 0, w: W, h: H, cor: c.fundo }];
  const temFoto = !!(l.foto || l.notaFoto);
  const foto = temFoto ? l.modoFoto ?? (l.tipo === "capa" ? "fundo" : "moldura") : undefined;
  // A foto escolhida ou, sem ela, a vaga com a indicação do roteiro.
  const pf = (x: number, y: number, w: number, h: number, extra: { raio?: number; fundo?: string } = {}): Elemento => l.foto
    ? { k: "foto", x, y, w, h, foto: l.foto, pb: e.fotoPB, ...extra }
    : { k: "vaga", x, y, w, h, nota: l.notaFoto ?? "", cor: mistura(c.fundo, c.suave, 0.28), corTexto: mistura(c.fundo, c.suave, 0.85), fonte: e.fontes.texto, raio: extra.raio };
  const pos: PosFoto = l.posFoto ?? (e.base === "revista" ? "baixo" : "cima");
  const raio = e.raioFoto ?? (revista ? 22 : 0);
  const centro = e.base === "editorial" || (revista && l.tipo === "capa" && foto === "fundo");
  const alinhar = centro ? "center" : "left";
  const caixaTitulo = !!e.tituloCaixaAlta;
  // Sobre foto de fundo: camada escura e texto claro, mesmo nos estilos de fundo claro.
  const sobreFoto = foto === "fundo";
  const fundoEscuro = luz(c.fundo) < 0.5;
  const escuro = fundoEscuro ? c.fundo : c.texto;
  const claro = fundoEscuro ? c.texto : c.fundo;
  const corTexto = sobreFoto ? claro : c.texto;
  const corDestaque = sobreFoto && !fundoEscuro ? mistura(c.destaque, claro, 0.55) : c.destaque;
  const corSuave = sobreFoto ? claro : c.suave;
  const topoTexto = revista ? 200 : 170;

  // Textos (montados depois de decidir a caixa)
  const blocos: Bloco[] = [];
  if (l.tipo === "slide" && !e.semNumero) blocos.push({ texto: pad2(nSlide), tam: 26, min: 22, serifa: false, cor: corDestaque, fonte: e.fontes.texto, entrelinha: 1.2, espaco: 0.18, antes: 0 });
  const tt = revista ? (l.tipo === "capa" ? 96 : l.tipo === "final" ? 86 : 82) : l.tipo === "capa" ? (e.base === "manchete" ? 92 : 100) : l.tipo === "final" ? 80 : 68;
  blocos.push({ texto: l.titulo, tam: caixaTitulo ? Math.round(tt * 0.86) : tt, min: 40, serifa: true, cor: corTexto, fonte: e.fontes.titulo, caixa: caixaTitulo, entrelinha: revista ? 1.04 : 1.08, espaco: caixaTitulo ? 0.02 : 0, antes: 28 });
  blocos.push({ texto: l.subtitulo, tam: l.tipo === "capa" ? 40 : 36, min: 26, serifa: true, cor: corDestaque, fonte: e.fontes.titulo, italico: true, entrelinha: 1.2, antes: 24 });
  blocos.push({ texto: l.descricao, tam: revista ? 40 : 32, min: 24, serifa: false, cor: sobreFoto ? claro : mistura(c.texto, c.suave, revista ? 0.75 : 0.35), fonte: e.fontes.texto, entrelinha: revista ? 1.3 : 1.38, antes: revista ? 30 : 36 });

  let textos: Texto[] = [];
  const largura = W - 2 * M;
  if (foto === "fundo" && temFoto) {
    out.push(pf(0, 0, W, H));
    out.push({ k: "rect", x: 0, y: 0, w: W, h: H, cor: escuro, alfa: l.tipo === "capa" ? 0.2 : 0.4 });
    // Escurece de baixo para cima em degraus (o .pptx não tem degradê que o Canva leia bem).
    for (const t of [0.4, 0.52, 0.64, 0.76]) out.push({ k: "rect", x: 0, y: Math.round(H * t), w: W, h: H - Math.round(H * t), cor: escuro, alfa: 0.16 });
    textos = empilhar(blocos, { x: M, y: Math.round(H * 0.42), w: largura, h: Math.round(H * 0.58) - (revista ? 120 : 150) }, "baixo", alinhar);
  } else if (foto === "moldura" && temFoto && revista) {
    // Revista: foto arredondada em cima, embaixo ou ao lado do texto.
    const y0 = 210;
    const base = H - 120;
    if (pos === "lado") {
      const xf = 600;
      out.push(pf(xf, y0, W - xf, base - y0, { raio, fundo: c.fundo }));
      textos = empilhar(blocos, { x: M, y: y0, w: xf - M - 48, h: base - y0 }, "centro", "left");
    } else if (pos === "cima") {
      const fh = l.tipo === "capa" ? 600 : 500;
      out.push(pf(M, y0, largura, fh, { raio, fundo: c.fundo }));
      textos = empilhar(blocos, { x: M, y: y0 + fh + 64, w: largura, h: base - (y0 + fh + 64) }, "topo", "left");
    } else {
      // Texto no alto e a foto logo abaixo, ocupando o que sobra (no mínimo 380 px).
      textos = empilhar(blocos, { x: M, y: y0 + 40, w: largura, h: base - (y0 + 40) - 380 - 56 }, "topo", "left");
      const yf = Math.max(y0 + 40, fim(textos) + 56);
      out.push(pf(M, yf, largura, Math.min(560, base - yf), { raio, fundo: c.fundo }));
    }
  } else if (foto === "moldura" && temFoto) {
    if (e.base === "classico") {
      const fh = l.tipo === "capa" ? 640 : 520;
      const yf = pos === "baixo" ? H - 150 - fh : 150;
      out.push({ k: "rect", x: M + 16, y: yf + 16, w: largura, h: fh, cor: c.fundo, borda: c.destaque });
      out.push(pf(M, yf, largura, fh, { raio, fundo: c.fundo }));
      textos = pos === "baixo"
        ? empilhar(blocos, { x: M, y: topoTexto, w: largura, h: yf - 80 - topoTexto }, "baixo", alinhar)
        : empilhar(blocos, { x: M, y: yf + fh + 80, w: largura, h: H - (yf + fh + 80) - 150 }, "topo", alinhar);
    } else {
      const fh = e.base === "manchete" ? (l.tipo === "capa" ? 800 : 640) : l.tipo === "capa" ? 720 : 600;
      if (pos === "baixo") {
        out.push(pf(0, H - fh, W, fh));
        out.push({ k: "rect", x: 0, y: H - fh, w: W, h: 120, cor: c.fundo, alfa: 0.35 });
        textos = empilhar(blocos, { x: M, y: topoTexto, w: largura, h: H - fh - 64 - topoTexto }, "baixo", alinhar);
      } else {
        out.push(pf(0, 0, W, fh));
        out.push({ k: "rect", x: 0, y: fh - 140, w: W, h: 140, cor: c.fundo, alfa: 0.35 });
        textos = empilhar(blocos, { x: M, y: fh + 64, w: largura, h: H - (fh + 64) - 150 }, "topo", alinhar);
      }
    }
  } else if (l.tipo === "capa") {
    textos = empilhar(blocos, { x: M, y: 260, w: largura, h: H - 260 - 170 }, revista ? "centro" : "baixo", alinhar);
  } else {
    textos = empilhar(blocos, { x: M, y: topoTexto, w: largura, h: H - topoTexto - 150 }, "centro", alinhar);
  }

  // Topo e rodapé
  if (revista) {
    if (sobreFoto) {
      if (e.rodape) out.push(texto(e.rodape, M, 84, 600, 24, e.fontes.texto, corSuave, "left"));
    } else {
      const nome = e.rodape ?? "";
      const wn = nome ? Math.round(nome.length * 22 * 0.62 + nome.length * 3) : 0;
      out.push({ k: "rect", x: M, y: 108, w: W - 2 * M - (wn ? wn + 28 : 0), h: 1.5, cor: mistura(c.suave, c.fundo, 0.45) });
      if (nome) out.push({ ...texto(nome.toUpperCase(), W - M - wn - 4, 94, wn + 4, 22, e.fontes.texto, c.suave, "right"), espaco: 3 });
    }
  } else {
    if (e.rodape && foto !== "moldura") out.push(texto(e.rodape, M, 84, 600, 24, e.fontes.texto, corSuave, "left"));
    out.push({ ...texto(`${pad2(i + 1)} / ${pad2(total)}`, W - M - 200, H - 96, 200, 22, e.fontes.texto, corSuave, "right"), espaco: 2 });
    if (e.rodape && foto === "moldura") out.push(texto(e.rodape, M, H - 96, 600, 22, e.fontes.texto, corSuave, "left"));
  }

  // Detalhes da base
  if (textos.length && e.base === "editorial" && foto !== "fundo") {
    out.push({ k: "rect", x: W / 2 - 40, y: Math.max(130, textos[0].y - 44), w: 80, h: 3, cor: c.destaque });
  }
  if (e.base === "manchete" && l.tipo === "slide" && !e.semNumero && textos[0]) {
    const t0 = textos[0];
    out.push({ k: "rect", x: t0.x, y: t0.y + 9, w: 12, h: 12, cor: c.destaque, elipse: true });
    textos[0] = { ...t0, x: t0.x + 26, w: t0.w - 26 };
  }
  if (e.base === "classico" && l.tipo === "final" && textos.length) {
    out.push({ k: "rect", x: M, y: Math.max(130, textos[0].y - 48), w: 64, h: 3, cor: c.destaque });
  }
  return [...out, ...textos];
}

function texto(t: string, x: number, y: number, w: number, tam: number, fonte: string, cor: string, alinhar: "left" | "right"): Texto {
  return { k: "texto", x, y, w, h: Math.round(tam * 1.4), texto: t, trechos: [{ t }], fonte, tam, cor, alinhar, entrelinha: 1.2, serifa: false };
}

/** Luminosidade de 0 (preto) a 1 (branco). */
export function luz(c: string): number {
  if (!corValida(c)) return 0;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Cor entre duas (para a descrição ficar um pouco mais apagada que o título). */
function mistura(a: string, b: string, t = 0.35): string {
  const p = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  if (!corValida(a) || !corValida(b)) return a;
  const [x, y] = [p(a), p(b)];
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

/** Pasta e nome de arquivo do carrossel no Canva: "01 Título" (o número casa o ZIP na volta). */
export function nomeArquivo(n: number, titulo: string): string {
  // Sem acento: nome de arquivo dentro de ZIP com acento se embaralha em alguns sistemas.
  const t = titulo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w .,()-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  return `${pad2(n)} ${t || "Carrossel"}`;
}
