"use client";

import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SlideFrame } from "@/components/brand/SlideFrame";
import { AJUSTES_LIMITES, AJUSTES_PADRAO, carrosselDoc, cleanAjustes, type AjustesModelo, type Carrossel } from "@/lib/carrossel/doctorbrand";
import type { ActionResult } from "@/lib/types";

type Num = keyof typeof AJUSTES_LIMITES;

const CAMPOS: { key: Num; label: string; unidade: string; passo: number; foto?: boolean; dica: (v: number) => string }[] = [
  { key: "titulo", label: "Títulos", unidade: "%", passo: 5, dica: (v) => (v === 100 ? "como no desenho" : v > 100 ? "maiores" : "menores") },
  { key: "texto", label: "Texto de apoio", unidade: "%", passo: 5, dica: (v) => (v === 100 ? "como no desenho" : v > 100 ? "maior" : "menor") },
  { key: "deslocamento", label: "Posição do texto", unidade: " px", passo: 10, dica: (v) => (v === 0 ? "como no desenho" : v < 0 ? "mais alto" : "mais baixo") },
  { key: "veu", label: "Véu sobre a foto", unidade: "%", passo: 5, foto: true, dica: (v) => (v === 100 ? "como no desenho" : "mais leve") },
  { key: "brilho", label: "Brilho da foto", unidade: "%", passo: 5, foto: true, dica: (v) => (v === 100 ? "como no desenho" : v > 100 ? "mais clara" : "mais escura") },
];

const FOTO: { key: NonNullable<AjustesModelo["foto"]>; label: string }[] = [
  { key: "padrao", label: "Do modelo" },
  { key: "cor", label: "Colorida" },
  { key: "pb", label: "Preto e branco" },
];

/**
 * Ajustes de um modelo fixo, com a prévia de todas as lâminas ao vivo. O desenho continua o da skill;
 * só muda escala, posição do texto e a foto. Salva no kit e vale para a miniatura e para a geração.
 */
export function ModeloAjustes({ deck, nomes, fontes, simbolo, inicial, temFoto, save }: {
  deck: Carrossel;
  /** Nome do tipo de cada lâmina, na ordem. */
  nomes: string[];
  fontes: { css: string; links: string[] };
  simbolo: string;
  inicial: AjustesModelo;
  temFoto: boolean;
  save: (json: string) => Promise<ActionResult>;
}) {
  const [a, setA] = useState<Required<AjustesModelo>>({ ...AJUSTES_PADRAO, ...inicial });
  const [salvo, setSalvo] = useState(JSON.stringify(cleanAjustes(inicial)));
  const [msg, setMsg] = useState<ActionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();
  const router = useRouter();
  const vista = useDeferredValue(a);
  const atual = JSON.stringify(cleanAjustes(a));
  const sujo = atual !== salvo;
  const padrao = atual === "{}";

  const docs = useMemo(() => deck.slides.map((_, i) => carrosselDoc(deck, { fontes, simbolo, only: i, ajustes: vista })), [deck, fontes, simbolo, vista]);

  useEffect(() => {
    if (!sujo) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [sujo]);

  async function onSave() {
    setBusy(true);
    setMsg(null);
    const r = await save(atual).catch((e) => ({ ok: false, message: e instanceof Error ? e.message : "Falhou." }));
    setMsg(r);
    setBusy(false);
    if (r.ok) { setSalvo(atual); start(() => router.refresh()); }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="mf-strip">
        {docs.map((html, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <SlideFrame html={html} title={`Lâmina ${i + 1}`} />
            <span className="text-xs text-[var(--muted)]">{i + 1}. {nomes[i]}</span>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-[var(--line)] p-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="label">Ajustes deste modelo</span>
          <span className="text-xs text-[var(--muted)]">Valem para a miniatura e para os carrosséis gerados com ele.</span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          {CAMPOS.filter((c) => temFoto || !c.foto).map((c) => {
            const [min, max] = AJUSTES_LIMITES[c.key];
            const v = a[c.key];
            return (
              <label key={c.key} className="flex flex-col gap-1.5">
                <span className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">{c.label}</span>
                  <span className="text-xs text-[var(--muted)] tabular-nums">{c.key === "deslocamento" && v > 0 ? "+" : ""}{v}{c.unidade} · {c.dica(v)}</span>
                </span>
                <input type="range" min={min} max={max} step={c.passo} value={v} onChange={(e) => setA((x) => ({ ...x, [c.key]: Number(e.target.value) }))} className="w-full accent-[#1d1d1f]" />
              </label>
            );
          })}
          {temFoto && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Cor da foto</span>
              <div className="te-seg te-seg-sm self-start whitespace-nowrap" role="radiogroup" aria-label="Cor da foto">
                {FOTO.map((f) => (
                  <button key={f.key} type="button" role="radio" aria-checked={a.foto === f.key} className={a.foto === f.key ? "is-on" : ""} onClick={() => setA((x) => ({ ...x, foto: f.key }))}>{f.label}</button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="ct-btn ct-btn-dark" disabled={busy || !sujo} onClick={onSave}>{busy ? "Salvando…" : "Salvar ajustes"}</button>
          <button type="button" className="ct-btn ct-btn-ghost" disabled={busy || padrao} onClick={() => setA({ ...AJUSTES_PADRAO })}>Voltar ao desenho original</button>
          {sujo && !busy && <span className="text-xs text-[var(--muted)]">Ajustes não salvos.</span>}
          {msg && <span className={`text-xs ${msg.ok ? "g-good" : "g-bad"}`}>{msg.message}</span>}
        </div>
      </div>
    </div>
  );
}
