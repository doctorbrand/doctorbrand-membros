"use client";

import { useState } from "react";
import type { ActionResult } from "@/lib/types";

type Opts = { start: string; everyDays: number; times: string[]; send: boolean };

const EXEMPLO = `## Antes e depois não escolhe cirurgião | 06/10 12:00
https://drive.google.com/file/d/…
Todo mundo escolhe cirurgião pelo antes e depois. É o pior jeito possível.

## Carrossel da caneta | 09/10 12:00
https://drive.google.com/drive/folders/…
A caneta não é estilo…`;

/** Cola uma lista de posts (do Notion, de um documento) com links do Drive e legenda. */
export function ListImport({ action, defaultStart, everyDays }: { action: (text: string, opts: Opts) => Promise<ActionResult>; defaultStart: string; everyDays: number }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [start, setStart] = useState(defaultStart);
  const [gap, setGap] = useState(everyDays);
  const [send, setSend] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<ActionResult | null>(null);

  async function run() {
    setBusy(true); setRes(null);
    try { setRes(await action(text, { start, everyDays: gap, times: ["12:00"], send })); }
    catch (e) { setRes({ ok: false, message: e instanceof Error ? e.message : String(e) }); }
    finally { setBusy(false); }
  }

  if (!open) return <button type="button" className="ct-btn" onClick={() => setOpen(true)}>Colar lista de posts</button>;

  return (
    <section className="card p-4 flex flex-col gap-3 w-full">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <p className="font-medium">Colar lista de posts</p>
        <button type="button" className="text-sm text-[var(--muted)]" onClick={() => setOpen(false)}>Fechar</button>
      </div>
      <p className="text-sm text-[var(--muted)]">Cada post começa com <b>## Título | data e hora</b>. Embaixo, os links do Drive (o vídeo, ou a pasta do carrossel) e a legenda. Os arquivos precisam estar compartilhados como “qualquer pessoa com o link”.</p>
      <textarea className="ct-input font-mono text-[12.5px]" rows={12} placeholder={EXEMPLO} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex flex-wrap gap-3 items-end">
        <label className="flex flex-col gap-1"><span className="label">Sem data: começa em</span><input type="date" className="ct-input" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label className="flex flex-col gap-1"><span className="label">A cada (dias)</span><input type="number" min={1} max={14} className="ct-input w-24" value={gap} onChange={(e) => setGap(Number(e.target.value) || 1)} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} /> Já enviar para o cliente aprovar</label>
        <button type="button" className="ct-btn ct-btn-dark" disabled={busy || !text.trim()} onClick={run}>{busy ? "Lendo o Drive…" : "Importar"}</button>
      </div>
      {res && <p className={`text-sm ${res.ok ? "g-good" : "g-bad"}`}>{res.message}</p>}
    </section>
  );
}
