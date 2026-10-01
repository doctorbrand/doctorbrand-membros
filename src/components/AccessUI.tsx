"use client";

import { useActionState, useState } from "react";
import type { AccessResult } from "@/app/admin/usuarios/actions";

type Act0 = (prev: AccessResult | null) => Promise<AccessResult>;
type ActFd = (prev: AccessResult | null, fd: FormData) => Promise<AccessResult>;

const wa = (text: string, phone?: string) => `https://wa.me/${phone ?? ""}?text=${encodeURIComponent(text)}`;

/** Login e senha recém-criados: aparecem uma vez, com a mensagem pronta para mandar. */
function CredCard({ cred, phone }: { cred: NonNullable<AccessResult["cred"]>; phone?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="ac-cred">
      <p className="text-[13px] font-medium">Mande para {cred.name.split(" ")[0]}. A senha não aparece de novo.</p>
      <dl className="ac-cred-grid">
        <dt>E-mail</dt><dd className="mono">{cred.email}</dd>
        <dt>Senha</dt><dd className="mono">{cred.password}</dd>
      </dl>
      <p className="ac-msg">{cred.message}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="ct-btn" onClick={() => { void navigator.clipboard.writeText(cred.message).then(() => setCopied(true)); }}>{copied ? "Copiado" : "Copiar mensagem"}</button>
        <a href={wa(cred.message, phone)} target="_blank" rel="noreferrer" className="ct-btn ct-btn-dark">{phone ? "Enviar no WhatsApp" : "Escolher contato no WhatsApp"}</a>
      </div>
    </div>
  );
}

function Feedback({ state, pending, phone }: { state: AccessResult | null; pending: boolean; phone?: string }) {
  if (pending) return <p className="text-xs text-[var(--muted)] mt-1">Salvando…</p>;
  if (!state) return null;
  return (
    <>
      <p className={`text-xs mt-1 ${state.ok ? "g-good" : "g-bad"}`}>{state.message}</p>
      {state.cred && <CredCard cred={state.cred} phone={phone} />}
    </>
  );
}

/** Criar acesso. Senha em branco: o sistema gera uma fácil de digitar. */
export function NewAccess({ action, label, defaultName = "", clientSlug, role, phone }: { action: ActFd; label: string; defaultName?: string; clientSlug?: string; role: "admin" | "cliente"; phone?: string }) {
  const [open, setOpen] = useState(false);
  const [state, run, pending] = useActionState(action, null);
  if (state?.ok && state.cred) return <Feedback state={state} pending={false} phone={phone} />;
  if (!open) return <button type="button" className="ct-btn" onClick={() => setOpen(true)}>{label}</button>;
  return (
    <form action={run} className="ac-form">
      <input type="hidden" name="role" value={role} />
      {clientSlug && <input type="hidden" name="clientSlug" value={clientSlug} />}
      <input name="name" defaultValue={defaultName} placeholder="Nome" required className="ct-input" />
      <input name="email" type="email" placeholder="E-mail de login" required className="ct-input" />
      <input name="password" placeholder="Senha (em branco: o sistema gera)" minLength={8} className="ct-input" autoComplete="new-password" />
      <div className="flex gap-2">
        <button disabled={pending} className="ct-btn ct-btn-dark">Criar acesso</button>
        <button type="button" className="ct-btn ct-btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
      </div>
      <Feedback state={state} pending={pending} phone={phone} />
    </form>
  );
}

/** Ações de um acesso existente: nova senha, editar, remover. */
export function AccessRow({ name, email, lastLogin, reset, update, remove, phone, clients, role, clientSlug }: {
  name: string; email: string; lastLogin?: string; reset: Act0; update: ActFd; remove: Act0; phone?: string;
  clients?: { slug: string; name: string }[]; role: "admin" | "cliente"; clientSlug?: string;
}) {
  const [rState, runReset, rPending] = useActionState(reset, null);
  const [uState, runUpdate, uPending] = useActionState(update, null);
  const [dState, runRemove, dPending] = useActionState(remove, null);
  const [edit, setEdit] = useState(false);
  if (dState?.ok) return <li className="ac-row is-removed"><span>{name} · acesso removido</span></li>;
  return (
    <li className="ac-row">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{name}</span>
          <span className="block text-[12.5px] text-[var(--muted)]">{email} · {lastLogin ? `último login ${lastLogin}` : "ainda não entrou"}</span>
        </span>
        <form action={runReset} onSubmit={(e) => { if (!window.confirm(`Gerar uma senha nova para ${name}? A atual deixa de funcionar.`)) e.preventDefault(); }}>
          <button disabled={rPending} className="ct-btn ct-btn-ghost">Nova senha</button>
        </form>
        <button type="button" className="ct-btn ct-btn-ghost" onClick={() => setEdit((x) => !x)}>Editar</button>
        <form action={runRemove} onSubmit={(e) => { if (!window.confirm(`Remover o acesso de ${name}?`)) e.preventDefault(); }}>
          <button disabled={dPending} className="ac-del">Remover</button>
        </form>
      </div>
      {edit && (
        <form action={runUpdate} className="ac-form mt-2">
          <input name="name" defaultValue={name} required className="ct-input" />
          <input name="email" type="email" defaultValue={email} required className="ct-input" />
          <select name="role" defaultValue={role} className="ct-input"><option value="cliente">Cliente</option><option value="admin">Equipe</option></select>
          {clients && <select name="clientSlug" defaultValue={clientSlug ?? ""} className="ct-input"><option value="">Cliente vinculado</option>{clients.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select>}
          <button disabled={uPending} className="ct-btn ct-btn-dark">Salvar</button>
          <Feedback state={uState} pending={uPending} />
        </form>
      )}
      <Feedback state={rState} pending={rPending} phone={phone} />
    </li>
  );
}
