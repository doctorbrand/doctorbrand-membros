"use client";

import { useActionState, useMemo, useState } from "react";
import type { AccessResult } from "@/app/admin/usuarios/actions";

type Act0 = (prev: AccessResult | null) => Promise<AccessResult>;
type ActFd = (prev: AccessResult | null, fd: FormData) => Promise<AccessResult>;

/** "equipe" ou "cliente:<slug>". */
export type Vinculo = string;
export interface VinculoOpt { value: Vinculo; label: string }
export interface AccessItem {
  id: string; name: string; email: string; lastLogin?: string;
  vinculo: Vinculo; vinculoLabel: string; phone?: string;
  reset: Act0; update: ActFd; remove: Act0;
}
export interface PendingClient { slug: string; name: string; specialty?: string; phone?: string }

const wa = (text: string, phone?: string) => `https://wa.me/${phone ?? ""}?text=${encodeURIComponent(text)}`;
const initial = (name: string) => name.replace(/^(dra?\.?\s+)/i, "").charAt(0).toUpperCase();
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

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
  if (pending) return <p className="text-xs text-[var(--muted)]">Salvando…</p>;
  if (!state) return null;
  return (
    <>
      <p className={`text-xs ${state.ok ? "g-good" : "g-bad"}`}>{state.message}</p>
      {state.cred && <CredCard cred={state.cred} phone={phone} />}
    </>
  );
}

/** Formulário de criação. Senha em branco: o sistema gera uma fácil de digitar. */
function CreateForm({ action, vinculo, vinculos, defaultName = "", phones, onCancel, onCreated }: {
  action: ActFd; vinculo?: Vinculo; vinculos?: VinculoOpt[]; defaultName?: string; phones?: Record<string, string | undefined>; onCancel: () => void; onCreated?: () => void;
}) {
  const [state, run, pending] = useActionState(async (prev: AccessResult | null, fd: FormData) => {
    const r = await action(prev, fd);
    if (r.ok) onCreated?.();
    return r;
  }, null);
  const [sel, setSel] = useState<Vinculo>(vinculo ?? "");
  const phone = phones?.[sel];
  if (state?.ok && state.cred) return <Feedback state={state} pending={false} phone={phone} />;
  return (
    <form action={run} className="ac-form">
      {vinculo
        ? <input type="hidden" name="vinculo" value={vinculo} />
        : (
          <select name="vinculo" required value={sel} onChange={(e) => setSel(e.target.value)} className="ct-input">
            <option value="" disabled>Acesso de quem?</option>
            {vinculos?.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>
        )}
      <input name="name" defaultValue={defaultName} placeholder="Nome" required className="ct-input" />
      <input name="email" type="email" placeholder="E-mail de login" required className="ct-input" />
      <input name="password" placeholder="Senha (em branco: o sistema gera)" minLength={8} className="ct-input" autoComplete="new-password" />
      <div className="ac-form-btns">
        <button disabled={pending} className="ct-btn ct-btn-dark">Criar acesso</button>
        <button type="button" className="ct-btn ct-btn-ghost" onClick={onCancel}>Cancelar</button>
      </div>
      {(pending || state) && <div className="ac-form-full"><Feedback state={state} pending={pending} phone={phone} /></div>}
    </form>
  );
}

/** Uma linha da lista: quem é, de quem é o acesso, último login e ações. */
function AccessRow({ item, vinculos }: { item: AccessItem; vinculos: VinculoOpt[] }) {
  const { name, email, lastLogin, vinculo, vinculoLabel, phone } = item;
  const [rState, runReset, rPending] = useActionState(item.reset, null);
  const [uState, runUpdate, uPending] = useActionState(item.update, null);
  const [dState, runRemove, dPending] = useActionState(item.remove, null);
  const [edit, setEdit] = useState(false);
  const team = vinculo === "equipe";
  if (dState?.ok) return <li className="ac-li is-removed"><span className="ac-li-main">{name} · acesso removido</span></li>;
  return (
    <li className="ac-li">
      <div className="ac-li-main">
        <span className={`sb-avatar is-sm ${team ? "" : "is-user"}`}>{initial(name)}</span>
        <span className="min-w-0">
          <span className="ac-name">{name}</span>
          <span className="ac-email">{email}</span>
        </span>
      </div>
      <div className="ac-li-link">{team ? <span className="pill">Equipe</span> : <span className="ac-ellipsis">{vinculoLabel}</span>}</div>
      <div className="ac-li-last">{lastLogin ? lastLogin : <span className="g-warn">Ainda não entrou</span>}</div>
      <div className="ac-li-acts">
        <form action={runReset} onSubmit={(e) => { if (!window.confirm(`Gerar uma senha nova para ${name}? A atual deixa de funcionar.`)) e.preventDefault(); }}>
          <button disabled={rPending} className="ac-act">Nova senha</button>
        </form>
        <button type="button" className={`ac-act ${edit ? "is-on" : ""}`} onClick={() => setEdit((x) => !x)}>Editar</button>
        <form action={runRemove} onSubmit={(e) => { if (!window.confirm(`Remover o acesso de ${name}?`)) e.preventDefault(); }}>
          <button disabled={dPending} className="ac-act ac-del">Remover</button>
        </form>
      </div>
      {edit && (
        <div className="ac-li-extra">
          <form action={runUpdate} className="ac-form">
            <input name="name" defaultValue={name} required className="ct-input" aria-label="Nome" />
            <input name="email" type="email" defaultValue={email} required className="ct-input" aria-label="E-mail" />
            <select name="vinculo" defaultValue={vinculos.some((v) => v.value === vinculo) ? vinculo : ""} required className="ct-input" aria-label="Acesso de quem">
              <option value="" disabled>Acesso de quem?</option>
              {vinculos.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
            <div className="ac-form-btns"><button disabled={uPending} className="ct-btn ct-btn-dark">Salvar</button></div>
            {(uPending || uState) && <div className="ac-form-full"><Feedback state={uState} pending={uPending} /></div>}
          </form>
        </div>
      )}
      {(rPending || rState) && <div className="ac-li-extra"><Feedback state={rState} pending={rPending} phone={phone} /></div>}
    </li>
  );
}

/** Cliente sem login: um clique abre o formulário já ligado a ele. */
function PendingRow({ client, action, onCreated }: { client: PendingClient; action: ActFd; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  return (
    <li className="ac-li is-pending">
      <div className="ac-li-main">
        <span className="sb-avatar is-sm is-user">{initial(client.name)}</span>
        <span className="min-w-0">
          <span className="ac-name">{client.name}</span>
          {client.specialty && <span className="ac-email">{client.specialty}</span>}
        </span>
      </div>
      <div className="ac-li-acts">
        {!open && <button type="button" className="ct-btn" onClick={() => setOpen(true)}>Criar acesso</button>}
      </div>
      {open && (
        <div className="ac-li-extra">
          <CreateForm key={round} action={action} vinculo={`cliente:${client.slug}`} defaultName={client.name} phones={{ [`cliente:${client.slug}`]: client.phone }} onCancel={() => { setOpen(false); setRound((r) => r + 1); }} onCreated={onCreated} />
        </div>
      )}
    </li>
  );
}

type Filtro = "todos" | "clientes" | "equipe" | "sem";

/** Lista única de acessos, com filtro e busca. Clientes sem login ficam numa lista própria logo abaixo. */
export function AccessList({ items, pending, vinculos, create, phones }: {
  items: AccessItem[]; pending: PendingClient[]; vinculos: VinculoOpt[]; create: ActFd; phones: Record<string, string | undefined>;
}) {
  const [f, setF] = useState<Filtro>("todos");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [round, setRound] = useState(0);
  const closeNew = () => { setAdding(false); setRound((r) => r + 1); };
  // Cliente que acabou de ganhar login sai da lista "sem login" no refresh; a linha fica até recarregar,
  // para a senha gerada continuar na tela.
  const [kept, setKept] = useState<PendingClient[]>([]);
  const allPending = [...pending, ...kept.filter((k) => !pending.some((p) => p.slug === k.slug))].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const nq = norm(q.trim());
  const match = (...s: (string | undefined)[]) => !nq || s.some((x) => x && norm(x).includes(nq));
  const lista = useMemo(() => items.filter((i) =>
    (f === "todos" || (f === "equipe" ? i.vinculo === "equipe" : f === "clientes" ? i.vinculo !== "equipe" : false))
    && match(i.name, i.email, i.vinculoLabel)), [items, f, nq]); // eslint-disable-line react-hooks/exhaustive-deps
  const semLogin = f === "equipe" ? [] : allPending.filter((c) => match(c.name, c.specialty));
  const nTeam = items.filter((i) => i.vinculo === "equipe").length;
  const chips: [Filtro, string, number][] = [["todos", "Todos", items.length], ["clientes", "Clientes", items.length - nTeam], ["equipe", "Equipe", nTeam], ["sem", "Sem login", pending.length]];

  return (
    <section className="card ac-card">
      <div className="ac-toolbar">
        <div className="ac-chips" role="tablist">
          {chips.map(([k, label, n]) => (
            <button key={k} type="button" role="tab" aria-selected={f === k} className={`ct-chip ${f === k ? "is-on" : ""}`} onClick={() => setF(k)}>
              {label} <span className="ac-count">{n}</span>
            </button>
          ))}
        </div>
        <div className="ac-tools">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nome ou e-mail" className="ct-input ac-search" aria-label="Buscar" />
          {!adding && <button type="button" className="ct-btn ct-btn-dark" onClick={() => setAdding(true)}>Novo acesso</button>}
        </div>
      </div>
      {adding && (
        <div className="ac-new">
          <div className="ac-new-head"><span>Novo acesso</span><button type="button" className="ac-act" onClick={closeNew}>Fechar</button></div>
          <CreateForm key={round} action={create} vinculos={vinculos} phones={phones} onCancel={closeNew} />
        </div>
      )}

      {f !== "sem" && (
        <>
          <div className="ac-head" aria-hidden><span>Pessoa</span><span>Acesso de</span><span>Último login</span><span /></div>
          <ul className="ac-list">
            {lista.map((i) => <AccessRow key={i.id} item={i} vinculos={vinculos} />)}
          </ul>
          {!lista.length && <p className="ac-empty">{nq ? "Nada encontrado." : "Nenhum acesso aqui ainda."}</p>}
        </>
      )}

      {semLogin.length > 0 && (
        <>
          <div className="ac-sub">
            <span>Clientes sem login</span>
            <span className="ac-count">{semLogin.length}</span>
          </div>
          <ul className="ac-list">
            {semLogin.map((c) => <PendingRow key={c.slug} client={c} action={create} onCreated={() => setKept((k) => (k.some((x) => x.slug === c.slug) ? k : [...k, c]))} />)}
          </ul>
        </>
      )}
      {f === "sem" && !semLogin.length && <p className="ac-empty">{nq ? "Nada encontrado." : "Todos os clientes têm login."}</p>}
    </section>
  );
}
