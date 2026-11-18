"use client";

import { useState } from "react";

/** Link do briefing pronto para mandar: copiar ou abrir o WhatsApp com a mensagem. */
export function BriefingLinkShare({ url, nome, phone }: { url: string; nome: string; phone?: string }) {
  const [copied, setCopied] = useState(false);
  const msg = `Olá, ${nome}! Este é o briefing da DoctorBrand. Responda do seu jeito, leva uns 15 minutos, e dá para salvar e continuar depois pelo mesmo link:\n${url}`;
  return (
    <div className="flex flex-col gap-2">
      <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="ct-input mono text-[12.5px]" aria-label="Link do briefing" />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="ct-btn" onClick={() => { void navigator.clipboard.writeText(url).then(() => setCopied(true)); }}>{copied ? "Copiado" : "Copiar link"}</button>
        <a href={`https://wa.me/${phone ?? ""}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" className="ct-btn ct-btn-dark">{phone ? "Enviar no WhatsApp" : "Escolher contato no WhatsApp"}</a>
      </div>
    </div>
  );
}
