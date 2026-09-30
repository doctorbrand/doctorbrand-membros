import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { NextStep } from "@/components/evolucao/NextStep";
import { ArrowRightIcon, CalendarIcon, ChevronLeftIcon, ChevronRightIcon, TargetIcon, TrophyIcon } from "@/components/Icons";
import { LogoFull } from "@/components/Logo";
import { PrintButton } from "@/components/PrintButton";
import { brl, int } from "@/lib/ads";
import { getSession } from "@/lib/auth";
import { MEETING_LABEL, meetingDay, meetingTime } from "@/lib/agenda";
import { WORK_LABEL } from "@/lib/clickup";
import { mediaUrl, thumbOf, TYPE_LABEL } from "@/lib/content";
import { quarterLabel } from "@/lib/evolucao";
import { todayISO } from "@/lib/periods";
import { buildReport, METODO, monthTitle } from "@/lib/report";
import { signedMediaUrl, verifySigned } from "@/lib/signed";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Relatório mensal · DoctorBrand", robots: { index: false, follow: false } };

const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const dayShort = (iso: string) => `${iso.slice(8, 10)} ${MES[Number(iso.slice(5, 7)) - 1]}`;
const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const shift = (ym: string, n: number) => { const [y, m] = ym.split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };

/** Relatório do mês: abre para quem tem acesso ao cliente ou pelo link assinado que a equipe envia. */
export default async function RelatorioPage({ params, searchParams }: { params: Promise<{ slug: string; mes: string }>; searchParams: Promise<{ e?: string; s?: string }> }) {
  const { slug, mes } = await params;
  const sp = await searchParams;
  if (!/^\d{4}-\d{2}$/.test(mes)) notFound();
  const session = await getSession();
  const logged = !!session && (session.role === "admin" || session.clientSlug === slug);
  const signed = verifySigned(`relatorio/${slug}/${mes}`, sp.e ?? null, sp.s ?? null);
  if (!logged && !signed) redirect("/login");
  const r = await buildReport(slug, mes);
  if (!r) notFound();

  const first = r.client.name.split(" ")[0];
  const today = todayISO();
  const thumb = (m: ReturnType<typeof thumbOf>) => (m?.path && !logged ? signedMediaUrl(m.path, 45 * 24 * 3600) : mediaUrl(m, 320));
  const lastDay = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).getUTCDate();
  const until = r.partial ? `Parcial, até ${Number(today.slice(8, 10))} de ${monthTitle(mes).split(" de ")[0]}` : `1 a ${lastDay} de ${monthTitle(mes).split(" de ")[0]}`;

  return (
    <div className="rp">
      <header className="rp-bar no-print">
        <div className="rp-wrap flex items-center justify-between gap-3">
          <LogoFull className="h-[18px] text-[var(--ink)]" />
          <div className="flex items-center gap-2">
            {logged && <Link href={`/relatorio/${slug}/${shift(mes, -1)}`} className="ct-icon-btn" aria-label="Mês anterior"><ChevronLeftIcon size={16} /></Link>}
            {logged && mes < today.slice(0, 7) && <Link href={`/relatorio/${slug}/${shift(mes, 1)}`} className="ct-icon-btn" aria-label="Próximo mês"><ChevronRightIcon size={16} /></Link>}
            <PrintButton />
            {logged && <Link href={`/cliente/${slug}/evolucao`} className="ct-btn">Voltar</Link>}
          </div>
        </div>
      </header>

      <main className="rp-wrap">
        <section className="rp-cover">
          <LogoFull className="h-[22px] text-[var(--ink)] print-only" />
          <p className="label mt-2">Relatório mensal · {r.client.name}{r.project.plano ? ` · Plano ${r.project.plano}` : ""}</p>
          <h1>{monthTitle(mes).charAt(0).toUpperCase() + monthTitle(mes).slice(1)}.</h1>
          <p className="text-[15px] text-[var(--muted)] mt-1">{until}. Tudo o que a equipe DoctorBrand fez pela sua marca, {first}.</p>
        </section>

        <div className="rp-kpis">
          <div className="rp-kpi is-dark"><b>{r.entregas ? r.entregas.length : "–"}</b><span>Entregas concluídas</span></div>
          <div className="rp-kpi"><b>{r.posts.length}</b><span>{r.posts.length === 1 ? "Post no ar" : "Posts no ar"}</span></div>
          <div className="rp-kpi"><b>{r.aprovados}</b><span>{r.aprovados === 1 ? "Aprovação sua" : "Aprovações suas"}</span></div>
          {r.ads && <>
            <div className="rp-kpi"><b>{brl(r.ads.spend, 0)}</b><span>Investido em anúncios</span></div>
            <div className="rp-kpi"><b>{int(r.ads.results)}</b><span>Contatos pelos anúncios</span></div>
            <div className="rp-kpi"><b>{brl(r.ads.cost)}</b><span>Custo por contato</span></div>
          </>}
        </div>

        {r.entregas && r.entregas.length > 0 && (
          <section className="rp-sec">
            <h2>O que entregamos</h2>
            <div className="flex flex-wrap gap-2 mt-3">
              {r.byCat.map((c) => <span key={c.cat} className="rp-chip">{WORK_LABEL[c.cat].many} <b className="ml-1">{c.count}</b></span>)}
            </div>
            <ul className="rp-list mt-4">
              {r.entregas.map((e, i) => (
                <li key={i}><span className="rp-date">{dayShort(e.date)}</span><span className="min-w-0 flex-1">{e.title}</span><span className="ev-tag">{WORK_LABEL[e.cat].one}</span></li>
              ))}
            </ul>
          </section>
        )}

        {r.posts.length > 0 && (
          <section className="rp-sec">
            <h2>No ar em {monthTitle(mes).split(" de ")[0]}</h2>
            <div className="rp-posts mt-4">
              {r.posts.slice(0, 12).map((p) => {
                const src = thumb(thumbOf(p));
                return (
                  <figure key={p.id}>
                    {src ? <img src={src} alt="" /> : <span className="rp-ph" />}
                    <figcaption><b>{dayShort(p.date)}</b> · {TYPE_LABEL[p.type]}</figcaption>
                  </figure>
                );
              })}
            </div>
            {r.posts.length > 12 && <p className="text-[13px] text-[var(--muted)] mt-2">E mais {r.posts.length - 12} publicações.</p>}
          </section>
        )}

        <div className="rp-two">
          {r.metas && (
            <section className="rp-sec">
              <h2>Metas do trimestre</h2>
              <p className="text-[13px] text-[var(--muted)]">{quarterLabel(r.metas.periodo)}</p>
              <div className="ev-goal mt-3"><TargetIcon size={18} /><p>{r.metas.objetivo}</p></div>
              <ul className="mt-2">
                {r.metas.rows.map((k) => {
                  const pct = k.value === null ? 0 : Math.min(100, (k.value / k.alvo) * 100);
                  const hit = k.value !== null && k.value >= k.alvo;
                  return (
                    <li key={k.id} className="pj-deliv">
                      <div className="flex items-center justify-between gap-3"><span className="font-medium">{k.titulo}</span><span className={`pj-count ${hit ? "is-done" : "is-part"}`}>{k.value === null ? "–" : fmt(k.value)}<span>/{fmt(k.alvo)}</span></span></div>
                      <div className="pj-bar"><span style={{ width: `${pct}%` }} className={hit ? "is-done" : ""} /></div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="rp-sec">
            <h2>Sua evolução</h2>
            {r.etapa !== null && (
              <div className="ev-now mt-3">
                <span className="label">Etapa {r.etapa + 1} de 7 no método</span>
                <p className="font-medium mt-0.5">{METODO[r.etapa].nome}</p>
                <p className="text-[13.5px] text-[var(--muted)]">{METODO[r.etapa].texto}</p>
              </div>
            )}
            {r.earned.length > 0 && (
              <div className="flex flex-col gap-2 mt-3">
                {r.earned.map((b) => (
                  <div key={b.id} className="ev-badge is-on"><span className="ev-badge-ic"><TrophyIcon size={16} /></span><span className="min-w-0"><span className="block font-medium text-[14px]">{b.title}</span><span className="block text-[12.5px] text-[var(--muted)]">{b.text}</span></span></div>
                ))}
              </div>
            )}
          </section>
        </div>

        {r.proximas.length > 0 && (
          <section className="rp-sec">
            <h2>Próximas datas</h2>
            <ul className="rp-list mt-3">
              {r.proximas.map((m) => (
                <li key={m.id}><span className="rp-date inline-flex items-center gap-1.5"><CalendarIcon size={14} /> {meetingDay(m.start)}</span><span className="min-w-0 flex-1">{m.title}</span><span className="text-[13px] text-[var(--muted)]">{MEETING_LABEL[m.kind]} · {meetingTime(m)}</span></li>
              ))}
            </ul>
          </section>
        )}

        <div className="rp-sec rp-next"><NextStep plano={r.project.plano} whatsapp={r.project.whatsapp} clientName={r.client.name} compact /></div>

        <footer className="rp-foot">
          <span>DoctorBrand · Arquitetura de Autoridade</span>
          {logged ? <Link href={`/cliente/${slug}`} className="inline-flex items-center gap-1 no-print">Abrir a área de membros <ArrowRightIcon size={14} /></Link> : <a href={`/cliente/${slug}`} className="inline-flex items-center gap-1 no-print">Entrar na área de membros <ArrowRightIcon size={14} /></a>}
        </footer>
      </main>
    </div>
  );
}
