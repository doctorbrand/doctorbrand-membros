"use client";

import { useEffect, useRef, useState } from "react";
import { SLIDE_H, SLIDE_W } from "@/lib/brand";

/**
 * Uma lâmina de 1080 × 1350 desenhada pelo HTML do modelo, encolhida para a largura do cartão.
 * O iframe isola o CSS do modelo do resto da página; a escala acompanha a largura (ResizeObserver).
 */
export function SlideFrame({ html, title, className }: { html: string; title: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / SLIDE_W);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={box} className={`sf-box ${className ?? ""}`}>
      {scale > 0 && (
        <iframe title={title} srcDoc={html} width={SLIDE_W} height={SLIDE_H} loading="lazy" tabIndex={-1}
          style={{ transform: `scale(${scale})` }} className="sf-frame" />
      )}
    </div>
  );
}
