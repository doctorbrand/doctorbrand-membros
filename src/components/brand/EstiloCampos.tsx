"use client";

import { useState } from "react";
import { LaminaPreview } from "@/components/content/LaminaPreview";
import { BASES, corValida, ESTILO_PADRAO, type Estilo, type Lamina } from "@/lib/laminas";

const EXEMPLO: Lamina[] = [
  { tipo: "capa", titulo: "Título da capa com *ênfase*", subtitulo: "subtítulo em itálico", descricao: "" },
  { tipo: "slide", titulo: "1. Título do *slide*", subtitulo: "", descricao: "Descrição do slide, com o texto de apoio. **A frase mais importante em negrito.**" },
  { tipo: "final", titulo: "Chamada da tela final", subtitulo: "Comente PALAVRA", descricao: "Texto de apoio da chamada." },
];

const CORES: { k: keyof Estilo["cores"]; nome: string }[] = [
  { k: "fundo", nome: "Fundo" },
  { k: "texto", nome: "Texto" },
  { k: "destaque", nome: "Destaque" },
  { k: "suave", nome: "Detalhes" },
];

/** Campos de um modelo de carrossel com prévia ao vivo (capa, slide e tela final). Vai dentro de um ActionForm. */
export function EstiloCampos({ inicial }: { inicial?: Estilo }) {
  const [e, setE] = useState<Estilo>(inicial ?? { ...ESTILO_PADRAO, id: "novo", titulo: "" });
  const set = (p: Partial<Estilo>) => setE((x) => ({ ...x, ...p }));
  const cor = (k: keyof Estilo["cores"], v: string) => setE((x) => ({ ...x, cores: { ...x.cores, [k]: v } }));
  const vista: Estilo = { ...e, cores: Object.fromEntries(Object.entries(e.cores).map(([k, v]) => [k, corValida(v) ? v : (ESTILO_PADRAO.cores as Record<string, string>)[k]])) as Estilo["cores"] };

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_auto] gap-5">
      <div className="flex flex-col gap-4 min-w-0">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1"><span className="label">Nome</span><input name="titulo" value={e.titulo} onChange={(x) => set({ titulo: x.target.value })} placeholder="ex.: Autoridade" className="ct-input" /></label>
          <label className="flex flex-col gap-1"><span className="label">Assinatura no canto</span><input name="rodape" value={e.rodape ?? ""} onChange={(x) => set({ rodape: x.target.value })} placeholder="ex.: @perfil" className="ct-input" /></label>
        </div>

        <div className="flex flex-col gap-2">
          <span className="label">Desenho</span>
          <div className="grid sm:grid-cols-3 gap-2">
            {BASES.map((b) => (
              <label key={b.id} className={`rounded-xl border p-3 flex flex-col gap-0.5 cursor-pointer ${e.base === b.id ? "border-[var(--ink)] ring-1 ring-[var(--ink)]" : "border-[var(--line)]"}`}>
                <input type="radio" name="base" value={b.id} checked={e.base === b.id} onChange={() => set({ base: b.id })} className="sr-only" />
                <span className="text-sm font-medium">{b.nome}</span>
                <span className="text-xs text-[var(--muted)]">{b.desc}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="label">Cores</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CORES.map((c) => (
              <label key={c.k} className="flex items-center gap-2 rounded-xl border border-[var(--line)] p-2">
                <input type="color" value={corValida(e.cores[c.k]) ? e.cores[c.k] : "#000000"} onChange={(x) => cor(c.k, x.target.value)} className="w-8 h-8 rounded-md border-0 p-0 bg-transparent cursor-pointer shrink-0" aria-label={`Cor: ${c.nome}`} />
                <span className="flex flex-col min-w-0">
                  <span className="text-xs text-[var(--muted)]">{c.nome}</span>
                  <input name={`cor_${c.k}`} value={e.cores[c.k]} onChange={(x) => cor(c.k, x.target.value.trim())} className="mono text-[12px] w-full bg-transparent outline-none" maxLength={7} aria-label={`Código da cor: ${c.nome}`} />
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1"><span className="label">Fonte dos títulos</span><input name="fonte_titulo" value={e.fontes.titulo} onChange={(x) => set({ fontes: { ...e.fontes, titulo: x.target.value } })} className="ct-input" /></label>
          <label className="flex flex-col gap-1"><span className="label">Fonte dos textos</span><input name="fonte_texto" value={e.fontes.texto} onChange={(x) => set({ fontes: { ...e.fontes, texto: x.target.value } })} className="ct-input" /></label>
        </div>
        <p className="text-xs text-[var(--muted)] -mt-2">Escreva o nome igual ao do Canva (Brand Kit). Aqui na prévia aparece uma letra parecida.</p>

        <div className="flex flex-wrap gap-4 text-sm">
          <label className="inline-flex items-center gap-2"><input type="checkbox" name="caixaAlta" checked={!!e.tituloCaixaAlta} onChange={(x) => set({ tituloCaixaAlta: x.target.checked })} className="w-4 h-4 accent-[var(--accent)]" />Títulos em caixa alta</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" name="fotoPB" checked={!!e.fotoPB} onChange={(x) => set({ fotoPB: x.target.checked })} className="w-4 h-4 accent-[var(--accent)]" />Fotos em preto e branco</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" name="numerar" checked={!e.semNumero} onChange={(x) => set({ semNumero: !x.target.checked })} className="w-4 h-4 accent-[var(--accent)]" />Número do slide (01, 02…)</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" name="arredondar" checked={(e.raioFoto ?? (e.base === "revista" ? 22 : 0)) > 0} onChange={(x) => set({ raioFoto: x.target.checked ? 22 : 0 })} className="w-4 h-4 accent-[var(--accent)]" />Fotos com cantos arredondados</label>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
        {EXEMPLO.map((_, i) => <LaminaPreview key={i} itens={EXEMPLO} i={i} estilo={vista} largura={150} className="rounded-md ring-1 ring-[var(--line)]" />)}
      </div>
    </div>
  );
}
