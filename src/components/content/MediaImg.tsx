"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Imagem do post. Se não carregar (arquivo do Drive sem acesso por link, por exemplo no celular
 * sem login no Google), mostra um aviso limpo no lugar do ícone quebrado do navegador.
 */
export function MediaImg({ src, alt = "", small, ...rest }: { src?: string; alt?: string; small?: boolean; loading?: "lazy" | "eager"; draggable?: boolean; className?: string }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // A imagem pode falhar antes de a página ficar interativa (o onError se perde): confere ao montar.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [src]);
  if (!src || failed) {
    return (
      <span className={`ct-noimg ${small ? "is-small" : ""} ${rest.className ?? ""}`} role="img" aria-label="Imagem indisponível">
        <svg viewBox="0 0 24 24" width={small ? 16 : 22} height={small ? 16 : 22} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M3.5 16l4.5-4.5 4 4 2.5-2.5 6 6" /><path d="M3 3l18 18" />
        </svg>
        {!small && <span>Sem acesso no Drive</span>}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} src={src} alt={alt} onError={() => setFailed(true)} {...rest} />;
}
