"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Vídeo leve: mostra a capa e só carrega o vídeo quando a pessoa clica.
 * Player nativo no formato do post (9:16 no Reels); o do Drive só como reserva.
 */
export function VideoPlayer({ poster, iframe, src, vertical, label }: { poster?: string; iframe?: string; src?: string; vertical?: boolean; label?: string }) {
  const [play, setPlay] = useState(false);
  const [nativeFailed, setNativeFailed] = useState(false);
  const ratio = vertical ? "9 / 16" : "4 / 5";
  if (play && src && !nativeFailed) {
    return <video src={src} poster={poster} controls autoPlay playsInline onError={() => iframe && setNativeFailed(true)} className="w-full rounded-[14px] bg-black block" style={{ aspectRatio: ratio, objectFit: "cover" }} />;
  }
  if (play && iframe) return <DriveFrame src={iframe} vertical={vertical} label={label} />;
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

/**
 * Player do Drive (reserva quando o arquivo não é público). Ele tem largura mínima própria e, numa coluna
 * estreita, o vídeo escapa para a direita com uma faixa preta à esquerda. Por isso o iframe é desenhado
 * numa largura confortável, no formato exato do post, e reduzido em escala até caber inteiro na moldura.
 */
function DriveFrame({ src, vertical, label }: { src: string; vertical?: boolean; label?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const baseW = vertical ? 405 : 480;
  const baseH = vertical ? 720 : 600;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    setW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  const scale = w ? w / baseW : 0;
  return (
    <div ref={box} className="relative w-full rounded-[14px] overflow-hidden bg-black" style={{ aspectRatio: vertical ? "9 / 16" : "4 / 5" }}>
      {scale > 0 && (
        <iframe
          src={src} allow="autoplay; fullscreen" allowFullScreen title={label ?? "Vídeo"}
          style={{ position: "absolute", top: 0, left: 0, width: baseW, height: baseH, border: 0, transform: `scale(${scale})`, transformOrigin: "0 0" }}
        />
      )}
    </div>
  );
}
