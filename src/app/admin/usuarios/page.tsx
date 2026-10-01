import { requireAdmin } from "@/lib/auth";
import { listClients } from "@/lib/clients";
import { getProject } from "@/lib/project";
import { storeEnabled } from "@/lib/store";
import { getUsers, type User } from "@/lib/users";
import { Shell } from "@/components/Shell";
import { AccessRow, NewAccess } from "@/components/AccessUI";
import { ClientAvatar } from "@/components/ClientAvatar";
import { createAccessAction, deleteAccessAction, resetAccessAction, updateAccessAction } from "./actions";

export const dynamic = "force-dynamic";

const quando = (iso?: string) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : undefined);

/** Logins da equipe e dos clientes. A senha aparece uma vez, na criação ou ao gerar uma nova. */
export default async function Acessos() {
  const session = await requireAdmin();
  const [users, clients] = await Promise.all([getUsers(), listClients()]);
  const phones = Object.fromEntries(await Promise.all(clients.map(async (c) => [c.slug, (await getProject(c.slug).catch(() => null))?.clienteWhatsapp] as const)));
  const equipe = users.filter((u) => u.role === "admin");
  const deCliente = (slug: string) => users.filter((u) => u.role === "cliente" && u.clientSlug === slug);
  const orfaos = users.filter((u) => u.role === "cliente" && !clients.some((c) => c.slug === u.clientSlug));
  const semAcesso = clients.filter((c) => !deCliente(c.slug).length).length;
  const lista = clients.map((c) => ({ slug: c.slug, name: c.name }));

  const row = (u: User, phone?: string) => (
    <AccessRow key={u.id} name={u.name} email={u.email} lastLogin={quando(u.lastLoginAt)} role={u.role} clientSlug={u.clientSlug} clients={lista} phone={phone}
      reset={resetAccessAction.bind(null, u.id)} update={updateAccessAction.bind(null, u.id)} remove={deleteAccessAction.bind(null, u.id)} />
  );

  return (
    <Shell active="acessos" session={session}>
      <section className="ct-hero">
        <div className="min-w-0">
          <p className="label">Acessos</p>
          <h1 className="mt-1.5">{semAcesso ? <>{semAcesso} {semAcesso === 1 ? "cliente ainda sem login" : "clientes ainda sem login"}. <i>Leva um minuto.</i></> : <>Todos os clientes têm login. <i>Tudo certo.</i></>}</h1>
          <p className="text-[14px] sm:text-[15px] text-[var(--muted)] mt-2 max-w-2xl">Cada pessoa com o seu login. O cliente vê só a área dele; a equipe vê todos. A senha aparece uma única vez, com a mensagem pronta para mandar no WhatsApp. Esqueceu? Gere uma nova.</p>
        </div>
      </section>
      {!storeEnabled() && <div className="card p-4 g-bad text-sm mb-4">Armazenamento não configurado (BLOB_READ_WRITE_TOKEN). Nenhum acesso pode ser salvo.</div>}

      <div className="ac-grid">
        <section className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="pj-h2">Clientes</h2>
            <span className="text-[13px] text-[var(--muted)]">{clients.length - semAcesso} de {clients.length} com login</span>
          </div>
          <ul className="mt-3 flex flex-col">
            {clients.map((c) => {
              const us = deCliente(c.slug);
              return (
                <li key={c.slug} className="ac-client">
                  <div className="flex items-center gap-3">
                    <ClientAvatar name={c.name} className="sb-avatar is-sm" />
                    <span className="min-w-0 flex-1"><span className="block font-medium">{c.name}</span><span className="block text-[12.5px] text-[var(--muted)]">{us.length ? `${us.length} ${us.length === 1 ? "login" : "logins"}` : "Sem login"} · {c.specialty}</span></span>
                    {!us.length && <span className="pill pill-yellow">Sem acesso</span>}
                  </div>
                  {us.length > 0 && <ul className="ac-users">{us.map((u) => row(u, phones[c.slug]))}</ul>}
                  <div className="mt-2 pl-10">
                    <NewAccess action={createAccessAction} role="cliente" clientSlug={c.slug} defaultName={us.length ? "" : c.name} phone={phones[c.slug]} label={us.length ? "+ Outro login (secretária, sócio)" : "Criar acesso"} />
                  </div>
                </li>
              );
            })}
          </ul>
          {orfaos.length > 0 && (
            <div className="mt-4">
              <p className="label mb-1">Logins de clientes que saíram da área de membros</p>
              <ul className="ac-users">{orfaos.map((u) => row(u))}</ul>
            </div>
          )}
        </section>

        <section className="card p-5 h-max">
          <h2 className="pj-h2">Equipe</h2>
          <p className="text-[13px] text-[var(--muted)] mt-1">Login próprio vê tudo, como a senha mestre, e fica registrado quem fez cada coisa. A senha mestre continua valendo para emergências.</p>
          <ul className="ac-users mt-3">{equipe.map((u) => row(u))}</ul>
          {!equipe.length && <p className="text-[13px] text-[var(--muted)] mt-2">Ninguém da equipe tem login próprio ainda.</p>}
          <div className="mt-3"><NewAccess action={createAccessAction} role="admin" label="+ Login da equipe" /></div>
        </section>
      </div>
    </Shell>
  );
}
