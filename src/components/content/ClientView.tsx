"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { ActionResult } from "@/lib/types";
import { CheckIcon, EyeIcon, EyeOffIcon, PencilIcon, XIcon } from "@/components/Icons";

type Act0 = (prev: ActionResult | null) => Promise<ActionResult>;
type ActFd = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

/** Moldura do celular com o botão de prévia limpa (sem números nem selos, como fica no Instagram). */
export function FeedFrame({ children, legend }: { children: React.ReactNode; legend: React.ReactNode }) {
  const [clean, setClean] = useState(false);
  return (
    <div className={`ct-phone ${clean ? "is-clean" : ""}`} aria-label="Prévia do perfil no Instagram">
      {children}
      {legend}
      <div className="ct-phone-tools">
        <button type="button" className="ct-phone-toggle" onClick={() => setClean((v) => !v)} aria-pressed={clean}>
          {clean ? <><EyeOffIcon size={15} /> Mostrar marcações</> : <><EyeIcon size={15} /> Ver como no Instagram</>}
        </button>
      </div>
    </div>
  );
}

/**
 * Aprovar ou pedir alteração. Fica presa embaixo da tela enquanto o post está aberto
 * e, ao decidir, leva para o próximo post que espera aprovação.
 */
export function DecisionBar({ approve, change, slides, hasNext, status, type }: { approve: Act0; change: ActFd; slides: number; hasNext: boolean; status: string; type?: "imagem" | "carrossel" | "reels" }) {
  const [open, setOpen] = useState(false);
  const [ok, runOk, pendingOk] = useActionState(approve, null);
  const [ch, runCh, pendingCh] = useActionState(change, null);
  const [slide, setSlide] = useState("");
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (open) noteRef.current?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const err = (ok && !ok.ok && ok.message) || null;

  return (
    <>
      <div className="ct-decide" role="group" aria-label="Decidir sobre este post">
        <>
            <button type="button" className="ct-btn" onClick={() => setOpen(true)} disabled={pendingOk}>
              <PencilIcon size={16} /> {status === "alteracao" ? "Mudar pedido" : "Pedir ajuste"}
            </button>
            <form action={runOk} className="flex-1 flex">
              <button disabled={pendingOk} className="ct-btn ct-btn-primary w-full"><CheckIcon size={17} /> {pendingOk ? "Aprovando…" : "Aprovar"}</button>
            </form>
        </>
      </div>
      {err && <p className="text-xs g-bad -mt-2">{err}</p>}

      {open && (
        <div className="ct-sheet-back" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <form action={runCh} className="ct-sheet" role="dialog" aria-modal="true" aria-labelledby="ct-sheet-title">
            <div className="flex items-center justify-between">
              <p id="ct-sheet-title" className="text-lg font-semibold">O que você quer mudar?</p>
              <button type="button" onClick={() => setOpen(false)} className="ct-icon-btn" aria-label="Fechar"><XIcon /></button>
            </div>
            <div className="flex flex-col gap-2">
              <span className="label">Onde</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  ["", "No post todo"],
                  ...(type === "reels" ? [["video", "Vídeo"], ["capa", "Capa"]] : slides > 1 ? Array.from({ length: slides }, (_, i) => [String(i + 1), `Imagem ${i + 1}`]) : [["1", "Imagem"]]),
                  ["legenda", "Legenda"],
                ].map(([v, label]) => (
                  <button key={v} type="button" className={`ct-chip ${slide === v ? "is-on" : ""}`} aria-pressed={slide === v} onClick={() => setSlide(v)}>{label}</button>
                ))}
              </div>
              <input type="hidden" name="slide" value={slide} />
            </div>
            <textarea ref={noteRef} name="note" required rows={4} className="ct-input text-[16px]" placeholder="Ex.: trocar a foto da capa, ajustar a segunda frase da legenda…" maxLength={2000} />
            {ch && !ch.ok && <p className="text-sm g-bad">{ch.message}</p>}
            <div className="flex gap-2">
              <button type="button" className="ct-btn flex-1" onClick={() => setOpen(false)}>Cancelar</button>
              <button disabled={pendingCh} className="ct-btn ct-btn-dark flex-1">{pendingCh ? "Enviando…" : "Enviar pedido"}</button>
            </div>
            <p className="text-xs text-[var(--muted)]">A equipe DoctorBrand recebe o pedido na hora e devolve o post ajustado aqui.{hasNext ? " Em seguida abrimos o próximo post." : ""}</p>
          </form>
        </div>
      )}
    </>
  );
}
