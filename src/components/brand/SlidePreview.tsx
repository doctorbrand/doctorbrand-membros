import { roleColor, SLIDE_W, type BrandKit, type SlideLayout, type TemplateBox } from "@/lib/brand";

/**
 * Desenho de um slide 4:5 a partir do modelo: fundo + caixas em %. Serve para a miniatura (servidor)
 * e para o editor (navegador). O tamanho da letra acompanha a largura (unidade cqw), então a miniatura
 * é a mesma composição do slide de 1080 px, só menor. Sem texto do cliente: as caixas mostram um rótulo.
 */

export interface PreviewAssets {
  /** URL de cada logo do kit, para escolher a versão certa pelo fundo. */
  logos: { principal?: string; claro?: string; escuro?: string };
  /** Primeira foto da pasta do Drive do kit (só para preencher a caixa de imagem). */
  photo?: string;
  /** URL de uma imagem de fundo enviada (caminho no Blob → URL). */
  fileUrl: (path: string) => string;
}

export function isDarkHex(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 140;
}

const SAMPLE: Record<"titulo" | "texto", string> = {
  titulo: "Título do slide",
  texto: "Texto do slide, com o limite de palavras definido nesta caixa.",
};

export function fontStack(k: BrandKit, which: "titulo" | "texto") {
  const f = k.fonts[which]?.family;
  return f ? `"${f.replace(/"/g, "")}", ${which === "titulo" ? "Georgia, serif" : "system-ui, sans-serif"}` : which === "titulo" ? "Georgia, serif" : "system-ui, sans-serif";
}

function BoxContent({ b, k, assets, bgHex, index }: { b: TemplateBox; k: BrandKit; assets: PreviewAssets; bgHex: string; index: number }) {
  if (b.kind === "imagem") {
    return assets.photo
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={assets.photo} alt="" className="sp-photo" draggable={false} />
      : <span className="sp-ph"><svg width="22%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="m4 17 5-4.5 4 3.5 2.5-2 4.5 3.5" /></svg>Foto do Drive</span>;
  }
  if (b.kind === "logo") {
    const dark = isDarkHex(bgHex);
    const url = (dark ? assets.logos.escuro : assets.logos.claro) ?? assets.logos.principal;
    // eslint-disable-next-line @next/next/no-img-element
    return url ? <img src={url} alt="" className="sp-logo" draggable={false} /> : <span className="sp-ph sp-ph-line" style={{ color: dark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.4)" }}>logo</span>;
  }
  const which = b.font ?? (b.kind === "titulo" ? "titulo" : "texto");
  const color = roleColor(k, b.color ?? "texto").hex;
  // Rótulo cortado no limite de palavras da caixa, para a prévia não prometer espaço que o slide não tem.
  const words = SAMPLE[b.kind].split(" ");
  const text = b.fixed ? b.fixed : b.auto === "contador" ? `${index}/7` : b.auto === "numero" ? String(index).padStart(2, "0") : words.slice(0, Math.max(1, b.maxWords ?? words.length)).join(" ").replace(/[,.]$/, "");
  const weight = k.fonts[which]?.weight ?? (which === "titulo" ? 600 : 400);
  return (
    <span className="sp-text" style={{ color, fontFamily: fontStack(k, which), fontWeight: weight, fontSize: `${((b.size ?? 40) / SLIDE_W) * 100}cqw`, textAlign: b.align ?? "left", justifyContent: b.align === "center" ? "center" : b.align === "right" ? "flex-end" : "flex-start" }}>
      {text}
    </span>
  );
}

export function SlidePreview({ layout, k, assets, index = 1, className, children }: {
  layout: SlideLayout; k: BrandKit; assets: PreviewAssets; index?: number; className?: string;
  /** Camada por cima (o editor desenha as alças aqui). */
  children?: React.ReactNode;
}) {
  const bgHex = layout.bg.type === "cor" ? roleColor(k, layout.bg.role).hex : "#777777";
  return (
    <div className={`sp-slide ${className ?? ""}`} style={{ background: bgHex }}>
      {layout.bg.type === "imagem" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={assets.fileUrl(layout.bg.path)} alt="" className="sp-bg" draggable={false} />
      )}
      {layout.boxes.map((b) => (
        <div key={b.id} className={`sp-box sp-${b.kind}`} style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` }}>
          <BoxContent b={b} k={k} assets={assets} bgHex={bgHex} index={index} />
        </div>
      ))}
      {children}
    </div>
  );
}
