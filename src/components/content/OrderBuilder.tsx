"use client";

import { useMemo, useState } from "react";
import type { ActionResult } from "@/lib/types";
import { CheckIcon } from "@/components/Icons";
import { GeneratedPanel, type Criar } from "@/components/content/GeneratedPanel";
import type { Peca } from "@/lib/claudeGen";

type TypeDef = { key: string; label: string; hint: string; options: readonly number[] };
type Save = (o: { periodo: string; quantidades: Record<string, number>; servicos: string[]; foco?: string; texto?: string }) => Promise<ActionResult & { link?: string; id?: string }>;
type Gerar = (orderId: string, tipo: string, n: number) => Promise<ActionResult & { pecas?: Peca[]; perguntas?: string[]; custo?: number }>;
export interface Ultima { id: string; pecas: Peca[]; perguntas: string[]; custo: number; criados: Record<string, string> }

/** Peças por chamada: Reels e anúncios são longos; o resto cabe mais por vez. */
const LOTE: Record<string, number> = { reels: 2, anuncios: 4, carrosseis: 3, pessoais: 4, estaticos: 4, stories: 5 };

const PERIODOS = ["Próxima semana", "Próximas 2 semanas", "Próximo mês"];

/**
 * Monta o pedido de geração de conteúdo de UM cliente. O pedido leva o perfil atualizado,
 * o plano e o histórico daquele cliente, e nada de outros clientes.
 */
export function OrderBuilder({ types, servicos, context, save, skill, slug, apiOn, gerar, criar, ultima }: {
  types: TypeDef[]; servicos: string[]; context: Record<string, unknown>; save: Save; skill: string;
  slug: string; apiOn: boolean; gerar: Gerar; criar: Criar; ultima?: Ultima;
}) {
  const [q, setQ] = useState<Record<string, number>>(() => Object.fromEntries(types.map((t) => [t.key, t.key === "reels" ? 4 : t.key === "carrosseis" ? 2 : t.key === "stories" ? 7 : 0])));
  const [periodo, setPeriodo] = useState(PERIODOS[0]);
  const [sel, setSel] = useState<string[]>(servicos.slice(0, 2));
  const [foco, setFoco] = useState("");
  const [copied, setCopied] = useState(false);
  const [res, setRes] = useState<ActionResult | null>(null);
  const [gen, setGen] = useState<Ultima | undefined>(ultima);
  const [progress, setProgress] = useState<string | null>(null);
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
      JSON.stringify(pedido),
      "```",
    ].join("\n");
  }, [q, periodo, sel, foco, context, types, skill]);

  /** Registra o pedido e abre uma conversa nova no Claude já escrita: ela aponta para o pedido completo por um link assinado. */
  async function openClaude() {
    setRes(null);
    const win = window.open("about:blank", "_blank");
    const r = await save({ periodo, quantidades: q, servicos: sel, foco, texto: text }).catch((e) => ({ ok: false, message: String(e) } as ActionResult & { link?: string }));
    if (!r.ok || !r.link) { win?.close(); setRes(r); return; }
    const nome = String((context.cliente as { nome?: string })?.nome ?? "");
    const resumo = types.filter((t) => q[t.key] > 0).map((t) => `${q[t.key]} ${t.label.toLowerCase()}`).join(", ");
    const prompt = [
      `Use a skill ${skill} para gerar o conteúdo de ${nome} (${periodo}): ${resumo}.`,
      `O pedido completo deste cliente, com perfil, plano e histórico, está neste link. Leia o conteúdo inteiro antes de começar:`,
      `${window.location.origin}${r.link}`,
      `Trabalhe só com este cliente; não misture com outros.`,
    ].join("\n");
    const url = `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
    if (win) win.location.href = url; else window.open(url, "_blank");
    setRes({ ok: true, message: "Pedido registrado e conversa aberta no Claude. É só enviar." });
  }

  /** Gera aqui mesmo, pela API do Claude: um tipo por vez, em lotes pequenos, mostrando o andamento. */
  async function gerarAqui() {
    setRes(null);
    setProgress("Registrando o pedido…");
    const r = await save({ periodo, quantidades: q, servicos: sel, foco, texto: text }).catch((e) => ({ ok: false, message: String(e) } as ActionResult & { id?: string }));
    if (!r.ok || !r.id) { setProgress(null); setRes(r); return; }
    const atual: Ultima = { id: r.id, pecas: [], perguntas: [], custo: 0, criados: {} };
    setGen({ ...atual });
    let erro: string | null = null;
    for (const t of types) {
      const total = q[t.key] ?? 0;
      for (let feito = 0; feito < total && !erro; ) {
        const n = Math.min(LOTE[t.key] ?? 3, total - feito);
        setProgress(`Gerando ${t.label.toLowerCase()}: ${feito + 1}${n > 1 ? ` a ${feito + n}` : ""} de ${total}…`);
        const lote = await gerar(r.id, t.key, n).catch((e) => ({ ok: false, message: String(e) } as Awaited<ReturnType<Gerar>>));
        if (!lote.ok || !lote.pecas) { erro = lote.message; break; }
        atual.pecas = [...atual.pecas, ...lote.pecas];
        atual.perguntas = [...new Set([...atual.perguntas, ...(lote.perguntas ?? [])])];
        atual.custo += lote.custo ?? 0;
        setGen({ ...atual });
        feito += n;
      }
      if (erro) break;
    }
    setProgress(null);
    setRes(erro ? { ok: false, message: `${erro}${atual.pecas.length ? ` As ${atual.pecas.length} peças já geradas ficaram salvas abaixo.` : ""}` } : { ok: true, message: `Pronto: ${atual.pecas.length} peças geradas.` });
  }

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
            <p className="text-sm text-[var(--muted)]">{apiOn
              ? "Gerar aqui cria as peças no próprio painel, pela API do Claude, e você transforma em rascunhos do planejamento. O pedido leva o perfil, o plano e o que já foi planejado deste cliente."
              : "Gerar no Claude abre uma conversa nova com o pedido já escrito: é só enviar. O pedido leva o perfil, o plano e o que já foi planejado deste cliente."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="ct-btn" disabled={total === 0} onClick={copy}>{copied ? <><CheckIcon /> Copiado</> : "Copiar pedido"}</button>
            <button type="button" className={`ct-btn ${apiOn ? "" : "ct-btn-dark"}`} disabled={total === 0 || !!progress} onClick={openClaude}>Gerar no Claude</button>
            {apiOn && <button type="button" className="ct-btn ct-btn-dark" disabled={total === 0 || !!progress} onClick={gerarAqui}>{progress ? "Gerando…" : "Gerar aqui"}</button>}
          </div>
        </div>
        {progress && <p className="text-sm text-[var(--muted)]" aria-live="polite">{progress} Pode levar alguns minutos; não feche a página.</p>}
        {res && <p className={`text-sm ${res.ok ? "text-[var(--muted)]" : "g-bad"}`}>{res.message}</p>}
        <details className="text-sm"><summary className="cursor-pointer text-[var(--muted)]">Ver o pedido</summary><pre className="mt-2 p-3 rounded-lg bg-[#f6f5f1] overflow-auto text-xs whitespace-pre-wrap max-h-96">{text}</pre></details>
      </section>

      {gen && gen.pecas.length > 0 && (
        <GeneratedPanel slug={slug} orderId={gen.id} pecas={gen.pecas} perguntas={gen.perguntas} custo={gen.custo} criados={gen.criados}
          criar={criar} onCriados={(c) => setGen((g) => (g ? { ...g, criados: c } : g))} />
      )}
    </div>
  );
}
