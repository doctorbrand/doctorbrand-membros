import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { requireAuth } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { brl, change, CPL_LABEL, getAds, gradeCpl, int, type AdsData, type AdsPeriod } from "@/lib/ads";

export const dynamic = "force-dynamic";

const PERIODS: { key: AdsPeriod; label: string }[] = [
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "mes", label: "Este mês" },
];

const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function fmtDay(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function Delta({ cur, prev, lowerIsBetter = false }: { cur: number | null; prev: number | null; lowerIsBetter?: boolean }) {
  const c = change(cur, prev);
  if (c === null) return <span className="text-[var(--muted)]">sem comparação</span>;
  const good = lowerIsBetter ? c < 0 : c > 0;
  const flat = Math.abs(c) < 3;
  return <span className={flat ? "text-[var(--muted)]" : good ? "g-good" : "g-bad"}>{c > 0 ? "+" : ""}{c.toFixed(0)}% vs período anterior</span>;
}

export default async function AnunciosPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ p?: string; visao?: string }> }) {
  const { slug } = await params;
  const session = await requireAuth(slug);
  const sp = await searchParams;
  const asClient = session.role === "admin" && sp.visao === "cliente";
  const admin = session.role === "admin" && !asClient;
  const c = await getClient(slug);
  if (!c) notFound();
  const period = (PERIODS.some((p) => p.key === sp.p) ? sp.p : "30d") as AdsPeriod;
  const res = await getAds(slug, period);
  const q = (p: AdsPeriod) => `/cliente/${slug}/anuncios?${asClient ? "visao=cliente&" : ""}p=${p}`;

  return (
    <Shell active="anuncios" session={session} clientSlug={slug}>
      {asClient && (
        <div className="card p-3 mb-4 flex flex-wrap items-center justify-between gap-2 text-sm" style={{ background: "#fff7e0" }}>
          <span><b>Você está vendo como {c.name} vê.</b></span>
          <Link href={`/cliente/${slug}/anuncios?p=${period}`} className="ct-btn">Voltar à visão da equipe</Link>
        </div>
      )}
      <section className="ct-hero">
        <div className="min-w-0">
          <p className="label">Anúncios · Meta{res.ok && res.data.google ? " e Google" : ""}</p>
          <h1 className="mt-1.5">Seus anúncios. <i>{PERIODS.find((p) => p.key === period)!.label === "Este mês" ? "Este mês." : `Últimos ${PERIODS.find((p) => p.key === period)!.label}.`}</i></h1>
          {res.ok && <p className="text-[14px] sm:text-[15px] text-[var(--muted)] mt-2">De {fmtDay(res.data.period.since)} a {fmtDay(res.data.period.until)}. Números do painel de tráfego da DoctorBrand.</p>}
        </div>
        <div className="flex gap-1.5">
          {PERIODS.map((p) => <Link key={p.key} href={q(p.key)} className={`ct-seg ${p.key === period ? "is-on" : ""}`}>{p.label}</Link>)}
        </div>
      </section>

      {!res.ok ? (
        <section className="card p-6 max-w-xl">
          <p className="font-medium">{res.reason === "sem-conta" ? "Ainda não há anúncios neste projeto." : "Os números de anúncios não estão disponíveis agora."}</p>
          <p className="text-sm text-[var(--muted)] mt-1">{res.reason === "sem-conta" ? "Quando as campanhas começarem, os resultados aparecem aqui." : "Tente de novo em alguns minutos."}</p>
          {admin && <p className="text-[12.5px] text-[var(--muted)] mt-3">Equipe: {res.message}{res.reason === "off" ? " Configure MEMBROS_API_KEY (mesmo valor) no Vercel do painel e da área de membros." : ""}</p>}
        </section>
      ) : (
        <>
          {res.data.error && admin && <p className="card p-3 mb-4 text-sm g-bad">O painel não conseguiu ler a Meta agora: {res.data.error}</p>}
          <AdsView d={res.data} />
        </>
      )}
    </Shell>
  );
}

function AdsView({ d }: { d: AdsData }) {
  const t = d.totals, p = d.prev;
  const grade = gradeCpl(t.cpl, d.client);
  const maxMonth = Math.max(1, ...d.months.map((m) => m.results));
  const budgetPct = d.client.budgetMonthly > 0 ? Math.min(100, (d.pacing.mtdSpend / d.client.budgetMonthly) * 100) : null;
  return (
    <div className="flex flex-col gap-4">
      <div className="ad-kpis">
        <div className="card ad-kpi">
          <span className="label">Investimento</span>
          <b>{brl(t.spend, 0)}</b>
          <span className="text-[12.5px]"><Delta cur={t.spend} prev={p.spend} /></span>
        </div>
        <div className="card ad-kpi">
          <span className="label">Contatos</span>
          <b>{int(t.captacao)}</b>
          <span className="text-[12.5px]"><Delta cur={t.captacao} prev={p.captacao} /></span>
          <span className="text-[12px] text-[var(--muted)]">{int(t.conversas)} conversas no WhatsApp/Direct · {int(t.leads)} cadastros</span>
        </div>
        <div className="card ad-kpi">
          <span className="label">Custo por contato</span>
          <b>{brl(t.cpl)}</b>
          {grade && <span className={`ad-grade g-${grade}`}>{CPL_LABEL[grade]} · meta até {brl(d.client.cplTarget, 0)}</span>}
          <span className="text-[12.5px]"><Delta cur={t.cpl} prev={p.cpl} lowerIsBetter /></span>
        </div>
        <div className="card ad-kpi">
          <span className="label">Pessoas alcançadas</span>
          <b>{int(t.reach)}</b>
          <span className="text-[12.5px]"><Delta cur={t.reach} prev={p.reach} /></span>
        </div>
      </div>

      <div className="pj-grid">
        <div className="flex flex-col gap-4 min-w-0">
          {d.months.length > 0 && (
            <section className="card p-5">
              <h2 className="pj-h2">Contatos por mês</h2>
              <div className="ad-months mt-4">
                {d.months.map((m) => (
                  <div key={m.month} className="ad-month">
                    <span className="ad-month-v">{int(m.results)}</span>
                    <span className="ad-month-bar"><span style={{ height: `${Math.max(3, (m.results / maxMonth) * 100)}%` }} /></span>
                    <span className="ad-month-l">{MES[Number(m.month.slice(5, 7)) - 1]}</span>
                    <span className="ad-month-c">{brl(m.cost, 0)}</span>
                  </div>
                ))}
              </div>
              <p className="text-[12px] text-[var(--muted)] mt-3">Abaixo de cada mês, o custo médio por contato.</p>
            </section>
          )}

          <section className="card p-5">
            <h2 className="pj-h2">Campanhas no período</h2>
            {d.campaigns.length ? (
              <ul className="mt-3 flex flex-col">
                {d.campaigns.map((c) => (
                  <li key={c.name} className="ad-camp">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium truncate">{c.name}</span>
                      <span className="block text-[12.5px] text-[var(--muted)]">{c.captacao ? "Captação" : "Alcance e reconhecimento"} · {int(c.results)} {c.resultLabel.toLowerCase()}</span>
                    </span>
                    <span className="text-right flex-none">
                      <span className="block font-medium mono">{brl(c.spend, 0)}</span>
                      <span className="block text-[12.5px] text-[var(--muted)]">{c.costPerResult !== null ? `${brl(c.costPerResult)} cada` : "–"}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-[var(--muted)] mt-3">Nenhuma campanha com investimento neste período.</p>}
          </section>
        </div>

        <div className="flex flex-col gap-4 min-w-0">
          {budgetPct !== null && (
            <section className="card p-5">
              <h2 className="pj-h2">Verba do mês</h2>
              <p className="text-[26px] font-semibold tracking-tight mt-2 mono">{brl(d.pacing.mtdSpend, 0)} <span className="text-[15px] font-medium text-[var(--muted)]">de {brl(d.client.budgetMonthly, 0)}</span></p>
              <div className="pj-bar"><span style={{ width: `${budgetPct}%` }} /></div>
              <p className="text-[12.5px] text-[var(--muted)] mt-2">Dia {d.pacing.elapsedDays} de {d.pacing.daysInMonth}{d.pacing.projected ? ` · no ritmo atual, fecha o mês em ${brl(d.pacing.projected, 0)}` : ""}.</p>
            </section>
          )}

          {d.google && (
            <section className="card p-5">
              <h2 className="pj-h2">Google</h2>
              <div className="pj-stats mt-3" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                <div className="pj-stat"><b>{brl(d.google.cost, 0)}</b><span>Investimento</span></div>
                <div className="pj-stat"><b>{int(d.google.conversions)}</b><span>Conversões</span></div>
              </div>
            </section>
          )}

          <section className="card p-5">
            <h2 className="pj-h2">Como ler</h2>
            <ul className="text-[13.5px] text-[var(--muted)] mt-2 flex flex-col gap-1.5">
              <li><b className="text-[var(--ink)] font-medium">Contatos</b> são as conversas iniciadas pelos anúncios e os cadastros de formulário.</li>
              <li><b className="text-[var(--ink)] font-medium">Custo por contato</b> considera só as campanhas de captação. As de alcance aparecem à parte.</li>
              <li>Os números são atualizados a cada 15 minutos.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
