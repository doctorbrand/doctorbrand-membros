"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { ActionResult } from "@/lib/types";

export interface GridItem { id: string; href: string; label: string; current: boolean; content: ReactNode }

/**
 * Grid do feed. Para a equipe, arrastar e soltar reorganiza: os horários do planejamento
 * são redistribuídos na nova ordem (topo = mais recente, como no Instagram).
 * Quem usa passa um `key` que muda com a ordem salva, para o grid recomeçar do servidor.
 */
export function FeedGrid({ items, tail, reorder }: { items: GridItem[]; tail?: ReactNode; reorder?: (ids: string[]) => Promise<ActionResult> }) {
  const router = useRouter();
  const [order, setOrder] = useState(items);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<ActionResult | null>(null);

  async function drop(target: string) {
    const from = drag;
    setDrag(null); setOver(null);
    if (!reorder || !from || from === target) return;
    const ids = order.map((i) => i.id);
    const a = ids.indexOf(from), b = ids.indexOf(target);
    ids.splice(b, 0, ids.splice(a, 1)[0]);
    const prev = order;
    setOrder(ids.map((id) => order.find((i) => i.id === id)!));
    setBusy(true); setMsg(null);
    try {
      const r = await reorder(ids);
      setMsg(r);
      if (!r.ok) setOrder(prev);
      router.refresh();
    } catch (e) {
      setOrder(prev);
      setMsg({ ok: false, message: e instanceof Error ? e.message : String(e) });
    } finally { setBusy(false); }
  }

  return (
    <>
      {reorder && (
        <p className={`ct-grid-hint ${msg && !msg.ok ? "g-bad" : ""}`} aria-live="polite">
          {busy ? "Salvando a nova ordem…" : msg ? msg.message : "Arraste os posts para reorganizar o grid. As datas acompanham."}
        </p>
      )}
      <div className={`ct-grid ${busy ? "is-busy" : ""}`}>
        {order.map((i) => (
          <Link
            key={i.id} href={i.href} aria-label={i.label}
            className={`ct-cell ${i.current ? "is-current" : ""} ${reorder ? "is-draggable" : ""} ${drag === i.id ? "is-dragging" : ""} ${over === i.id && drag !== i.id ? "is-over" : ""}`}
            draggable={!!reorder && !busy}
            onDragStart={(e) => { setDrag(i.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", i.id); }}
            onDragEnd={() => { setDrag(null); setOver(null); }}
            onDragOver={(e) => { if (!drag) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== i.id) setOver(i.id); }}
            onDrop={(e) => { e.preventDefault(); void drop(i.id); }}
          >
            {i.content}
          </Link>
        ))}
        {tail}
      </div>
    </>
  );
}
