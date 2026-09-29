import { requireAdmin } from "@/lib/auth";
import { listClients } from "@/lib/clients";
import { storeEnabled } from "@/lib/store";
import { getUsers } from "@/lib/users";
import { ActionForm } from "@/components/ActionForm";
import { Shell } from "@/components/Shell";
import { createUserAction, deleteUserAction, updateUserAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function Usuarios() {
  const session = await requireAdmin();
  const [users, CLIENTS] = await Promise.all([getUsers(), listClients()]);
  const input = "border border-[var(--line)] rounded-lg px-3 py-2 bg-white text-sm";
  return (
    <Shell active="admin" session={session}>
      <div className="flex flex-col gap-6 max-w-5xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Acessos</h1>
          <p className="text-sm text-[var(--muted)]">Acesso de cliente enxerga só o próprio planejamento: aprova, pede alteração e agenda. Admin (equipe DoctorBrand) vê todos os clientes.</p>
        </div>
        {!storeEnabled() && <div className="card p-4 g-bad text-sm">Armazenamento não configurado (BLOB_READ_WRITE_TOKEN). Acessos, clientes e posts não podem ser salvos.</div>}
        <section className="card p-4 flex flex-col gap-3">
          <h2 className="font-semibold">Novo acesso</h2>
          <ActionForm action={createUserAction} className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <input name="name" placeholder="Nome" required className={input} />
            <input name="email" type="email" placeholder="E-mail" required className={input} />
            <input name="password" type="text" placeholder="Senha (8+ caracteres)" required minLength={8} className={input} />
            <select name="role" className={input} defaultValue="cliente"><option value="cliente">Cliente (aprova o próprio conteúdo)</option><option value="admin">Admin (equipe DoctorBrand)</option></select>
            <select name="clientSlug" className={input} defaultValue=""><option value="">Cliente vinculado (se for acesso de cliente)</option>{CLIENTS.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select>
            <button className="bg-[var(--ink)] text-white rounded-lg px-4 py-2 text-sm font-medium md:col-span-5 md:w-max">Criar acesso</button>
          </ActionForm>
        </section>
        <section className="card scroll-x">
          <table className="data">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Cliente</th><th>Criado</th><th>Último login</th><th></th></tr></thead>
            <tbody>
              {users.length === 0 && <tr><td colSpan={7} className="text-[var(--muted)]">Nenhum acesso além da senha mestre.</td></tr>}
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium">{u.name}</td><td>{u.email}</td><td>{u.role}</td><td>{CLIENTS.find((c) => c.slug === u.clientSlug)?.name ?? "—"}</td>
                  <td>{new Date(u.createdAt).toLocaleDateString("pt-BR")}</td><td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("pt-BR") : "—"}</td>
                  <td className="text-left">
                    <details>
                      <summary className="text-xs underline cursor-pointer">editar</summary>
                      <ActionForm action={updateUserAction} className="flex flex-col gap-2 mt-2 min-w-[240px]">
                        <input type="hidden" name="id" value={u.id} />
                        <input name="name" defaultValue={u.name} required className={input} />
                        <input name="email" type="email" defaultValue={u.email} required className={input} />
                        <select name="role" defaultValue={u.role} className={input}><option value="cliente">Cliente</option><option value="admin">Admin</option></select>
                        <select name="clientSlug" defaultValue={u.clientSlug ?? ""} className={input}><option value="">Cliente vinculado</option>{CLIENTS.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select>
                        <input name="password" type="text" placeholder="Nova senha (deixe vazio para manter)" minLength={8} className={input} />
                        <button className="bg-[var(--ink)] text-white rounded-lg px-3 py-1.5 text-sm">Salvar</button>
                      </ActionForm>
                    </details>
                    <ActionForm action={deleteUserAction} confirm={`Remover o acesso de ${u.name}?`}><input type="hidden" name="id" value={u.id} /><button className="text-xs text-[var(--muted)] hover:text-[var(--bad)] mt-1">remover</button></ActionForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </Shell>
  );
}
