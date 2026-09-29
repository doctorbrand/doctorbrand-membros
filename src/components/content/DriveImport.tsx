"use client";

import { useState } from "react";
import type { ActionResult } from "@/lib/types";

type Opts = { start: string; everyDays: number; times: string[]; send: boolean };

/**
 * Importa a pasta do mês no Drive: uma subpasta por post (post-01-…, post-02-…) com as imagens ou o vídeo,
 * legenda.txt, capa.jpg (Reels) e, se quiser, agenda.txt com data e hora. As mídias ficam no Drive (leves)
 * e o original é copiado só na hora de publicar.
 */
export function DriveImport({ action, defaultStart, everyDays }: { action: (link: string, opts: Opts) => Promise<ActionResult>; defaultStart: string; everyDays: number }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [start, setStart] = useState(defaultStart);
  const [gap, setGap] = useState(everyDays);
  const [times, setTimes] = useState("12:00, 18:30");
  const [send, setSend] = useState(true);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<ActionResult | null>(null);

  async function run() {
    setBusy(true); setRes(null);
    try {
      setRes(await action(link, { start, everyDays: gap, times: times.split(/[,\s]+/).filter((t) => /^\d{2}:\d{2}$/.test(t)), send }));
    } catch (e) {
      setRes({ ok: false, message: e instanceof Error ? e.message : String(e) });
    } finally { setBusy(false); }
  }

  if (!open) return <button type="button" className="ct-btn" onClick={() => setOpen(true)}>Importar pasta do Drive</button>;

  return (
    <section className="card p-4 flex flex-col gap-3 w-full">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <p className="font-medium">Importar pasta do mês no Drive</p>
        <button type="button" className="text-sm text-[var(--muted)]" onClick={() => setOpen(false)}>Fechar</button>
      </div>
      <p className="text-sm text-[var(--muted)]">Cole o link da pasta do mês (compartilhada como “qualquer pessoa com o link”). Cada subpasta vira um post, na ordem do nome: <b>post-01-…</b>, <b>post-02-…</b>. Dentro: imagens numeradas ou o vídeo, <b>legenda.txt</b>, <b>capa.jpg</b> no Reels e, se quiser, <b>agenda.txt</b> com data e hora.</p>
      <input className="ct-input" placeholder="https://drive.google.com/drive/folders/…" value={link} onChange={(e) => setLink(e.target.value)} />
      <div className="flex flex-wrap gap-3 items-end">
        <label className="flex flex-col gap-1"><span className="label">Primeiro post em</span><input type="date" className="ct-input" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label className="flex flex-col gap-1"><span className="label">A cada (dias)</span><input type="number" min={1} max={14} className="ct-input w-24" value={gap} onChange={(e) => setGap(Number(e.target.value) || 1)} /></label>
        <label className="flex flex-col gap-1"><span className="label">Horários (alternam)</span><input className="ct-input w-40" value={times} onChange={(e) => setTimes(e.target.value)} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} /> Já enviar para o cliente aprovar</label>
        <button type="button" className="ct-btn ct-btn-dark" disabled={busy || !link.trim()} onClick={run}>{busy ? "Lendo a pasta…" : "Importar"}</button>
      </div>
      <p className="text-xs text-[var(--muted)]">Quem tem agenda.txt usa a data de lá. Os demais seguem a distribuição acima.</p>
      {res && <p className={`text-sm ${res.ok ? "g-good" : "g-bad"}`}>{res.message}</p>}
    </section>
  );
}
