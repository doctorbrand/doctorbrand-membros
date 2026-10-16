/**
 * Os 5 modelos de carrossel do design system DoctorBrand (skill carrossel-fernandofontees):
 * Autoridade, Editorial, Manchete, Consultoria e Bastidor. O desenho é fixo, em código; o que muda é o
 * texto (o JSON do carrossel), as fotos e as fontes do kit. Gera o HTML de cada lâmina de 1080 × 1350,
 * o mesmo do assets/template.html da skill: serve para a miniatura no kit (dentro de um iframe) e, na
 * etapa 3, para exportar as lâminas.
 * Puro (sem servidor): vale no navegador também.
 */

import { fontFiles, fontVariantLabel, googleFontCss, type BrandKit, type FontSlot } from "@/lib/brand";
import { DOCTORBRAND_CSS } from "./doctorbrandCss";

export type ModeloId = "autoridade" | "editorial" | "manchete" | "consultoria" | "bastidor";

export interface CarrosselItem { titulo?: string; texto?: string; status?: string; rotulo?: string }

/** Uma lâmina. Os campos usados dependem do modelo e do tipo (ver MODELOS). */
export interface CarrosselSlide {
  tipo: string;
  foto?: string; pb?: boolean; foco?: string;
  eyebrow?: string; kicker?: string; script?: string; rotulo?: string; rotulo2?: string; antes?: string;
  titulo?: string; italico?: string; texto?: string; fecho?: string; numero?: string; keyword?: string;
  tamanho?: number;
  blocos?: string[];
  itens?: (string | CarrosselItem)[];
  cards?: CarrosselItem[];
}

export interface Carrossel { modelo: ModeloId; handle: string; slides: CarrosselSlide[] }

export interface ModeloInfo {
  id: ModeloId;
  nome: string;
  /** Referência visual que inspirou o modelo. */
  ref: string;
  quando: string;
  foto: boolean;
  tipos: { tipo: string; nome: string; campos: string }[];
}

export const MODELOS: ModeloInfo[] = [
  {
    id: "autoridade", nome: "Autoridade", ref: "carrossel “5 erros”", foto: false,
    quando: "Tese, lista de erros, opinião. Só texto. É o modelo quando não há foto.",
    tipos: [
      { tipo: "capa", nome: "Capa", campos: "Título até 10 palavras, uma palavra em dourado; texto; sobretítulo opcional." },
      { tipo: "argumento", nome: "Argumento", campos: "Sobretítulo (“Erro 1”), título até 8 palavras, texto até 40." },
      { tipo: "numero", nome: "Número", campos: "Número grande, título e texto." },
      { tipo: "citacao", nome: "Citação", campos: "Lâmina clara, no máximo uma: a frase e a assinatura." },
      { tipo: "resumo", nome: "Resumo", campos: "Título e lista de 3 a 6 itens." },
      { tipo: "cta", nome: "CTA", campos: "Título, texto e a palavra para comentar." },
    ],
  },
  {
    id: "editorial", nome: "Editorial", ref: "Gládia Bernardi", foto: true,
    quando: "Tendência de mercado, “por que X virou Y”, tom de revista de luxo. Foto em preto e branco nas internas.",
    tipos: [
      { tipo: "capa", nome: "Capa", campos: "Foto, frase em script dourado (2 a 4 palavras), título em caixa alta (2 a 3 linhas) e complemento." },
      { tipo: "zigue", nome: "Zigue-zague", campos: "Foto PB e 3 frases curtas em zigue-zague; a última com ênfase." },
      { tipo: "numero", nome: "Número", campos: "Lâmina clara: frase de entrada, rótulo, número curto (ex.: R$ 14), segundo rótulo e texto." },
      { tipo: "frase", nome: "Frase", campos: "Foto PB, título em caixa alta (1 a 3 palavras), itálico dourado, texto e fecho." },
      { tipo: "cta", nome: "CTA", campos: "Foto, script, “Comenta PALAVRA” e texto." },
    ],
  },
  {
    id: "manchete", nome: "Manchete", ref: "Academia Lendária", foto: true,
    quando: "Notícia, mudança, comparação “antes × agora”. Foto na metade de cima.",
    tipos: [
      { tipo: "capa", nome: "Capa", campos: "Foto nos 2/3 de cima, assunto (“Tema · Subtema”), título de 2 a 3 palavras, itálico dourado e texto." },
      { tipo: "comparacao", nome: "Comparação", campos: "Foto, assunto, título com itálico e 2 cartões; o segundo é o certo e ganha contorno dourado." },
      { tipo: "texto", nome: "Texto", campos: "Assunto, título, itálico dourado e texto." },
      { tipo: "cta", nome: "CTA", campos: "Título, itálico, texto e a palavra para comentar." },
    ],
  },
  {
    id: "consultoria", nome: "Consultoria", ref: "RR Brands", foto: true,
    quando: "Método, entrega, oferta e processo da DoctorBrand. Foto na capa e em uma frase.",
    tipos: [
      { tipo: "capa", nome: "Capa", campos: "Foto com o rosto à direita e título em caixa alta, com o final em itálico e a palavra-chave em dourado." },
      { tipo: "secao", nome: "Seção", campos: "Rótulo (ex.: Metodologia) e texto grande; os trechos com ênfase acendem em creme." },
      { tipo: "etapas", nome: "Etapas", campos: "Rótulo, título e 3 a 5 etapas (título e texto)." },
      { tipo: "foto-frase", nome: "Foto e frase", campos: "Foto PB e título em caixa alta com itálico." },
      { tipo: "cta", nome: "CTA", campos: "Rótulo, título e texto (pode levar ao diagnóstico)." },
    ],
  },
  {
    id: "bastidor", nome: "Bastidor", ref: "Lucas Miyamoto", foto: true,
    quando: "Bastidor real, “tudo o que acontece antes de…”, processo com cliente. Foto em quase todas.",
    tipos: [
      { tipo: "capa", nome: "Capa", campos: "Foto colorida e título grande embaixo à esquerda (até 12 palavras)." },
      { tipo: "foto-texto", nome: "Foto e texto", campos: "Foto PB, título com ênfase e texto." },
      { tipo: "telas", nome: "Telas", campos: "Foto PB, 2 a 4 cartões claros (título e situação) e título." },
      { tipo: "texto", nome: "Texto", campos: "Título e texto em fundo liso, para respirar entre fotos." },
      { tipo: "cta", nome: "CTA", campos: "Foto, título, texto e a palavra para comentar." },
    ],
  },
];

export const isModeloId = (v: unknown): v is ModeloId => MODELOS.some((m) => m.id === v);

/** Os exemplos da skill (assets/exemplos), escritos pelo Fernando. A foto é trocada pela da pasta do Drive. */
export const EXEMPLOS: Record<ModeloId, Carrossel> = {
  autoridade: {
    modelo: "autoridade", handle: "@fernandofontees",
    slides: [
      { tipo: "capa", titulo: "5 erros que fazem o seu perfil parecer *catálogo*.", texto: "O número 4 é o que mais custa caro." },
      { tipo: "argumento", eyebrow: "Erro 1", titulo: "Só antes e depois.", texto: "Antes e depois prova que você opera bem. Não prova por que operar com você." },
      { tipo: "citacao", titulo: "Catálogo mostra o que você faz. Consultório mostra quem você é.", texto: "Fernando Fontes" },
      { tipo: "resumo", titulo: "Os 5 erros", itens: ["Só antes e depois", "Bio de crachá", "Destaque velho", "Nenhum critério à mostra", "Legenda sem próximo passo"] },
      { tipo: "cta", titulo: "São 12 no total.", texto: "Te mando a lista completa no direct.", keyword: "ERROS" },
    ],
  },
  editorial: {
    modelo: "editorial", handle: "@fernandofontees",
    slides: [
      { tipo: "capa", foto: "fotos/fernando.jpg", foco: "center 20%", script: "Por que o WhatsApp", titulo: "virou a sala de espera\nmais importante", texto: "da sua clínica?" },
      { tipo: "zigue", foto: "fotos/fernando.jpg", pb: true, foco: "center 30%", blocos: ["Porque a paciente de alto ticket mudou a primeira pergunta.", "Ela parou de perguntar quanto custa.", "Passou a perguntar **quem vai cuidar dela.**"] },
      { tipo: "numero", antes: "E o dado que mais pesa nessa conta é simples.", rotulo: "Custo médio por lead", numero: "R$ 14", rotulo2: "nos clientes DoctorBrand", texto: "O anúncio já entrega a conversa barata. **O que decide é quem responde.**" },
      { tipo: "frase", foto: "fotos/fernando.jpg", pb: true, foco: "center 15%", titulo: "O lead", italico: "já chegou.", texto: "Ele leu seu conteúdo, viu seu perfil, clicou no anúncio. O que falta é um atendimento à altura do que ele viu.", fecho: "A disputa agora é **na conversa.**" },
      { tipo: "cta", foto: "fotos/fernando.jpg", foco: "center 20%", script: "Quer o roteiro?", titulo: "Comenta ATENDIMENTO", texto: "Te mando o roteiro de primeira resposta no direct." },
    ],
  },
  manchete: {
    modelo: "manchete", handle: "@fernandofontees",
    slides: [
      { tipo: "capa", foto: "fotos/fernando.jpg", foco: "center 15%", kicker: "Tráfego · Custo por lead", titulo: "Lead barato", italico: "ficou caro.", texto: "E o motivo é maior do que parece." },
      { tipo: "comparacao", foto: "fotos/fernando.jpg", pb: true, foco: "center 10%", kicker: "O que mudou", titulo: "O anúncio separou", italico: "curioso de paciente.", cards: [
        { rotulo: "Formulário", titulo: "Volume alto.", texto: "Muito nome, pouca conversa. A secretária gasta o dia com quem só queria o preço." },
        { rotulo: "Conversa", titulo: "Volume menor.", texto: "Cada lead já chega sabendo o que quer. A agenda enche com quem decide." },
      ] },
      { tipo: "texto", kicker: "A leitura óbvia", titulo: "\"O CPL subiu.\"", italico: "A leitura real é outra.", texto: "O custo que importa é o da consulta agendada. Lead barato que não agenda é o lead mais caro da conta." },
      { tipo: "cta", titulo: "Quer ver a conta", italico: "do seu consultório?", texto: "Te mando a planilha que a gente usa.", keyword: "CPL" },
    ],
  },
  consultoria: {
    modelo: "consultoria", handle: "@fernandofontees",
    slides: [
      { tipo: "capa", foto: "fotos/fernando.jpg", foco: "30% 20%", titulo: "Tudo que\nentregamos\nna nossa\n_Arquitetura de_\n_*Autoridade*_" },
      { tipo: "secao", rotulo: "Metodologia", texto: "Em **30 a 45 dias** construímos o sistema completo para o médico **ser visto, lembrado e escolhido.**" },
      { tipo: "etapas", rotulo: "As 4 fases", titulo: "Cada fase entrega algo que fica com o médico.", itens: [
        { titulo: "Diagnóstico e Estratégia", texto: "Posicionamento, público e concorrência." },
        { titulo: "Construção Visual e Verbal", texto: "Identidade, tom de voz e narrativa." },
        { titulo: "Implementação e Produção", texto: "Perfil, landing page e captação audiovisual." },
        { titulo: "Ativação e Handoff", texto: "Painel configurado e operação rodando." },
      ] },
      { tipo: "foto-frase", foto: "fotos/fernando.jpg", pb: true, foco: "center 15%", titulo: "Não vendemos design.\n_Vendemos percepção._" },
      { tipo: "cta", rotulo: "Próximo passo", titulo: "Agende seu\n_diagnóstico_", texto: "Link na bio. Vagas limitadas por mês." },
    ],
  },
  bastidor: {
    modelo: "bastidor", handle: "@fernandofontees",
    slides: [
      { tipo: "capa", foto: "fotos/fernando.jpg", foco: "center 25%", titulo: "Tudo o que acontece antes do primeiro post de um médico." },
      { tipo: "foto-texto", foto: "fotos/fernando.jpg", pb: true, foco: "center 15%", titulo: "Antes de qualquer roteiro, a gente precisa **entender o consultório.**", texto: "Como a secretária atende, o que o paciente pergunta, por que ele escolhe e por que ele some." },
      { tipo: "telas", foto: "fotos/fernando.jpg", pb: true, foco: "center 10%", titulo: "Depois vem a pesquisa: perfil, concorrência, público e referências.", itens: [
        { titulo: "Diagnóstico do perfil", status: "Concluído" },
        { titulo: "Mapa da concorrência", status: "Concluído" },
        { titulo: "Briefing do médico", status: "Em revisão" },
      ] },
      { tipo: "texto", titulo: "Só então o conteúdo começa. E aí ele **já nasce com direção.**", texto: "É por isso que o primeiro post de um cliente nosso não parece de agência." },
      { tipo: "cta", foto: "fotos/fernando.jpg", foco: "center 20%", titulo: "Quer ver o processo completo?", texto: "Te mando o passo a passo no direct.", keyword: "PROCESSO" },
    ],
  },
};

// ─── Fontes ───────────────────────────────────────────────────────────────

/** Cada vaga de fonte do kit vira uma família do template, com os pesos que os 5 modelos usam. */
export const FONTES_MODELOS: { slot: FontSlot; family: string; papel: string; fallback: string; pesos: [number, boolean][] }[] = [
  { slot: "titulo", family: "Denton", papel: "serifa", fallback: "Georgia", pesos: [[300, false], [300, true], [400, false], [400, true], [500, false]] },
  { slot: "texto", family: "Aktiv Grotesk", papel: "grotesca", fallback: "Inter", pesos: [[300, false], [400, false], [400, true], [500, false], [600, false], [700, false]] },
  { slot: "script", family: "Sloop", papel: "script", fallback: "cursive", pesos: [[400, false]] },
];

/** Variantes que os modelos usam e o kit ainda não tem, por vaga ("Light itálico", "Bold"…). */
export function fontesFaltando(k: BrandKit): Record<FontSlot, string[]> {
  const out = {} as Record<FontSlot, string[]>;
  for (const f of FONTES_MODELOS) {
    const font = k.fonts[f.slot];
    if (font?.source === "google" && font.family) { out[f.slot] = []; continue; }
    const have = new Set(fontFiles(font).map((x) => `${x.weight}${x.italic ? "i" : ""}`));
    out[f.slot] = f.pesos.filter(([w, i]) => !have.has(`${w}${i ? "i" : ""}`)).map(([w, i]) => fontVariantLabel(w, i));
  }
  return out;
}

const cssStr = (s: string) => s.replace(/["\\\n]/g, "");

/**
 * @font-face e <link> das fontes do kit, com o nome de família que o template espera (Denton, Aktiv
 * Grotesk, Sloop). Fonte do Google Fonts na vaga: o template passa a usar aquela família.
 */
export function fontesCss(k: BrandKit, fileUrl: (path: string) => string): { css: string; links: string[] } {
  const faces: string[] = [], links: string[] = [], vars: string[] = [];
  const varName: Record<FontSlot, string> = { titulo: "--serif", texto: "--sans", script: "--script" };
  for (const f of FONTES_MODELOS) {
    const font = k.fonts[f.slot];
    const files = fontFiles(font);
    if (files.length) {
      for (const x of files) faces.push(`@font-face{font-family:"${f.family}";src:url("${cssStr(fileUrl(x.path))}");font-weight:${x.weight};font-style:${x.italic ? "italic" : "normal"};font-display:block}`);
    } else if (font?.source === "google" && font.family) {
      links.push(googleFontCss(font.family));
      vars.push(`${varName[f.slot]}:"${cssStr(font.family)}",${f.fallback}`);
    }
  }
  return { css: faces.join("\n") + (vars.length ? `\n:root{${vars.join(";")}}` : ""), links };
}

// ─── Ajustes salvos por modelo ───────────────────────────────────────────
// O desenho continua o da skill; os ajustes só escalam títulos e texto, sobem ou descem o bloco de texto
// e mexem no véu, no brilho e na cor da foto. Ficam no kit (BrandKit.ajustesModelos) e valem para a
// miniatura e para as lâminas geradas.

export interface AjustesModelo {
  /** Tamanho dos títulos, em % do desenho original (80 a 130). */
  titulo?: number;
  /** Tamanho do texto de apoio, em % (80 a 130). */
  texto?: number;
  /** Bloco de texto mais alto (negativo) ou mais baixo, em px da lâmina de 1350 (-150 a 150). */
  deslocamento?: number;
  /** Força do véu escuro sobre a foto, em % (50 a 100). */
  veu?: number;
  /** Brilho da foto, em % (70 a 130). */
  brilho?: number;
  /** Cor da foto: como o modelo pede, sempre colorida ou sempre em preto e branco. */
  foto?: "padrao" | "cor" | "pb";
}

export const AJUSTES_PADRAO: Required<AjustesModelo> = { titulo: 100, texto: 100, deslocamento: 0, veu: 100, brilho: 100, foto: "padrao" };
export const AJUSTES_LIMITES = { titulo: [80, 130], texto: [80, 130], deslocamento: [-150, 150], veu: [50, 100], brilho: [70, 130] } as const;

/** Limpa os ajustes vindos do navegador: só números nos limites, sem guardar o que está no padrão. */
export function cleanAjustes(raw: unknown): AjustesModelo {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: AjustesModelo = {};
  for (const key of Object.keys(AJUSTES_LIMITES) as (keyof typeof AJUSTES_LIMITES)[]) {
    const n = Math.round(Number(r[key]));
    if (!Number.isFinite(n)) continue;
    const [min, max] = AJUSTES_LIMITES[key];
    const v = Math.min(max, Math.max(min, n));
    if (v !== AJUSTES_PADRAO[key]) out[key] = v;
  }
  if (r.foto === "cor" || r.foto === "pb") out.foto = r.foto;
  return out;
}

/** O que é título e o que é texto em cada modelo (seletores do CSS da skill). */
const PARTES: Record<ModeloId, { titulo: string; texto: string }> = {
  autoridade: { titulo: "h1, h2, .num, .num-legenda, blockquote", texto: "p.t, ol li" },
  editorial: { titulo: ".caps, .script, .serif-it, .gnum", texto: ".sub, .bloco, .claro p, .lbl" },
  manchete: { titulo: ".h-sans, .h-serif, .h2-sans, .h2-serif:not(.h2-sans .h2-serif)", texto: ".sub, .card .cv, .card .cd" },
  consultoria: { titulo: ".tc, .etapas .et", texto: ".grande, .etapas .ed" },
  bastidor: { titulo: ".big, .mid", texto: ".peq, .tela" },
};

function ajustesCss(m: ModeloId, a: AjustesModelo): string {
  const r: string[] = [], M = `.m-${m}`;
  const scope = (sel: string) => sel.split(",").map((x) => `${M} ${x.trim()}`).join(",");
  if (a.titulo && a.titulo !== 100) r.push(`${scope(PARTES[m].titulo)}{zoom:${a.titulo / 100}}`);
  if (a.texto && a.texto !== 100) r.push(`${scope(PARTES[m].texto)}{zoom:${a.texto / 100}}`);
  if (a.deslocamento) r.push(`${M} .abs,${M} .body{translate:0 ${a.deslocamento}px}`);
  if (a.veu && a.veu !== 100) r.push(`${M} .veu{opacity:${a.veu / 100}}`);
  if (a.brilho && a.brilho !== 100) r.push(`${M} .ph{filter:brightness(${a.brilho / 100})}${M} .ph.pb{filter:grayscale(1) contrast(1.06) brightness(${a.brilho / 100})}`);
  return r.join("\n");
}

// ─── Desenho (port do assets/template.html) ──────────────────────────────

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
/* *texto* = dourado · _texto_ = itálico · **texto** = negrito/ênfase do modelo · \n = quebra */
const rich = (s: unknown) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, '<span class="d">$1</span>').replace(/_(.+?)_/g, "<em>$1</em>").replace(/\n/g, "<br>");
const txt = (it: string | CarrosselItem) => (typeof it === "string" ? it : it.titulo ?? "");

type Out = [string, string];
type Ctx = { handle: string; total: number };
type S = CarrosselSlide & { area?: string };

const nn = (i: number, total: number) => String(i + 1).padStart(2, "0") + "/" + String(total).padStart(2, "0");
const foto = (s: S, veu: string) => s.foto ? `<div class="ph${s.pb ? " pb" : ""}" style="background-image:url('${esc(s.foto)}');${s.foco ? `background-position:${esc(s.foco)};` : ""}${s.area ? s.area : ""}"></div><div class="veu" style="background:${veu}"></div>` : "";

const R: Record<ModeloId, (s: S, i: number, c: Ctx) => Out> = {
  autoridade: (s, i, { handle, total }) => {
    const b = ({
      capa: () => `${s.eyebrow ? `<div class="eyebrow">${esc(s.eyebrow)}</div>` : ""}<h1>${rich(s.titulo)}</h1>${s.texto ? `<p class="t">${rich(s.texto)}</p>` : ""}`,
      argumento: () => `${s.eyebrow ? `<div class="eyebrow">${esc(s.eyebrow)}</div>` : ""}<h2>${rich(s.titulo)}</h2>${s.texto ? `<p class="t">${rich(s.texto)}</p>` : ""}`,
      numero: () => `<div class="num">${esc(s.numero)}</div><div class="num-legenda">${rich(s.titulo)}</div>${s.texto ? `<p class="t">${rich(s.texto)}</p>` : ""}`,
      citacao: () => `<blockquote>${rich(s.titulo)}</blockquote>${s.texto ? `<div class="assina">${esc(s.texto)}</div>` : ""}`,
      resumo: () => `<h2>${rich(s.titulo)}</h2><ol>${(s.itens || []).map((it, k) => `<li><span>${k + 1}</span>${rich(txt(it))}</li>`).join("")}</ol>`,
      cta: () => `<h2>${rich(s.titulo)}</h2>${s.texto ? `<p class="t">${rich(s.texto)}</p>` : ""}${s.keyword ? `<div class="kw">Comenta ${esc(s.keyword)}</div>` : ""}`,
    } as Record<string, () => string>)[s.tipo] || (() => "");
    return [s.tipo === "citacao" ? "claro" : "", `<div class="top">DoctorBrand</div><div class="body">${b()}</div><div class="bottom"><span>${esc(handle)}</span><span>${i + 1}/${total}</span></div>`];
  },

  editorial: (s, i, { total }) => {
    const hdr = `<div class="hdr"><span><b>Fernando Fontes</b><i>DoctorBrand®</i></span><span>${nn(i, total)}</span></div>`;
    if (s.tipo === "capa") return ["", foto(s, "linear-gradient(180deg,rgba(12,10,8,.55) 0%,rgba(12,10,8,.05) 25%,rgba(12,10,8,.15) 45%,rgba(12,10,8,.85) 72%,#0c0a08 100%)") + hdr +
      `<div class="abs" style="left:80px;right:80px;bottom:110px">${s.script ? `<div class="script">${esc(s.script)}</div>` : ""}<div class="caps">${rich(s.titulo)}</div>${s.texto ? `<div class="sub">${rich(s.texto)}</div>` : ""}</div>`];
    if (s.tipo === "zigue") {
      const pos = ["left:80px;top:230px", "right:80px;top:560px;text-align:right", "left:80px;bottom:150px"];
      return ["", foto(s, "rgba(12,10,8,.68)") + hdr + (s.blocos || []).map((b, k) => `<div class="abs bloco" style="${pos[k] || pos[2]}">${rich(b)}</div>`).join("")];
    }
    if (s.tipo === "numero") return ["claro", hdr +
      `<div class="abs" style="left:80px;right:80px;top:210px"><p>${rich(s.antes || "")}</p></div>
       <div class="abs" style="left:80px;right:80px;top:420px"><div class="lbl">${rich(s.rotulo || "")}</div>
         <div class="gnum" style="font-size:${Number(s.tamanho) || 300}px;margin-top:10px;white-space:nowrap">${esc(s.numero)}</div>
         <div class="lbl" style="text-align:right;margin-top:6px">${rich(s.rotulo2 || "")}</div></div>
       <div class="abs" style="left:80px;right:80px;bottom:150px"><p>${rich(s.texto || "")}</p></div>`];
    if (s.tipo === "frase") return ["", foto(s, "linear-gradient(180deg,rgba(12,10,8,.75),rgba(12,10,8,.55) 50%,rgba(12,10,8,.8))") + hdr +
      `<div class="abs" style="left:80px;right:80px;top:260px"><div class="caps" style="font-size:78px">${rich(s.titulo)}</div><div class="serif-it">${rich(s.italico || "")}</div></div>
       <div class="abs bloco" style="right:80px;top:640px;text-align:left;max-width:520px;font-size:34px;color:var(--text-80)">${rich(s.texto || "")}</div>
       ${s.fecho ? `<div class="abs bloco" style="left:80px;bottom:150px;font-size:36px">${rich(s.fecho)}</div>` : ""}`];
    if (s.tipo === "cta") return ["", foto(s, "rgba(12,10,8,.8)") + hdr +
      `<div class="abs" style="left:80px;right:80px;top:50%;transform:translateY(-50%);text-align:center">${s.script ? `<div class="script" style="font-size:150px">${esc(s.script)}</div>` : ""}<div class="caps" style="font-size:70px">${rich(s.titulo)}</div><div class="sub" style="margin-top:40px">${rich(s.texto || "")}</div></div>`];
    return ["", hdr];
  },

  manchete: (s, i, { handle, total }) => {
    const hdr = `<div class="hdr"><span>${esc(handle)}</span><span>© DoctorBrand</span></div>`;
    if (s.tipo === "capa") return ["", foto({ ...s, area: "bottom:34%;" }, "linear-gradient(180deg,rgba(12,10,8,.5) 0%,rgba(12,10,8,0) 20%,rgba(12,10,8,0) 40%,#0c0a08 66%)") + hdr +
      `<div class="abs" style="left:72px;right:72px;bottom:190px">${s.kicker ? `<div class="kicker">${esc(s.kicker)}</div>` : ""}<div class="h-sans">${rich(s.titulo)}</div><div class="h-serif">${rich(s.italico || "")}</div>${s.texto ? `<div class="sub">${rich(s.texto)}</div>` : ""}</div>
       <div class="pg">${nn(i, total)}</div><div class="seta">→</div>`];
    if (s.tipo === "comparacao") return ["", foto({ ...s, area: "bottom:52%;" }, "linear-gradient(180deg,rgba(12,10,8,.5) 0%,rgba(12,10,8,.1) 25%,#0c0a08 48%)") + hdr +
      `<div class="abs" style="left:72px;right:72px;bottom:170px">${s.kicker ? `<div class="kicker">${esc(s.kicker)}</div>` : ""}<div class="h2-sans">${rich(s.titulo)} <span class="h2-serif">${rich(s.italico || "")}</span></div>
       <div class="cards">${(s.cards || []).map((c, k) => `<div class="card${k === 1 ? " on" : ""}"><div class="ct">${esc(c.rotulo)}</div><div class="cv">${rich(c.titulo)}</div><div class="cd">${rich(c.texto)}</div></div>`).join("")}</div></div>
       <div class="pg">${nn(i, total)}</div><div class="seta">→</div>`];
    if (s.tipo === "texto") return ["", hdr +
      `<div class="abs" style="left:72px;right:72px;top:300px">${s.kicker ? `<div class="kicker">${esc(s.kicker)}</div>` : ""}<div class="h2-sans" style="font-size:92px">${rich(s.titulo)}</div><div class="h2-serif" style="font-size:92px">${rich(s.italico || "")}</div>
       <div class="sub" style="font-size:36px;line-height:1.5;color:var(--text-80);margin-top:56px;max-width:800px">${rich(s.texto || "")}</div></div>
       <div class="pg">${nn(i, total)}</div><div class="seta">→</div>`];
    if (s.tipo === "cta") return ["", hdr +
      `<div class="abs" style="left:72px;right:72px;top:50%;transform:translateY(-50%)"><div class="h-sans" style="font-size:96px">${rich(s.titulo)}</div><div class="h-serif" style="font-size:96px">${rich(s.italico || "")}</div><div class="sub" style="color:var(--text-80)">${rich(s.texto || "")}</div>
       ${s.keyword ? `<div style="display:inline-block;margin-top:56px;padding:24px 48px;border-radius:9999px;background:var(--gold-light);color:var(--brown-deep);font-size:28px;letter-spacing:.18em;text-transform:uppercase">Comenta ${esc(s.keyword)}</div>` : ""}</div><div class="pg">${nn(i, total)}</div>`];
    return ["", hdr];
  },

  consultoria: (s) => {
    const rod = `<div class="rod"><b>DoctorBrand</b><span>doctorbrand.co</span></div>`;
    const selo = `<svg class="selo" viewBox="0 0 59.29 64.38"><use href="#simbolo"/></svg>`;
    if (s.tipo === "capa") return ["", foto(s, "linear-gradient(90deg,rgba(12,10,8,.78) 0%,rgba(12,10,8,.35) 55%,rgba(12,10,8,0) 80%),linear-gradient(180deg,rgba(12,10,8,0) 70%,rgba(12,10,8,.85) 100%)") + selo +
      `<div class="abs" style="left:80px;right:380px;bottom:200px"><div class="tc">${rich(s.titulo)}</div></div>` + `<svg class="arrow" viewBox="0 0 54 54" fill="none" stroke="#d8d3c7" stroke-width="2"><path d="M12 42 L42 12 M18 12 H42 V36"/></svg>` + rod];
    if (s.tipo === "secao") return ["", `<div class="secao">${esc(s.rotulo)}</div>` +
      `<div class="abs grande" style="left:80px;right:80px;bottom:190px">${rich(s.texto)}</div>` + rod];
    if (s.tipo === "etapas") return ["", `<div class="secao">${esc(s.rotulo)}</div>` +
      `<div class="abs" style="left:80px;right:80px;top:230px"><div class="grande" style="font-size:54px;margin-bottom:56px">${rich(s.titulo || "")}</div>
       <ol class="etapas">${(s.itens || []).map((it, k) => `<li><div class="n">0${k + 1}</div><div><div class="et">${rich(txt(it))}</div><div class="ed">${rich(typeof it === "string" ? "" : it.texto || "")}</div></div></li>`).join("")}</ol></div>` + rod];
    if (s.tipo === "foto-frase") return ["", foto(s, "linear-gradient(180deg,rgba(12,10,8,.2) 0%,rgba(12,10,8,.1) 40%,rgba(12,10,8,.9) 80%)") + selo +
      `<div class="abs" style="left:80px;right:80px;bottom:170px"><div class="tc" style="font-size:76px">${rich(s.titulo)}</div></div>` + rod];
    if (s.tipo === "cta") return ["", selo + `<div class="secao" style="left:180px">${esc(s.rotulo || "Próximo passo")}</div>` +
      `<div class="abs" style="left:80px;right:80px;top:50%;transform:translateY(-50%)"><div class="tc" style="font-size:84px">${rich(s.titulo)}</div><div class="grande" style="font-size:40px;margin-top:48px">${rich(s.texto || "")}</div></div>` + `<svg class="arrow" viewBox="0 0 54 54" fill="none" stroke="#c9a96e" stroke-width="2"><path d="M12 42 L42 12 M18 12 H42 V36"/></svg>` + rod];
    return ["", rod];
  },

  bastidor: (s, i, { total }) => {
    const marca = `<svg class="marca" viewBox="0 0 59.29 64.38"><use href="#simbolo"/></svg>`;
    const pg = `<div class="pg">${i + 1}/${total}</div>`;
    if (s.tipo === "capa") return ["", foto(s, "linear-gradient(180deg,rgba(12,10,8,.35) 0%,rgba(12,10,8,0) 25%,rgba(12,10,8,.05) 50%,rgba(12,10,8,.7) 100%)") + marca +
      `<div class="abs big" style="left:72px;right:120px;bottom:120px">${rich(s.titulo)}</div>` + pg];
    if (s.tipo === "foto-texto") return ["", foto(s, "linear-gradient(180deg,rgba(12,10,8,.3) 0%,rgba(12,10,8,.1) 30%,rgba(12,10,8,.75) 70%,rgba(12,10,8,.9) 100%)") + marca +
      `<div class="abs" style="left:72px;right:72px;bottom:120px"><div class="mid">${rich(s.titulo)}</div>${s.texto ? `<div class="peq">${rich(s.texto)}</div>` : ""}</div>` + pg];
    if (s.tipo === "telas") return ["", foto(s, "linear-gradient(180deg,rgba(12,10,8,.35),rgba(12,10,8,.55) 60%,rgba(12,10,8,.9))") + marca +
      `<div class="abs telas" style="left:150px;right:150px;top:360px">${(s.itens || []).map((t) => `<div class="tela"><b>${esc(txt(t))}</b><span>${esc(typeof t === "string" ? "" : t.status || "")}</span></div>`).join("")}</div>
       <div class="abs mid" style="left:72px;right:72px;bottom:120px;font-size:52px">${rich(s.titulo)}</div>` + pg];
    if (s.tipo === "texto") return ["", marca + `<div class="abs" style="left:72px;right:72px;bottom:160px"><div class="mid" style="font-size:72px">${rich(s.titulo)}</div>${s.texto ? `<div class="peq" style="font-size:32px">${rich(s.texto)}</div>` : ""}</div>` + pg];
    if (s.tipo === "cta") return ["", foto(s, "rgba(12,10,8,.75)") + marca + `<div class="abs" style="left:72px;right:72px;bottom:160px"><div class="mid" style="font-size:72px">${rich(s.titulo)}</div>${s.texto ? `<div class="peq" style="font-size:32px">${rich(s.texto)}</div>` : ""}
       ${s.keyword ? `<div style="display:inline-block;margin-top:44px;padding:22px 44px;border-radius:9999px;background:var(--gold-light);color:var(--brown-deep);font-size:26px;letter-spacing:.18em;text-transform:uppercase">Comenta ${esc(s.keyword)}</div>` : ""}</div>` + pg];
    return ["", marca + pg];
  },
};

/**
 * Documento HTML completo do carrossel (ou de uma lâmina só, com `only`), pronto para um iframe de
 * 1080 × 1350 ou para virar PNG. O contador sempre conta o carrossel inteiro.
 */
export function carrosselDoc(data: Carrossel, opts: { fontes: { css: string; links: string[] }; simbolo: string; only?: number; title?: string; ajustes?: AjustesModelo }): string {
  const aj = opts.ajustes ?? {};
  if (aj.foto === "cor" || aj.foto === "pb") data = { ...data, slides: data.slides.map((s) => (s.foto ? { ...s, pb: aj.foto === "pb" } : s)) };
  const total = data.slides.length;
  const ctx: Ctx = { handle: data.handle, total };
  const render = R[data.modelo] ?? R.autoridade;
  const sections = data.slides.map((s, i) => {
    if (opts.only !== undefined && opts.only !== i) return "";
    const [cls, html] = render(s, i, ctx);
    return `<section class="slide ${cls} t-${esc(s.tipo)}" data-i="${i + 1}">${html}</section>`;
  }).join("");
  const sym = `<svg width="0" height="0" style="position:absolute"><defs><g id="simbolo" fill="#e6e1d5">${opts.simbolo}</g></defs></svg>`;
  const single = opts.only !== undefined ? "body{background:transparent;overflow:hidden}.slide{margin:0}" : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(opts.title ?? "Carrossel DoctorBrand")}</title>${opts.fontes.links.map((l) => `<link rel="stylesheet" href="${esc(l)}">`).join("")}<style>${opts.fontes.css}\n${DOCTORBRAND_CSS}\n${single}\n${ajustesCss(data.modelo, aj)}</style></head><body><div id="root">${sym}<div class="m-${data.modelo}">${sections}</div></div></body></html>`;
}

/** Troca as fotos do exemplo pelas da pasta do Drive (uma por lâmina, em rodízio). Sem foto, a lâmina sai sem. */
export function comFotos(data: Carrossel, fotos: string[]): Carrossel {
  let n = 0;
  return { ...data, slides: data.slides.map((s) => (s.foto ? { ...s, foto: fotos.length ? fotos[n++ % fotos.length] : undefined } : s)) };
}
