import Link from "next/link";
import { Shell } from "@/components/Shell";
import { ActionForm } from "@/components/ActionForm";
import { ActionButton } from "@/components/content/ContentActions";
import { requireAdmin } from "@/lib/auth";
import { aEntregar, getCircle, nivelDe, NIVEIS, STATUS_LABEL } from "@/lib/circle";
import { listClients } from "@/lib/clients";
import { dataCurta } from "@/lib/contrato";
import { entregarRecompensaAction, statusIndicacaoAction } from "@/app/cliente/[slug]/indicacoes/actions";

export const dynamic = "force-dynamic";

export default async function AdminIndicacoesPage() {
  const session = await requireAdmin();
  const [d, clients] = await Promise.all([getCircle(), listClients()]);
  const nome = (slug: string) => clients.find((c) => c.slug === slug)?.name ?? slug;
  const list = [...d.indicacoes].sort((a, b) => b.at.localeCompare(a.at));
  const fechadas = list.filter((i) => i.status === "fechou").length;
  const recompensas = [...new Set(list.map((i) => i.slug))].flatMap((slug) => aEntregar(d, slug).map((n) => ({ slug, n })));

  return (
    <Shell active="circle" session={session}>
      <section className="ct-hero">
        <div className="min-w-0">
          <p className="label">Circle DoctorBrand</p>
          <h1 className="mt-1.5">{list.length} {list.length === 1 ? "indicação" : "indicações"}. <i>{fechadas} {fechadas === 1 ? "virou cliente" : "viraram clientes"}.</i></h1>
          <p className="text-[14px] sm:text-[15px] text-[var(--muted)] mt-2 max-w-xl">Atualize o status de cada indicação. Quando marcar Virou cliente, o nível de quem indicou sobe sozinho e a recompensa aparece aqui para entregar.</p>
        </div>
      </section>

      {recompensas.length > 0 && (
        <section className="card p-5 mb-4">
          <h2 className="pj-h2">Recompensas para entregar</h2>
          <ul className="mt-2 flex flex-col">
            {recompensas.map((r) => (
              <li key={`${r.slug}-${r.n}`} className="pj-step items-center">
                <span className="min-w-0 flex-1"><span className="block font-medium">{nome(r.slug)} · Nível {r.n}</span><span className="block text-[12.5px] text-[var(--muted)]">{NIVEIS[r.n - 1].titulo}</span></span>
                <ActionButton action={entregarRecompensaAction.bind(null, r.slug, r.n)} label="Marcar entregue" variant="dark" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card p-5">
        {list.length ? (
          <ul className="flex flex-col">
            {list.map((i) => (
              <li key={i.id} className="ci-row">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{i.nome}{i.especialidade ? ` · ${i.especialidade}` : ""}</span>
                  <span className="block text-[13px]">{i.contato}{i.cidade ? ` · ${i.cidade}` : ""}</span>
                  <span className="block text-[12.5px] text-[var(--muted)]">Indicado por <Link href={`/cliente/${i.slug}/indicacoes`} className="underline underline-offset-2">{nome(i.slug)}</Link> (nível {nivelDe(d.indicacoes, i.slug)}) em {dataCurta(i.at.slice(0, 10))}</span>
                  {i.obs && <span className="block text-[13px] text-[var(--muted)] mt-1">&ldquo;{i.obs}&rdquo;</span>}
                </span>
                <ActionForm action={statusIndicacaoAction.bind(null, i.id)} className="flex items-center gap-2 flex-none">
                  <select name="status" defaultValue={i.status} className="ct-input" aria-label="Status">
                    {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <button className="ct-btn">Salvar</button>
                </ActionForm>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-[var(--muted)]">Nenhuma indicação ainda. Os clientes indicam pela aba Indicações da área de membros.</p>}
      </section>
    </Shell>
  );
}
