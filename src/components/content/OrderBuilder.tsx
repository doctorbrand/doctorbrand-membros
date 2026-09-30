"use client";

import { useMemo, useState } from "react";
import type { ActionResult } from "@/lib/types";
import { CheckIcon } from "@/components/Icons";

type TypeDef = { key: string; label: string; hint: string; options: readonly number[] };
type Save = (o: { periodo: string; quantidades: Record<string, number>; servicos: string[]; foco?: string }) => Promise<ActionResult>;

const PERIODOS = ["Próxima semana", "Próximas 2 semanas", "Próximo mês"];

/**
 * Monta o pedido de geração de conteúdo de UM cliente. O pedido leva o perfil atualizado,
 * o plano e o histórico daquele cliente, e nada de outros clientes.
 */
export function OrderBuilder({ types, servicos, context, save, skill }: { types: TypeDef[]; servicos: string[]; context: Record<string, unknown>; save: Save; skill: string }) {
  const [q, setQ] = useState<Record<string, number>>(() => Object.fromEntries(types.map((t) => [t.key, t.key === "reels" ? 4 : t.key === "carrosseis" ? 2 : t.key === "stories" ? 7 : 0])));
  const [periodo, setPeriodo] = useState(PERIODOS[0]);
  const [sel, setSel] = useState<string[]>(servicos.slice(0, 2));
  const [foco, setFoco] = useState("");
  const [copied, setCopied] = useState(false);
  const [res, setRes] = useState<ActionResult | null>(null);
  const total = Object.values(q).reduce((a, b) => a + b, 0);

  const text = useMemo(() => {
    const pedido = {
      periodo,
      quantidades: Object.fromEntries(types.filter((t) => q[t.key] > 0).map((t) => [t.label, q[t.key]])),
      servicos_em_foco: sel,
      observacoes: foco || undefined,
      ...context,
    };
    return [
      `Use a skill ${skill} para gerar o conteúdo deste cliente.`,
      `Cliente: ${String((context.cliente as { nome?: string })?.nome ?? "")}. Trabalhe só com os dados deste pedido e com as fontes deste cliente; não misture com outros clientes.`,
      "",
      "```json",
      JSON.stringify(pedido, null, 1),
      "```",
    ].join("\n");
  }, [q, periodo, sel, foco, context, types, skill]);

  async function copy() {
    setRes(null);
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { setCopied(false); }
    const r = await save({ periodo, quantidades: q, servicos: sel, foco }).catch((e) => ({ ok: false, message: String(e) }));
    setRes(r);
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Quantidades</h2>
          <span className="text-sm text-[var(--muted)]">{total} peças no total</span>
        </div>
        {types.map((t) => (
          <div key={t.key} className="grid sm:grid-cols-[220px_1fr] gap-2 items-center">
            <div><p className="text-sm font-medium">{t.label}</p><p className="text-xs text-[var(--muted)]">{t.hint}</p></div>
            <div className="flex flex-wrap gap-1.5">
              {t.options.map((n) => (
                <button key={n} type="button" onClick={() => setQ({ ...q, [t.key]: n })}
                  className={`ct-seg ${q[t.key] === n ? "is-on" : ""}`}>{n === 0 ? "Nenhum" : n}</button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="card p-5 grid md:grid-cols-2 gap-5">
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold">Período</h2>
          <div className="flex flex-wrap gap-1.5">{PERIODOS.map((p) => <button key={p} type="button" onClick={() => setPeriodo(p)} className={`ct-seg ${periodo === p ? "is-on" : ""}`}>{p}</button>)}</div>
          <h2 className="font-semibold mt-3">Observações</h2>
          <textarea className="ct-input" rows={4} value={foco} onChange={(e) => setFoco(e.target.value)} placeholder="Ex.: campanha de fim de ano, gravação no dia 12, evitar falar de preço" />
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold">Serviços em foco</h2>
          {servicos.length === 0 && <p className="text-sm text-[var(--muted)]">Preencha os serviços no Perfil do cliente.</p>}
          <div className="flex flex-col gap-1">
            {servicos.map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={sel.includes(s)} onChange={(e) => setSel(e.target.checked ? [...sel, s] : sel.filter((x) => x !== s))} /> {s}
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="card p-5 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Pedido para o Claude</h2>
            <p className="text-sm text-[var(--muted)]">Copie e cole numa conversa com o Claude. O pedido já leva o perfil, o plano e o que já foi planejado deste cliente.</p>
          </div>
          <button type="button" className="ct-btn ct-btn-dark" disabled={total === 0} onClick={copy}>{copied ? <><CheckIcon /> Copiado</> : "Copiar pedido"}</button>
        </div>
        {res && !res.ok && <p className="text-sm g-bad">{res.message}</p>}
        <details className="text-sm"><summary className="cursor-pointer text-[var(--muted)]">Ver o pedido</summary><pre className="mt-2 p-3 rounded-lg bg-[#f6f5f1] overflow-auto text-xs whitespace-pre-wrap max-h-96">{text}</pre></details>
      </section>
    </div>
  );
}
