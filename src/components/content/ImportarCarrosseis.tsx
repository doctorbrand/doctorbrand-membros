"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRightIcon, DocIcon, UploadIcon, XIcon } from "@/components/Icons";
import { lerCarrosseis } from "@/lib/importCarrosseis";
import type { ActionResult } from "@/lib/types";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * Importar carrosséis já escritos (documento .md ou texto colado). Cada carrossel entra no planejamento em
 * rascunho, com a legenda e o texto de cada slide como estão; o Estúdio de Carrosséis monta no Canva depois.
 */
export function ImportarCarrosseis({ action, defaultStart, everyDays, studio }: {
  action: (texto: string, opts: { start: string; everyDays: number; time: string }) => Promise<ActionResult>;
  defaultStart: string;
  everyDays: number;
  studio: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [doc, setDoc] = useState("");
  const [opts, setOpts] = useState({ start: defaultStart, everyDays, time: "12:00" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<ActionResult | null>(null);
  const lidos = doc.trim() ? lerCarrosseis(doc) : [];

  useEffect(() => {
    if (!open) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = antes; window.removeEventListener("keydown", onKey); };
  }, [open, busy]);

  async function importar() {
    setBusy(true); setMsg(null);
    const r = await action(doc, opts).catch((e) => ({ ok: false, message: e instanceof Error ? e.message : String(e) }));
    setBusy(false); setMsg(r);
    if (r.ok) { setDoc(""); router.refresh(); }
  }

  if (!open) return <button type="button" className="ct-btn" onClick={() => { setOpen(true); setMsg(null); }}><DocIcon size={15} />Importar carrosséis</button>;

  return (
    <div className="fixed inset-0 z-50 bg-black/35 overflow-y-auto sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setOpen(false); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="imp-titulo" className="bg-[var(--card)] w-full sm:max-w-2xl sm:mx-auto min-h-full sm:min-h-0 sm:rounded-[18px] shadow-xl p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="imp-titulo" className="text-lg font-semibold tracking-tight">Importar carrosséis</h2>
            <p className="text-sm text-[var(--muted)]">Os textos entram como estão, cada carrossel em rascunho no planejamento. Depois, o Estúdio monta todos no Canva, no modelo do cliente.</p>
          </div>
          <button type="button" className="ct-icon-btn" aria-label="Fechar" onClick={() => setOpen(false)} disabled={busy}><XIcon size={18} /></button>
        </div>

        {msg?.ok ? (
          <div className="flex flex-col items-start gap-3 py-2">
            <p className="text-sm g-good">{msg.message}</p>
            <div className="flex flex-wrap gap-2">
              <a href={studio} target="_blank" rel="noreferrer" className="ct-btn ct-btn-dark">Abrir Estúdio de Carrosséis<ArrowUpRightIcon size={14} /></a>
              <button type="button" className="ct-btn" onClick={() => { setOpen(false); setMsg(null); }}>Fechar</button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-[var(--muted)]">Formato: cada carrossel começa com “## Título”; cada slide com “**Slide 1 (capa):** frase”, e as linhas dele com “-”. “- Foto:” é a foto indicada e “**Legenda:**”, a legenda.</p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="ct-btn cursor-pointer text-sm"><UploadIcon size={15} />Escolher arquivo (.md ou .txt)
                <input type="file" hidden accept=".md,.txt,.markdown,text/markdown,text/plain" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setDoc(await f.text()); e.target.value = ""; }} />
              </label>
              <span className="text-xs text-[var(--muted)]">ou cole o texto abaixo</span>
            </div>
            <textarea className="ct-input mono text-[12px]" rows={7} value={doc} onChange={(e) => setDoc(e.target.value)} placeholder={"## 01 · Título do carrossel\n**Slide 1 (capa):** Frase da capa\n- Foto: o que vai na foto\n**Slide 2:** Título do slide\n- Texto do slide\n**Slide 3 (CTA):** Chamada final\n- Comenta “PALAVRA”…\n**Legenda:**\nTexto da legenda"} />
            {doc.trim() && (lidos.length ? (
              <ul className="text-sm flex flex-col gap-0.5 max-h-44 overflow-y-auto rounded-xl border border-[var(--line)] p-3">
                {lidos.map((c, i) => <li key={i} className="flex justify-between gap-3"><span className="truncate">{c.titulo}</span><span className="text-[var(--muted)] shrink-0">{plural(c.slides.length, "slide", "slides")}{c.legenda ? " · legenda" : ""}</span></li>)}
              </ul>
            ) : <p className="text-sm g-bad">Não achei carrosséis nesse texto. Confira as linhas “## Título” e “**Slide 1 (capa):**”.</p>)}
            <div className="grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">Primeiro post<input type="date" className="ct-input" value={opts.start} onChange={(e) => setOpts((o) => ({ ...o, start: e.target.value }))} /></label>
              <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">A cada (dias)<input type="number" min={1} max={14} className="ct-input" value={opts.everyDays} onChange={(e) => setOpts((o) => ({ ...o, everyDays: Number(e.target.value) || 1 }))} /></label>
              <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">Horário<input type="time" className="ct-input" value={opts.time} onChange={(e) => setOpts((o) => ({ ...o, time: e.target.value }))} /></label>
            </div>
            <p className="text-xs text-[var(--muted)]">Carrossel com o mesmo título, ainda não publicado, é atualizado em vez de duplicado.</p>
            {msg && !msg.ok && <p className="text-sm g-bad" role="status">{msg.message}</p>}
            <div><button type="button" className="ct-btn ct-btn-dark" disabled={!lidos.length || busy} onClick={importar}>{busy ? "Importando…" : `Importar ${lidos.length ? plural(lidos.length, "carrossel", "carrosséis") : ""}`}</button></div>
          </>
        )}
      </div>
    </div>
  );
}
