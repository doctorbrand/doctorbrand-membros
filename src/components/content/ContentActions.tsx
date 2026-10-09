"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/lib/types";
import { TrashIcon } from "@/components/Icons";

type Act0 = (prev: ActionResult | null) => Promise<ActionResult>;
type ActFd = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

function Msg({ state, pending }: { state: ActionResult | null; pending: boolean }) {
  if (pending) return <p className="text-xs text-[var(--muted)]">Enviando…</p>;
  if (!state) return null;
  return <p className={`text-xs ${state.ok ? "g-good" : "g-bad"}`}>{state.message}</p>;
}

/** Ícone de lixeira que exclui com confirmação. */
export function DeleteIconButton({ action, confirm, label = "Excluir" }: { action: Act0; confirm: string; label?: string }) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} onSubmit={(e) => { if (!window.confirm(confirm)) e.preventDefault(); }}>
      <button disabled={pending} title={label} aria-label={label} className="ct-icon-btn ct-icon-danger"><TrashIcon /></button>
      {state && !state.ok && <p className="text-xs g-bad">{state.message}</p>}
    </form>
  );
}

/** Botão de ação única (aprovar, mudar status, excluir). */
export function ActionButton({ action, label, variant = "default", confirm }: { action: Act0; label: string; variant?: "default" | "primary" | "dark" | "ghost"; confirm?: string }) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }} className="flex flex-col gap-1">
      <button disabled={pending} className={`ct-btn ${variant === "primary" ? "ct-btn-primary" : variant === "dark" ? "ct-btn-dark" : variant === "ghost" ? "ct-btn-ghost" : ""}`}>{label}</button>
      <Msg state={state} pending={pending} />
    </form>
  );
}

/** Pedir alteração com comentário, opcionalmente apontando a imagem/slide. */
export function ChangeRequest({ action, slides }: { action: ActFd; slides: number }) {
  const [open, setOpen] = useState(false);
  const [state, run, pending] = useActionState(action, null);
  if (!open && !state?.ok) return <button type="button" className="ct-btn" onClick={() => setOpen(true)}>Pedir alteração</button>;
  if (state?.ok) return <p className="text-sm g-good">{state.message}</p>;
  return (
    <form action={run} className="w-full flex flex-col gap-2 card p-3">
      <label className="label">O que você quer mudar?</label>
      <textarea name="note" required rows={3} className="ct-input" placeholder="Ex.: trocar a foto de capa, ajustar a segunda frase da legenda…" />
      {slides > 1 && (
        <select name="slide" className="ct-input" defaultValue="">
          <option value="">No post todo</option>
          {Array.from({ length: slides }, (_, i) => <option key={i} value={i + 1}>Na imagem {i + 1}</option>)}
        </select>
      )}
      <div className="flex gap-2">
        <button disabled={pending} className="ct-btn ct-btn-dark">Enviar pedido</button>
        <button type="button" className="ct-btn" onClick={() => setOpen(false)}>Cancelar</button>
      </div>
      <Msg state={state} pending={pending} />
    </form>
  );
}

/** Agendar (ou reagendar) um post aprovado. */
export function ScheduleForm({ action, date, time, label = "Agendar publicação" }: { action: ActFd; date: string; time: string; label?: string }) {
  const [state, run, pending] = useActionState(action, null);
  if (state?.ok) return <p className="text-sm g-good">{state.message}</p>;
  return (
    <form action={run} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1"><span className="label">Data</span><input type="date" name="date" defaultValue={date} required className="ct-input" /></label>
      <label className="flex flex-col gap-1"><span className="label">Hora</span><input type="time" name="time" defaultValue={time} required className="ct-input" /></label>
      <button disabled={pending} className="ct-btn ct-btn-dark">{label}</button>
      <div className="w-full"><Msg state={state} pending={pending} /></div>
    </form>
  );
}

/** Ligar a conta do Instagram do cliente (lista vinda da Meta). */
export function ConnectInstagram({ action, refresh, accounts }: { action: ActFd; refresh: Act0; accounts: { igUserId: string; username?: string; pageName: string }[] }) {
  const [state, run, pending] = useActionState(action, null);
  const [rState, runRefresh, refreshing] = useActionState(refresh, null);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {accounts.length > 0 ? (
          <form action={run} className="flex flex-wrap items-center gap-2">
            <select name="igUserId" className="ct-input max-w-xs" required defaultValue="">
              <option value="" disabled>Escolha a conta…</option>
              {accounts.map((a) => <option key={a.igUserId} value={a.igUserId}>@{a.username ?? a.igUserId} · {a.pageName}</option>)}
            </select>
            <button disabled={pending} className="ct-btn ct-btn-dark">Ligar</button>
          </form>
        ) : <p className="text-sm text-[var(--muted)]">O token da Meta não enxerga nenhuma conta profissional do Instagram.</p>}
        <form action={runRefresh}><button disabled={refreshing} className="ct-btn">{refreshing ? "Buscando…" : "Atualizar lista"}</button></form>
      </div>
      <Msg state={state} pending={pending} />
      <Msg state={rState} pending={refreshing} />
      <p className="text-[12.5px] text-[var(--muted)]">Não está na lista? No Business Manager da DoctorBrand, em Usuários do sistema, atribua a página e o Instagram do cliente ao usuário do sistema. Depois clique em Atualizar lista.</p>
    </div>
  );
}

/** Botão de ícone que roda uma ação sem confirmação (ex.: subir ou descer um item). */
export function IconAction({ action, label, children }: { action: Act0; label: string; children: React.ReactNode }) {
  const [, run, pending] = useActionState(action, null);
  return (
    <form action={run}>
      <button disabled={pending} title={label} aria-label={label} className="ct-icon-btn">{children}</button>
    </form>
  );
}

/**
 * Atualizar do Drive: o link da pasta (ou do arquivo) fica editável e, ao atualizar,
 * as lâminas do post são trocadas pela versão atual do Drive.
 */
export function DriveRefresh({ action, source, status }: { action: ActFd; source?: string; status: string }) {
  const [state, run, pending] = useActionState(action, null);
  // Abre sozinho quando há ajuste pedido; depois de atualizar, continua aberto para mostrar o resultado.
  const [open, setOpen] = useState(status === "alteracao");
  const approved = status === "aprovado" || status === "agendado";
  return (
    <details className="ct-date-edit w-full" open={open || !!state} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
    <summary>Atualizar lâminas do Drive{source ? "" : " (sem link salvo)"}</summary>
    <form action={run} className="ct-drive-refresh mt-2">
      <label className="flex flex-col gap-1">
        <span className="label">Link do Drive</span>
        <input name="source" defaultValue={source ?? ""} placeholder="Link da pasta das lâminas ou do vídeo" className="ct-input" />
      </label>
      {approved
        ? <p className="text-xs text-[var(--muted)]">O post já foi aprovado: se as lâminas mudarem, ele volta para o cliente aprovar.</p>
        : status !== "aguardando" && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="send" defaultChecked={status === "alteracao"} />
            Enviar para o cliente aprovar depois de atualizar
          </label>
        )}
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={pending} className="ct-btn ct-btn-dark">{pending ? "Lendo o Drive…" : "Atualizar do Drive"}</button>
        <span className="text-xs text-[var(--muted)]">Troca as lâminas pela versão atual da pasta, na ordem dos nomes dos arquivos.</span>
      </div>
      <Msg state={state} pending={false} />
    </form>
    </details>
  );
}
