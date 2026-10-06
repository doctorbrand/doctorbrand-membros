"use client";

import Link from "next/link";
import { useState } from "react";
import type { Peca } from "@/lib/claudeGen";
import type { ActionResult } from "@/lib/types";
import { CheckIcon } from "@/components/Icons";

export type Criar = (orderId: string, indices: number[]) => Promise<ActionResult & { criados?: Record<string, string> }>;

const TIPO: Record<string, string> = { reels: "Reels", carrosseis: "Carrossel", pessoais: "Post pessoal", estaticos: "Post estático", stories: "Stories", anuncios: "Anúncio" };
const FEED = new Set(["reels", "carrosseis", "pessoais", "estaticos"]);
const dm = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");
const brl = (usd: number) => `US$ ${usd.toFixed(2).replace(".", ",")}`;

/** Texto corrido de uma peça, para copiar e colar onde for (Docs, WhatsApp, Notion). */
export function pecaTexto(p: Peca): string {
  const out: string[] = [`${TIPO[p.tipo] ?? p.tipo} · ${p.titulo}${p.data ? ` · ${dm(p.data)} ${p.horario}` : ""}`];
  const add = (t: string, v?: string | string[]) => {
    if (Array.isArray(v)) { if (v.filter(Boolean).length) out.push(`${t}:\n${v.filter(Boolean).map((x, i) => `${i + 1}. ${x}`).join("\n")}`); }
    else if (v?.trim()) out.push(`${t}: ${v.trim()}`);
  };
  add("Pilar", p.pilar); add("Serviço", p.servico); add("Objetivo", p.objetivo); add("Gancho", p.gancho); add("Outros ganchos", p.variacoes_gancho);
  add("Roteiro", p.roteiro); add("Slides", p.slides); add("Telas", p.telas); add("Recurso", p.recurso_interativo);
  add("Texto do anúncio", p.anuncio_texto); add("Título", p.anuncio_titulo); add("Botão", p.anuncio_cta); add("Público", p.publico);
  add("Capa / arte", p.capa); add("Direção visual", p.direcao_visual); add("Legenda", p.legenda); add("Aproveita", p.base);
  return out.join("\n");
}

function PecaCard({ p, i, criado, onCriar, busy, slug }: { p: Peca; i: number; criado?: string; onCriar: (i: number) => void; busy: boolean; slug: string }) {
  const [open, setOpen] = useState(false);
  const detalhe = pecaTexto(p).split("\n").slice(1).join("\n");
  return (
    <li className="gn-card">
      <div className="gn-head">
        <span className="pill">{TIPO[p.tipo] ?? p.tipo}</span>
        {p.data && <span className="text-[12.5px] text-[var(--muted)]">{dm(p.data)} · {p.horario}</span>}
        {p.pilar && <span className="text-[12.5px] text-[var(--muted)]">{p.pilar}</span>}
      </div>
      <p className="font-semibold mt-1.5">{p.titulo}</p>
      {p.gancho && <p className="text-sm mt-1">{p.gancho}</p>}
      {p.legenda && !open && <p className="text-[13px] text-[var(--muted)] mt-1 line-clamp-2">{p.legenda}</p>}
      {open && <pre className="gn-pre">{detalhe}</pre>}
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <button type="button" className="ac-act" onClick={() => setOpen((x) => !x)}>{open ? "Fechar" : "Ver tudo"}</button>
        {FEED.has(p.tipo) && (criado
          ? <Link href={`/cliente/${slug}/conteudo?post=${criado}`} className="ac-act is-on"><CheckIcon size={14} /> No planejamento</Link>
          : <button type="button" className="ac-act" disabled={busy} onClick={() => onCriar(i)}>Criar rascunho</button>)}
      </div>
    </li>
  );
}

/** Peças geradas no painel: leitura rápida, copiar e transformar em rascunhos do planejamento. */
export function GeneratedPanel({ slug, orderId, pecas, perguntas, custo, criados, criar, onCriados }: {
  slug: string; orderId: string; pecas: Peca[]; perguntas: string[]; custo?: number; criados: Record<string, string>;
  criar: Criar; onCriados: (c: Record<string, string>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<ActionResult | null>(null);
  const [copied, setCopied] = useState(false);
  const feedPend = pecas.map((p, i) => ({ p, i })).filter(({ p, i }) => FEED.has(p.tipo) && !criados[String(i)]).map(({ i }) => i);

  async function run(indices: number[]) {
    setBusy(true); setMsg(null);
    const r = await criar(orderId, indices).catch((e) => ({ ok: false, message: String(e) } as ActionResult & { criados?: Record<string, string> }));
    setBusy(false); setMsg(r);
    if (r.ok && r.criados) onCriados(r.criados);
  }
  async function copyAll() {
    const txt = [...pecas.map(pecaTexto), ...(perguntas.length ? [`Perguntas para o cliente:\n${perguntas.map((q) => `- ${q}`).join("\n")}`] : [])].join("\n\n---\n\n");
    try { await navigator.clipboard.writeText(txt); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { setCopied(false); }
  }

  return (
    <section className="card p-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Conteúdo gerado</h2>
          <p className="text-sm text-[var(--muted)]">{pecas.length} {pecas.length === 1 ? "peça" : "peças"}{custo !== undefined ? ` · custou cerca de ${brl(custo)} na API` : ""}. Revise antes de produzir: nada vai para o cliente sem passar pela equipe.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="ct-btn" onClick={copyAll}>{copied ? <><CheckIcon /> Copiado</> : "Copiar tudo"}</button>
          {feedPend.length > 0 && <button type="button" className="ct-btn ct-btn-dark" disabled={busy} onClick={() => run(feedPend)}>{busy ? "Criando…" : `Criar ${feedPend.length} ${feedPend.length === 1 ? "rascunho" : "rascunhos"} no planejamento`}</button>}
        </div>
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "g-good" : "g-bad"}`}>{msg.message}{msg.ok && <> <Link href={`/cliente/${slug}/conteudo`} className="underline underline-offset-2">Abrir planejamento</Link></>}</p>}
      <ul className="gn-list">
        {pecas.map((p, i) => <PecaCard key={i} p={p} i={i} criado={criados[String(i)]} onCriar={(x) => run([x])} busy={busy} slug={slug} />)}
      </ul>
      {perguntas.length > 0 && (
        <div className="gn-ask">
          <p className="label mb-1">Perguntas para o cliente</p>
          <ul className="list-disc pl-5 text-sm flex flex-col gap-0.5">{perguntas.map((q, i) => <li key={i}>{q}</li>)}</ul>
        </div>
      )}
    </section>
  );
}
