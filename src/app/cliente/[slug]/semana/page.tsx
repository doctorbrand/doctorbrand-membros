import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { CheckIcon } from "@/components/Icons";
import { ADS_CLIENTS, brl, change, int } from "@/lib/ads";
import { requireAuth } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { getWeekly, headline, shortDay, weekLabel, type WeeklyReport, type WeekPoint } from "@/lib/semana";

export const dynamic = "force-dynamic";

/** Variação contra a semana anterior, com cor só quando a mudança é relevante. */
function Vs({ cur, prev, lowerIsBetter = false }: { cur: number | null; prev: number | null; lowerIsBetter?: boolean }) {
  const c = change(cur, prev);
  if (c === null) return <span className="text-[var(--muted)]">sem semana anterior para comparar</span>;
  const flat = Math.abs(c) < 3;
  const good = lowerIsBetter ? c < 0 : c > 0;
  return <span className={flat ? "text-[var(--muted)]" : good ? "g-good" : "g-bad"}>{flat ? "estável" : `${c > 0 ? "+" : ""}${c.toFixed(0)}%`} vs semana anterior</span>;
}

export default async function SemanaPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ visao?: string }> }) {
  const { slug } = await params;
  const session = await requireAuth(slug);
  const sp = await searchParams;
  const asClient = session.role === "admin" && sp.visao === "cliente";
  const admin = session.role === "admin" && !asClient;
  const c = await getClient(slug);
  if (!c || !ADS_CLIENTS.has(slug)) notFound();
  const res = await getWeekly(slug);
  const cur = res.ok ? res.data.current : null;

  return (
    <Shell active="semana" session={session} clientSlug={slug}>
      {asClient && (
        <div className="card p-3 mb-4 flex flex-wrap items-center justify-between gap-2 text-sm" style={{ background: "#fff7e0" }}>
          <span><b>Você está vendo como {c.name} vê.</b></span>
          <Link href={`/cliente/${slug}/semana`} className="ct-btn">Voltar à visão da equipe</Link>
        </div>
      )}
      <section className="ct-hero">
        <div className="min-w-0">
          <p className="label">Relatório semanal · anúncios</p>
          <h1 className="mt-1.5">Sua semana. {cur && <i>{weekLabel(cur)}.</i>}</h1>
          {cur && <p className="text-[15px] sm:text-[17px] mt-3 max-w-2xl leading-snug">{headline(cur, res.ok ? res.data.previous : null)}</p>}
        </div>
        {admin && <Link href={`/cliente/${slug}/semana?visao=cliente`} className="ct-btn">Ver como o cliente</Link>}
      </section>

      {!res.ok || !cur ? (
        <section className="card p-6 max-w-xl">
          <p className="font-medium">O relatório desta semana ainda não está disponível.</p>
          <p className="text-sm text-[var(--muted)] mt-1">Ele fica pronto toda segunda-feira, com a semana que terminou no domingo.</p>
          {admin && <p className="text-[12.5px] text-[var(--muted)] mt-3">Equipe: {res.ok ? res.data.error ?? "sem semanas fechadas na janela de dados." : res.message}{!res.ok && res.reason === "off" ? " Configure MEMBROS_API_KEY (mesmo valor) no Vercel do painel e da área de membros." : ""}</p>}
        </section>
      ) : (
        <WeekView d={res.data} cur={cur} />
      )}
    </Shell>
  );
}

function WeekView({ d, cur }: { d: WeeklyReport; cur: WeekPoint }) {
  const prev = d.previous;
  const funnel = cur.agendou !== null;
  const maxC = Math.max(1, ...d.weeks.map((w) => w.contatos));
  const onTarget = cur.cpc !== null && d.client.cplTarget > 0 ? cur.cpc <= d.client.cplTarget : null;
  const vsAvg = d.avg4 && d.avg4.contatos > 0 ? ((cur.contatos - d.avg4.contatos) / d.avg4.contatos) * 100 : null;
  return (
    <div className="flex flex-col gap-4">
      <div className="ad-kpis">
        <div className="card ad-kpi">
          <span className="label">Contatos</span>
          <b>{int(cur.contatos)}</b>
          <span className="text-[12.5px]"><Vs cur={cur.contatos} prev={prev?.contatos ?? null} /></span>
          <span className="text-[12px] text-[var(--muted)]">{int(cur.conversas)} conversas · {int(cur.leads)} cadastros{cur.googleConv > 0 ? ` · ${int(cur.googleConv)} pelo Google` : ""}</span>
        </div>
        <div className="card ad-kpi">
          <span className="label">Custo por contato</span>
          <b>{brl(cur.cpc)}</b>
          {onTarget !== null && <span className={`ad-grade ${onTarget ? "g-meta" : "g-atencao"}`}>{onTarget ? "Dentro da meta" : "Acima da meta"} · até {brl(d.client.cplTarget, 0)}</span>}
          <span className="text-[12.5px]"><Vs cur={cur.cpc} prev={prev?.cpc ?? null} lowerIsBetter /></span>
        </div>
        {funnel ? (
          <div className="card ad-kpi">
            <span className="label">Avaliações agendadas</span>
            <b>{int(cur.agendou)}</b>
            <span className="text-[12.5px]"><Vs cur={cur.agendou} prev={prev?.agendou ?? null} /></span>
            {cur.operou !== null && cur.operou > 0 && <span className="text-[12px] text-[var(--muted)]">{int(cur.operou)} {cur.operou === 1 ? "procedimento fechado" : "procedimentos fechados"}</span>}
          </div>
        ) : (
          <div className="card ad-kpi">
            <span className="label">Cliques no anúncio</span>
            <b>{int(cur.cliques)}</b>
            <span className="text-[12.5px]"><Vs cur={cur.cliques} prev={prev?.cliques ?? null} /></span>
          </div>
        )}
        <div className="card ad-kpi">
          <span className="label">Investimento</span>
          <b>{brl(cur.spend, 0)}</b>
          <span className="text-[12.5px] text-[var(--muted)]">{prev ? `${brl(prev.spend, 0)} na semana anterior` : "primeira semana do período"}</span>
        </div>
      </div>

      <div className="pj-grid">
        <div className="flex flex-col gap-4 min-w-0">
          <section className="card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="pj-h2">Evolução · últimas {d.weeks.length} semanas</h2>
              {vsAvg !== null && <span className="text-[12.5px] text-[var(--muted)]">{Math.abs(vsAvg) < 5 ? "Semana na média do último mês" : `Semana ${Math.abs(vsAvg).toFixed(0)}% ${vsAvg > 0 ? "acima" : "abaixo"} da média do último mês`}</span>}
            </div>
            <div className="ad-months wk-bars mt-4" style={{ gridTemplateColumns: `repeat(${d.weeks.length}, minmax(0, 1fr))` }}>
              {d.weeks.map((w) => (
                <div key={w.since} className="ad-month" title={`${weekLabel(w)}: ${int(w.contatos)} contatos`}>
                  <span className="ad-month-v">{int(w.contatos)}</span>
                  <span className="ad-month-bar"><span style={{ height: `${Math.max(3, (w.contatos / maxC) * 100)}%` }} /></span>
                  <span className="ad-month-l">{shortDay(w.since)}</span>
                  <span className="ad-month-c">{w.cpc !== null ? brl(w.cpc, 0) : "–"}</span>
                </div>
              ))}
            </div>
            <p className="text-[12px] text-[var(--muted)] mt-3">Contatos por semana (segunda a domingo). Abaixo de cada semana, o custo médio por contato. A barra verde é a semana deste relatório.</p>
          </section>

          <section className="card p-5">
            <h2 className="pj-h2">Destaques da semana</h2>
            {d.topCampaigns.length ? (
              <ul className="mt-3 flex flex-col">
                {d.topCampaigns.map((x) => (
                  <li key={x.name} className="ad-camp">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium truncate">{x.name}</span>
                      <span className="block text-[12.5px] text-[var(--muted)]">{int(x.results)} {x.resultLabel.toLowerCase()}</span>
                    </span>
                    <span className="text-right flex-none">
                      <span className="block font-medium mono">{brl(x.spend, 0)}</span>
                      <span className="block text-[12.5px] text-[var(--muted)]">{x.costPerResult !== null ? `${brl(x.costPerResult)} cada` : "–"}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-[var(--muted)] mt-3">Nenhuma campanha com investimento nesta semana.</p>}
          </section>
        </div>

        <div className="flex flex-col gap-4 min-w-0">
          <section className="card p-5">
            <h2 className="pj-h2">O que fizemos</h2>
            {d.actions.length ? (
              <ul className="mt-3 flex flex-col gap-3">
                {d.actions.map((a, i) => (
                  <li key={i} className="flex gap-3 items-start text-[14px]">
                    <span className="wk-check"><CheckIcon size={13} /></span>
                    <span className="min-w-0"><span className="block font-medium">{a.title}</span>{a.note && <span className="block text-[12.5px] text-[var(--muted)]">{a.note}</span>}<span className="block text-[12px] text-[var(--muted)]">{shortDay(a.date)}</span></span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-[var(--muted)] mt-2">Semana de acompanhamento: campanhas mantidas, sem ajustes de estrutura.</p>}
          </section>

          <section className="card p-5">
            <h2 className="pj-h2">Como ler</h2>
            <ul className="text-[13.5px] text-[var(--muted)] mt-2 flex flex-col gap-1.5">
              <li><b className="text-[var(--ink)] font-medium">Contatos</b> são as conversas iniciadas pelos anúncios e os cadastros de formulário.</li>
              <li>A comparação é sempre com a semana anterior, de segunda a domingo.</li>
              <li>O relatório é atualizado toda segunda-feira. Os números do dia a dia ficam na aba Anúncios.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
