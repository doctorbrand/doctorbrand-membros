"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon, XIcon } from "@/components/Icons";
import { camposTexto, limitePadrao, nomeCampo, rotuloCampo, type CanvaCampo } from "@/lib/brand";

interface Linha { k: number; nome: string; tipo: "text" | "image"; limite: string }

let seq = 0;
const linha = (c?: CanvaCampo): Linha => ({ k: ++seq, nome: c?.nome ?? "", tipo: c?.tipo ?? "text", limite: c?.limite ? String(c.limite) : "" });

/**
 * Lista editável dos textos e fotos de um modelo do Canva. Cada linha é uma coluna da planilha do
 * "Criar em massa". Envia no formulário o campo "campos" no formato de texto que lerCampos entende.
 */
export function CamposEditor({ inicial }: { inicial: CanvaCampo[] }) {
  const [linhas, setLinhas] = useState<Linha[]>(() => (inicial.length ? inicial.map(linha) : [linha({ nome: "capa_titulo", tipo: "text", limite: 10 })]));
  const set = (k: number, p: Partial<Linha>) => setLinhas((ls) => ls.map((l) => (l.k === k ? { ...l, ...p } : l)));
  const mover = (i: number, d: -1 | 1) => setLinhas((ls) => {
    const j = i + d;
    if (j < 0 || j >= ls.length) return ls;
    const n = [...ls];
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });
  const valor = camposTexto(linhas.filter((l) => nomeCampo(l.nome)).map((l) => ({
    nome: nomeCampo(l.nome),
    tipo: l.tipo,
    ...(l.tipo === "text" ? { limite: Number(l.limite) > 0 ? Math.round(Number(l.limite)) : limitePadrao(nomeCampo(l.nome)) } : {}),
  })));

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="campos" value={valor} />
      <ul className="flex flex-col rounded-xl border border-[var(--line)] divide-y divide-[var(--line)]">
        {linhas.map((l, i) => {
          const r = l.nome.trim() ? rotuloCampo(nomeCampo(l.nome)) : null;
          return (
            <li key={l.k} className="flex flex-wrap sm:flex-nowrap items-center gap-2 px-3 py-2">
              <div className="flex flex-col min-w-0 flex-1 basis-full sm:basis-auto">
                <input className="ct-input mono text-[13px]" value={l.nome} placeholder="ex.: capa_titulo" aria-label="Nome da coluna" onChange={(e) => set(l.k, { nome: e.target.value })} />
                <span className="text-xs text-[var(--muted)] mt-1 truncate">{r ? `${r.secao} · ${r.papel}` : "Nome da coluna, igual ao do Canva"}</span>
              </div>
              <div className="flex items-center rounded-full border border-[var(--line)] p-0.5 shrink-0" role="group" aria-label="Tipo">
                {(["text", "image"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => set(l.k, { tipo: t })} aria-pressed={l.tipo === t}
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${l.tipo === t ? "bg-[var(--ink)] text-white" : "text-[var(--muted)]"}`}>{t === "text" ? "Texto" : "Foto"}</button>
                ))}
              </div>
              <label className={`flex items-center gap-1.5 text-xs text-[var(--muted)] shrink-0 ${l.tipo === "image" ? "hidden sm:flex sm:invisible" : ""}`}>
                até
                <input className="ct-input text-center" style={{ width: 64 }} inputMode="numeric" value={l.limite} placeholder={l.nome.trim() ? String(limitePadrao(nomeCampo(l.nome))) : "10"} aria-label="Máximo de palavras" onChange={(e) => set(l.k, { limite: e.target.value.replace(/\D/g, "").slice(0, 3) })} />
                palavras
              </label>
              <div className="flex items-center shrink-0 ml-auto">
                <button type="button" className="ct-icon-btn" aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)}><ChevronUpIcon size={15} /></button>
                <button type="button" className="ct-icon-btn" aria-label="Descer" disabled={i === linhas.length - 1} onClick={() => mover(i, 1)}><ChevronDownIcon size={15} /></button>
                <button type="button" className="ct-icon-btn" aria-label="Tirar" onClick={() => setLinhas((ls) => ls.filter((x) => x.k !== l.k))}><XIcon size={15} /></button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="ct-btn" onClick={() => setLinhas((ls) => [...ls, linha()])}>Adicionar texto ou foto</button>
        <span className="text-xs text-[var(--muted)]">Na ordem das lâminas. O limite de palavras é o que cabe na caixa sem quebrar o desenho.</span>
      </div>
    </div>
  );
}
