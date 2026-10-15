"use client";

import { useMemo, useState } from "react";
import { COLOR_ROLES, MAX_COLORS, normalizeHex, type BrandColor, type ColorRole } from "@/lib/brand";

type Row = { name: string; hex: string; role: ColorRole };

/**
 * Cores do kit, com prévia de slide ao vivo. Os campos têm os nomes que a action lê
 * (color_name_i, color_hex_i, color_role_i); linhas sem código são ignoradas ao salvar.
 */
export function BrandColorsAndPreview({ initial, titleFont, textFont, titleWeight, logoUrl }: {
  initial: BrandColor[];
  titleFont?: string;
  textFont?: string;
  titleWeight?: number;
  logoUrl?: string;
}) {
  const [rows, setRows] = useState<Row[]>(() => {
    const r = initial.map((c) => ({ ...c }));
    if (r.length < 3) r.push(...Array.from({ length: 3 - r.length }, () => ({ name: "", hex: "", role: "apoio" as ColorRole })));
    return r;
  });
  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const pick = (role: ColorRole, fallback: string) => normalizeHex(rows.find((r) => r.role === role && normalizeHex(r.hex))?.hex ?? "") ?? fallback;
  const bg = pick("fundo", "#1a1a1a");
  const fg = pick("texto", "#ffffff");
  const accent = pick("destaque", fg);
  const support = useMemo(() => rows.filter((r) => r.role === "apoio" && normalizeHex(r.hex)).map((r) => normalizeHex(r.hex)!), [rows]);

  return (
    <div className="grid lg:grid-cols-[1fr_280px] gap-6 items-start">
      <div className="flex flex-col gap-3">
        {rows.map((r, i) => {
          const ok = !r.hex || !!normalizeHex(r.hex);
          return (
            <div key={i} className="flex flex-wrap gap-2 items-center sm:grid sm:grid-cols-[44px_1fr_110px_130px_auto]">
              <input type="color" aria-label={`Cor ${i + 1}`} value={normalizeHex(r.hex) ?? "#ffffff"} onChange={(e) => set(i, { hex: e.target.value })} className="h-10 w-11 rounded-lg border border-[var(--line)] bg-white p-1 cursor-pointer" />
              <input name={`color_name_${i}`} value={r.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Nome (ex.: Grafite)" className="ct-input flex-1 min-w-[160px]" />
              <input name={`color_hex_${i}`} value={r.hex} onChange={(e) => set(i, { hex: e.target.value })} placeholder="#1a1a1a" className={`ct-input mono w-[104px] sm:w-auto ${ok ? "" : "border-[var(--bad)]"}`} />
              <select name={`color_role_${i}`} value={r.role} onChange={(e) => set(i, { role: e.target.value as ColorRole })} className="ct-input flex-1 min-w-[110px] sm:w-auto">
                {COLOR_ROLES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
              </select>
              <button type="button" className="ct-btn ct-btn-ghost" aria-label="Tirar cor" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>Tirar</button>
            </div>
          );
        })}
        {rows.length < MAX_COLORS && (
          <button type="button" className="ct-btn self-start" onClick={() => setRows((rs) => [...rs, { name: "", hex: "", role: "apoio" }])}>Adicionar cor</button>
        )}
        <p className="text-xs text-[var(--muted)]">O papel decide onde a cor entra: fundo do slide, texto, palavra em destaque ou detalhes. Até {MAX_COLORS} cores.</p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="label">Prévia de capa</span>
        <div style={{ aspectRatio: "4 / 5", background: bg, color: fg, borderRadius: 14, padding: "22px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between", border: "1px solid var(--line)", overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 6 }}>{support.slice(0, 3).map((c) => <span key={c} style={{ width: 18, height: 4, borderRadius: 2, background: c }} />)}</div>
          <div>
            <p style={{ fontFamily: titleFont ? `"${titleFont}", sans-serif` : undefined, fontWeight: titleWeight ?? 700, fontSize: 24, lineHeight: 1.1, letterSpacing: "-0.01em" }}>
              A paciente que mais paga <span style={{ color: accent }}>nunca curtiu</span> um post seu.
            </p>
            <p style={{ fontFamily: textFont ? `"${textFont}", sans-serif` : undefined, fontSize: 12, lineHeight: 1.45, opacity: 0.85, marginTop: 10 }}>
              Texto de apoio do slide, na fonte de texto do kit.
            </p>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, opacity: 0.7 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logoUrl ? <img src={logoUrl} alt="" style={{ height: 18, width: "auto", objectFit: "contain" }} /> : <span>logo</span>}
            <span>arrasta</span>
          </div>
        </div>
        <p className="text-xs text-[var(--muted)]">Só uma referência das cores e fontes. Os modelos de carrossel definem o layout de verdade.</p>
      </div>
    </div>
  );
}
