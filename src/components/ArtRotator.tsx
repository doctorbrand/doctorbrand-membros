"use client";

import { useEffect, useState } from "react";
import { MONET } from "@/lib/art";



const INTERVAL = 7000;

/**
 * Painel com as obras trocando sozinhas (fade suave). Só carrega a obra atual e a próxima,
 * para não pesar no celular.
 */
export function ArtRotator({ start = 0, chip, logo, quote }: { start?: number; chip: React.ReactNode; logo: React.ReactNode; quote: string }) {
  const [i, setI] = useState(start % MONET.length);
  const [seen, setSeen] = useState<Set<number>>(() => new Set([start % MONET.length, (start + 1) % MONET.length]));

  useEffect(() => {
    const t = setInterval(() => {
      setI((cur) => {
        const next = (cur + 1) % MONET.length;
        setSeen((s) => new Set([...s, next, (next + 1) % MONET.length]));
        return next;
      });
    }, INTERVAL);
    return () => clearInterval(t);
  }, []);

  const art = MONET[i];
  return (
    <>
      {MONET.map((a, k) => seen.has(k) && (
        <img key={a.id} src={`/login/monet-${a.id}.jpg`} srcSet={`/login/monet-${a.id}-sm.jpg 720w, /login/monet-${a.id}.jpg 1080w`} sizes="(max-width: 860px) 100vw, 560px"
          alt="" className={`db-login-art ${k === i ? "is-on" : ""}`} decoding="async" />
      ))}
      {chip}
      <div className="db-art-foot">
        <p className="db-art-quote">{quote}</p>
        <div className="db-art-meta">
          {logo}
          <div className="flex items-center gap-3 min-w-0">
            <span className="truncate"><span className="db-art-artist">Claude Monet · </span>{art.title}, {art.year}</span>
            <span className="db-art-dots" aria-hidden>
              {MONET.map((a, k) => <button key={a.id} type="button" tabIndex={-1} className={k === i ? "is-on" : ""} onClick={() => { setSeen((s) => new Set([...s, k, (k + 1) % MONET.length])); setI(k); }} />)}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
