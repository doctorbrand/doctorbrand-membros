"use client";

import { useState } from "react";

/**
 * Vídeo leve: mostra a capa e só carrega o vídeo quando a pessoa clica.
 * Drive: player do próprio Drive (streaming adaptativo, não baixa o arquivo inteiro).
 */
export function VideoPlayer({ poster, iframe, src, vertical, label }: { poster?: string; iframe?: string; src?: string; vertical?: boolean; label?: string }) {
  const [play, setPlay] = useState(false);
  const ratio = vertical ? "9 / 16" : "4 / 5";
  if (play && iframe) {
    return <iframe src={iframe} allow="autoplay; fullscreen" allowFullScreen className="w-full rounded-[14px] bg-black block" style={{ aspectRatio: ratio, border: 0 }} title={label ?? "Vídeo"} />;
  }
  if (play && src) {
    return <video src={src} poster={poster} controls autoPlay playsInline className="w-full rounded-[14px] bg-black block" style={{ aspectRatio: ratio, objectFit: "cover" }} />;
  }
  return (
    <button type="button" onClick={() => setPlay(true)} className="relative w-full rounded-[14px] overflow-hidden bg-[#111] block" style={{ aspectRatio: ratio }} aria-label={`Assistir ${label ?? "vídeo"}`}>
      {poster && <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />}
      <span className="absolute inset-0 grid place-items-center">
        <span className="w-16 h-16 rounded-full bg-black/55 grid place-items-center backdrop-blur-sm">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="#fff" aria-hidden><path d="M8 5.5v13l11-6.5z" /></svg>
        </span>
      </span>
      <span className="absolute bottom-2 left-2 text-[11px] font-semibold text-white bg-black/55 rounded-md px-2 py-1">Toque para assistir</span>
    </button>
  );
}
