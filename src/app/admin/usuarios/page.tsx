import { requireAdmin } from "@/lib/auth";
import { listClients } from "@/lib/clients";
import { getProject } from "@/lib/project";
import { storeEnabled } from "@/lib/store";
import { getUsers } from "@/lib/users";
import { Shell } from "@/components/Shell";
import { AccessList, type AccessItem, type PendingClient, type VinculoOpt } from "@/components/AccessUI";
import { createAccessAction, deleteAccessAction, resetAccessAction, updateAccessAction } from "./actions";

export const dynamic = "force-dynamic";

const quando = (iso?: string) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", " ·") : undefined);
const sem = (s: string) => s.replace(/^(dra?\.?\s+)/i, "");

/** Logins da equipe e dos clientes, numa lista só. A senha aparece uma vez, na criação ou ao gerar uma nova. */
export default async function Acessos() {
  const session = await requireAdmin();
  const [users, clients] = await Promise.all([getUsers(), listClients()]);
  const phoneOf = Object.fromEntries(await Promise.all(clients.map(async (c) => [c.slug, (await getProject(c.slug).catch(() => null))?.clienteWhatsapp] as const)));
  const nameOf = Object.fromEntries(clients.map((c) => [c.slug, c.name]));

  const items: AccessItem[] = users
    .map((u) => {
      const team = u.role === "admin";
      const slug = u.clientSlug ?? "";
      return {
        id: u.id, name: u.name, email: u.email, lastLogin: quando(u.lastLoginAt),
        vinculo: team ? "equipe" : `cliente:${slug}`,
        vinculoLabel: team ? "Equipe" : nameOf[slug] ?? "Cliente que saiu",
        phone: team ? undefined : phoneOf[slug],
        reset: resetAccessAction.bind(null, u.id), update: updateAccessAction.bind(null, u.id), remove: deleteAccessAction.bind(null, u.id),
      };
    })
    .sort((a, b) => (a.vinculo === "equipe" ? 0 : 1) - (b.vinculo === "equipe" ? 0 : 1) || sem(a.vinculoLabel).localeCompare(sem(b.vinculoLabel), "pt-BR") || a.name.localeCompare(b.name, "pt-BR"));

  const pending: PendingClient[] = clients
    .filter((c) => !users.some((u) => u.role === "cliente" && u.clientSlug === c.slug))
    .map((c) => ({ slug: c.slug, name: c.name, specialty: c.specialty, phone: phoneOf[c.slug] }));

  const vinculos: VinculoOpt[] = [
    { value: "equipe", label: "Equipe DoctorBrand (vê tudo)" },
    ...[...clients].sort((a, b) => sem(a.name).localeCompare(sem(b.name), "pt-BR")).map((c) => ({ value: `cliente:${c.slug}`, label: c.name })),
  ];
  const phones = Object.fromEntries(clients.map((c) => [`cliente:${c.slug}`, phoneOf[c.slug]]));

  return (
    <Shell active="acessos" session={session}>
      <section className="ct-hero">
        <div className="min-w-0">
          <p className="label">Acessos</p>
          <h1 className="mt-1.5">{pending.length ? <>{pending.length} {pending.length === 1 ? "cliente ainda sem login" : "clientes ainda sem login"}. <i>Leva um minuto.</i></> : <>Todos os clientes têm login. <i>Tudo certo.</i></>}</h1>
          <p className="text-[14px] sm:text-[15px] text-[var(--muted)] mt-2 max-w-2xl">Cada pessoa com o seu login. O cliente vê só a área dele; a equipe vê todos. A senha aparece uma única vez, com a mensagem pronta para o WhatsApp. Esqueceu? Gere uma nova. A senha mestre continua valendo para emergências.</p>
        </div>
      </section>
      {!storeEnabled() && <div className="card p-4 g-bad text-sm mb-4">Armazenamento não configurado (BLOB_READ_WRITE_TOKEN). Nenhum acesso pode ser salvo.</div>}
      <AccessList items={items} pending={pending} vinculos={vinculos} create={createAccessAction} phones={phones} />
    </Shell>
  );
}
