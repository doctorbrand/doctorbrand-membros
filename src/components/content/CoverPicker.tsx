"use client";

import { useEffect, useRef, useState } from "react";
import type { ActionResult } from "@/lib/types";
import { uploadMedia } from "./upload";

type SetCover = (coverJson: string, offsetMs: number | null) => Promise<ActionResult>;

/**
 * Escolha de capa do Reels, como no planner da Meta: arrasta o vídeo até o frame e vê,
 * ao lado, como fica no grid do perfil (3:4) e na aba Reels (9:16). Também aceita imagem enviada.
 * O vídeo só carrega quando a pessoa abre o seletor.
 */
export function CoverPicker({ slug, postId, videoSrc, current, setCover, local }: { slug: string; postId: string; videoSrc: string; current?: string; setCover: SetCover; local: boolean }) {
  const [open, setOpen] = useState(false);
  const [dur, setDur] = useState(0);
  const [t, setT] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<ActionResult | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  // Desenha o frame atual para as prévias (grid e Reels).
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const draw = () => {
      const c = canvas.current;
      if (!c || !v.videoWidth) return;
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext("2d")?.drawImage(v, 0, 0);
      try { setPreview(c.toDataURL("image/jpeg", 0.7)); } catch { setPreview(null); }
    };
    v.addEventListener("seeked", draw);
    v.addEventListener("loadeddata", draw);
    return () => { v.removeEventListener("seeked", draw); v.removeEventListener("loadeddata", draw); };
  }, [open]);

  async function save(file: Blob, offsetMs: number | null) {
    setBusy("Salvando capa…"); setMsg(null);
    try {
      const path = await uploadMedia(`content-media/${slug}/covers/${postId}.jpg`, file, local);
      const r = await setCover(JSON.stringify([{ path, kind: "image", mime: "image/jpeg", name: "capa.jpg" }]), offsetMs);
      setMsg(r);
      if (r.ok) setOpen(false);
    } catch (e) {
      setMsg({ ok: false, message: e instanceof Error ? e.message : String(e) });
    } finally { setBusy(null); }
  }

  function pickFrame() {
    const c = canvas.current;
    if (!c || !c.width) return setMsg({ ok: false, message: "O vídeo ainda está carregando." });
    c.toBlob((b) => { if (b) save(b, Math.round(t * 1000)); }, "image/jpeg", 0.92);
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        {current && <img src={current} alt="Capa atual" className="w-12 h-16 object-cover rounded-md" />}
        <button type="button" className="ct-btn" onClick={() => setOpen(true)}>{current ? "Trocar capa" : "Escolher capa"}</button>
        {msg && <span className={`text-xs ${msg.ok ? "g-good" : "g-bad"}`}>{msg.message}</span>}
      </div>
    );
  }

  const frame = preview ?? current;
  return (
    <div className="card p-3 flex flex-col gap-3">
      <div className="flex flex-wrap gap-4 items-start">
        <div className="flex flex-col gap-1">
          <span className="label">Vídeo</span>
          <video ref={video} src={videoSrc} muted playsInline preload="auto" className="w-40 rounded-lg bg-black" style={{ aspectRatio: "9 / 16", objectFit: "cover" }}
            onLoadedMetadata={(e) => { const d = e.currentTarget.duration; setDur(Number.isFinite(d) ? d : 0); e.currentTarget.currentTime = Math.min(0.5, d / 2 || 0); }} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="label">No grid do perfil (3:4)</span>
          <div className="w-32 rounded-md overflow-hidden bg-[#eee]" style={{ aspectRatio: "3 / 4" }}>{frame && <img src={frame} alt="" className="w-full h-full object-cover" />}</div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="label">Na aba Reels (9:16)</span>
          <div className="w-28 rounded-md overflow-hidden bg-[#eee]" style={{ aspectRatio: "9 / 16" }}>{frame && <img src={frame} alt="" className="w-full h-full object-cover" />}</div>
        </div>
      </div>
      <canvas ref={canvas} hidden />
      <label className="flex flex-col gap-1">
        <span className="label">Arraste até o frame da capa · {t.toFixed(1)}s{dur ? ` de ${dur.toFixed(0)}s` : ""}</span>
        <input type="range" min={0} max={dur || 1} step={0.1} value={t} disabled={!dur}
          onChange={(e) => { const v = Number(e.target.value); setT(v); if (video.current) video.current.currentTime = v; }} />
      </label>
      <div className="flex flex-wrap gap-2 items-center">
        <button type="button" className="ct-btn ct-btn-dark" disabled={!!busy || !dur} onClick={pickFrame}>Usar este frame</button>
        <label className={`ct-btn ${busy ? "opacity-50" : "cursor-pointer"}`}>Enviar imagem (JPG)
          <input type="file" hidden accept="image/jpeg" disabled={!!busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) save(f, null); e.target.value = ""; }} />
        </label>
        <button type="button" className="ct-btn" onClick={() => setOpen(false)}>Fechar</button>
        {busy && <span className="text-xs text-[var(--muted)]">{busy}</span>}
        {!dur && !busy && <span className="text-xs text-[var(--muted)]">Carregando o vídeo…</span>}
        {msg && <span className={`text-xs ${msg.ok ? "g-good" : "g-bad"}`}>{msg.message}</span>}
      </div>
      <p className="text-xs text-[var(--muted)]">A capa é o que aparece no grid. O recorte 3:4 é o do perfil do Instagram hoje.</p>
    </div>
  );
}
