import Link from "next/link";
import { Shell } from "@/components/Shell";
import { requireAdmin } from "@/lib/auth";
import { listClients } from "@/lib/clients";
import { ActionForm } from "@/components/ActionForm";
import { addClientAction, removeClientAction } from "./actions";
import { getPlan, getPosts, plannedAt } from "@/lib/content";
import { scoreFeed } from "@/lib/feedScore";
import { todayISO } from "@/lib/periods";

export const dynamic = "force-dynamic";

/** Visão da equipe: planejamento de conteúdo de todos os clientes, com o que está parado em cada um. */
export default async function ConteudoIndex() {
  const session = await requireAdmin();
  const clients = await listClients();
  const today = todayISO();
  const rows = await Promise.all(clients.map(async (c) => {
    const [posts, plan] = await Promise.all([getPosts(c.slug), getPlan(c.slug)]);
    const visible = posts.filter((p) => p.status !== "rascunho");
    const next = posts.filter((p) => p.status === "agendado").sort((a, b) => plannedAt(a).getTime() - plannedAt(b).getTime())[0];
    return {
      c, total: posts.length,
      waiting: posts.filter((p) => p.status === "aguardando").length,
      changes: posts.filter((p) => p.status === "alteracao").length,
      scheduled: posts.filter((p) => p.status === "agendado").length,
      drafts: posts.filter((p) => p.status === "rascunho").length,
      failed: posts.filter((p) => (p.publish?.attempts ?? 0) >= 3 && p.status === "agendado").length,
      score: visible.length ? scoreFeed(posts, plan, today) : null,
      next,
    };
  }));
  rows.sort((a, b) => (b.changes + b.failed) - (a.changes + a.failed) || b.waiting - a.waiting || a.c.name.localeCompare(b.c.name));

  return (
    <Shell active="geral" session={session}>
      <div className="mb-5">
        <p className="label">Equipe DoctorBrand</p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-1">Conteúdo de todos os clientes</h1>
        <p className="text-sm text-[var(--muted)] mt-1">Primeiro quem pediu alteração ou teve falha na publicação, depois quem está esperando aprovação.</p>
      </div>
      <div className="card scroll-x">
        <table className="data">
          <thead><tr><th></th><th>Cliente</th><th>Pontuação</th><th>Alteração</th><th>Aguardando</th><th>Agendados</th><th>Rascunhos</th><th>Próxima publicação</th><th>Instagram</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.c.slug}>
                <td>
                  <ActionForm action={removeClientAction} confirm={`Tirar ${r.c.name} da área de membros?\n\nOs acessos deste cliente serão apagados e ele não entra mais. Os posts ficam guardados.`}>
                    <input type="hidden" name="slug" value={r.c.slug} />
                    <button title={`Tirar ${r.c.name}`} aria-label={`Tirar ${r.c.name}`} className="text-[var(--muted)] hover:text-[var(--bad)] p-1">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" /></svg>
                    </button>
                  </ActionForm>
                </td>
                <td><Link href={`/cliente/${r.c.slug}/conteudo`} className="font-medium hover:underline">{r.c.name}</Link><div className="text-[11px] text-[var(--muted)]">{r.c.specialty}</div>
</td>
                <td>{r.score ? <span className={`pill ${r.score.total >= 85 ? "pill-green" : r.score.total >= 70 ? "pill-info" : r.score.total >= 50 ? "pill-yellow" : "pill-red"}`}>{r.score.total}</span> : "—"}</td>
                <td>{r.changes ? <span className="pill pill-red">{r.changes}</span> : "0"}</td>
                <td>{r.waiting ? <span className="pill pill-yellow">{r.waiting}</span> : "0"}</td>
                <td>{r.scheduled}{r.failed ? <span className="pill pill-red ml-1">{r.failed} falhou</span> : null}</td>
                <td>{r.drafts}</td>
                <td>{r.next ? `${r.next.date.split("-").reverse().slice(0, 2).join("/")} ${r.next.time}` : "—"}</td>
                <td>{r.c.igUserId ? <span className="pill pill-green">ligado</span> : <span className="pill">não ligado</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="card p-4 mt-6 flex flex-col gap-3 max-w-3xl">
        <h2 className="font-semibold">Adicionar cliente</h2>
        <ActionForm action={addClientAction} className="flex flex-wrap gap-2">
          <input name="name" placeholder="Nome (ex.: Dra. Ana Lima)" required className="ct-input flex-1 min-w-[200px]" />
          <input name="specialty" placeholder="Especialidade ou segmento" className="ct-input flex-1 min-w-[200px]" />
          <button className="ct-btn ct-btn-dark">Adicionar</button>
        </ActionForm>
      </section>
    </Shell>
  );
}
