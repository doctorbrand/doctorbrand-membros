"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/types";

type Act = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

/** Formulário genérico pra server action com mensagem de retorno. */
export function ActionForm({ action, children, className = "", confirm }: { action: Act; children: React.ReactNode; className?: string; confirm?: string }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className} onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}>
      <fieldset disabled={pending} className="contents">{children}</fieldset>
      {state && <p className={`text-xs mt-1 ${state.ok ? "g-good" : "g-bad"}`}>{state.message}</p>}
      {pending && <p className="text-xs mt-1 text-[var(--muted)]">Salvando…</p>}
    </form>
  );
}
