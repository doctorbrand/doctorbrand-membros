"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadMedia } from "@/components/content/upload";
import type { ActionResult } from "@/lib/types";

const safe = (n: string) => n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").toLowerCase();

/**
 * Envia um logo ou uma fonte direto do navegador para o Blob (privado) e grava o caminho no kit.
 * `accept` limita a escolha no seletor; o servidor também confere o tipo.
 */
export function BrandFileUpload({ slug, slot, accept, label, local, save, clear, clearLabel = "Remover" }: {
  slug: string;
  slot: string;
  accept: string;
  label: string;
  local: boolean;
  save: (slug: string, slot: string, path: string, name: string) => Promise<ActionResult>;
  /** Quando já há arquivo: tira do kit. Botão comum (não é formulário), pode ficar dentro de outro form. */
  clear?: () => Promise<ActionResult>;
  clearLabel?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<ActionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();
  const router = useRouter();

  async function onPick(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    setMsg(null);
    try {
      const path = await uploadMedia(`content-media/${slug}/brand/${slot}-${safe(f.name)}`, f, local);
      const r = await save(slug, slot, path, f.name);
      setMsg(r);
      if (r.ok) start(() => router.refresh());
    } catch (e) {
      setMsg({ ok: false, message: e instanceof Error ? e.message : "Falha no envio." });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function onClear() {
    if (!clear || !window.confirm("Tirar este arquivo do kit?")) return;
    setBusy(true);
    const r = await clear().catch((e) => ({ ok: false, message: e instanceof Error ? e.message : "Falhou." }));
    setMsg(r);
    setBusy(false);
    if (r.ok) start(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="ct-btn" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Enviando…" : label}</button>
        {clear && <button type="button" className="ct-btn ct-btn-ghost" disabled={busy} onClick={onClear}>{clearLabel}</button>}
      </div>
      <input ref={input} type="file" accept={accept} hidden onChange={(e) => onPick(e.target.files?.[0])} />
      {msg && <p className={`text-xs ${msg.ok ? "g-good" : "g-bad"}`}>{msg.message}</p>}
    </div>
  );
}
