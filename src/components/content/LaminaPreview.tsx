"use client";

import { desenhar, H, W, type Estilo, type Lamina } from "@/lib/laminas";
import { mediaUrl } from "@/lib/content-media";

const familia = (fonte: string, serifa: boolean) => `"${fonte.replace(/"/g, "")}", ${serifa ? "Georgia, 'Times New Roman', serif" : "Inter, system-ui, -apple-system, sans-serif"}`;

/**
 * Prévia de uma lâmina, desenhada com os mesmos elementos do arquivo do Canva. As fontes do Canva
 * (ex.: Denton) aparecem aqui com uma parecida quando o navegador não as tem.
 */
export function LaminaPreview({ itens, i, estilo, largura = 240, className = "" }: { itens: Lamina[]; i: number; estilo: Estilo; largura?: number; className?: string }) {
  const s = largura / W;
  const els = desenhar(itens, i, estilo);
  return (
    <div className={`relative overflow-hidden shrink-0 ${className}`} style={{ width: largura, height: H * s }} aria-hidden>
      {els.map((e, j) => {
        const base = { position: "absolute" as const, left: e.x * s, top: e.y * s, width: e.w * s, height: e.h * s };
        if (e.k === "rect") return <div key={j} style={{ ...base, background: e.borda ? "transparent" : e.cor, opacity: e.alfa ?? 1, border: e.borda ? `${Math.max(1, 1.5 * s)}px solid ${e.borda}` : undefined, borderRadius: e.elipse ? "9999px" : e.raio ? e.raio * s : undefined }} />;
        if (e.k === "vaga") return (
          <div key={j} style={{ ...base, background: e.cor, borderRadius: e.raio ? e.raio * s : undefined, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 * s, padding: 40 * s, textAlign: "center", color: e.corTexto, fontFamily: familia(e.fonte, false) }}>
            <span style={{ fontSize: 18 * s, letterSpacing: 4 * s, fontWeight: 600 }}>FOTO</span>
            <span style={{ fontSize: 22 * s, lineHeight: 1.3 }}>{e.nota}</span>
          </div>
        );
        if (e.k === "foto") {
          const src = mediaUrl(e.foto, 800);
          // eslint-disable-next-line @next/next/no-img-element
          return src ? <img key={j} src={src} alt="" loading="lazy" style={{ ...base, objectFit: "cover", filter: e.pb ? "grayscale(1)" : undefined, borderRadius: e.raio ? e.raio * s : undefined }} /> : null;
        }
        return (
          <div key={j} style={{ ...base, height: "auto", fontFamily: familia(e.fonte, e.serifa), fontSize: e.tam * s, lineHeight: e.entrelinha, color: e.cor, fontStyle: e.italico ? "italic" : "normal", fontWeight: e.negrito ? 600 : 400, textAlign: e.alinhar, letterSpacing: e.espaco ? e.espaco * s : undefined, whiteSpace: "pre-wrap", overflowWrap: "break-word" }}>
            {e.trechos.map((t, k) => <span key={k} style={{ fontStyle: t.italico || e.italico ? "italic" : undefined, fontWeight: t.negrito ? 600 : undefined }}>{t.t}</span>)}
          </div>
        );
      })}
    </div>
  );
}
