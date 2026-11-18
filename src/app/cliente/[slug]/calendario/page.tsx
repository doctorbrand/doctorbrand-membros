import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/Icons";
import { requireAuth } from "@/lib/auth";
import { calendarioDoMes, type CalItem, type CalKind } from "@/lib/calendario";
import { getClient } from "@/lib/clients";
import { todayISO } from "@/lib/periods";

export const dynamic = "force-dynamic";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const SEMANA_LONGA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const KIND_LABEL: Record<CalKind, string> = { post: "Post", reuniao: "Reunião", entrega: "Entrega", etapa: "Etapa" };

const shift = (ym: string, n: number) => { const [y, m] = ym.split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
const titulo = (ym: string) => { const m = MESES[Number(ym.slice(5, 7)) - 1]; return `${m.charAt(0).toUpperCase()}${m.slice(1)} de ${ym.slice(0, 4)}`; };

/** Classe de cor do item: posts pela situação, o resto pelo tipo. */
function tone(i: CalItem): string {
  if (i.kind === "post") return `is-post-${i.postStatus}`;
  if (i.kind === "etapa") return i.stepStatus === "concluida" ? "is-entrega" : "is-etapa";
  return `is-${i.kind}`;
}

function Item({ i, compact }: { i: CalItem; compact?: boolean }) {
  const body = (
    <>
      <span className="cal-dot" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="cal-title">{i.time && /^\d/.test(i.time) ? <span className="cal-time">{i.time}</span> : null}{i.title}</span>
        {!compact && <span className="cal-sub">{i.sub}</span>}
      </span>
    </>
  );
  const cls = `cal-item ${tone(i)}`;
  const label = `${KIND_LABEL[i.kind]}: ${i.title}. ${i.sub}`;
  if (!i.href) return <li className={cls} title={label}>{body}</li>;
  return <li><a href={i.href} className={cls} title={label} {...(/^https?:/.test(i.href) ? { target: "_blank", rel: "noreferrer" } : {})}>{body}</a></li>;
}

/** Calendário do mês: posts, reuniões e entregas do cliente. Cliente e equipe. */
export default async function CalendarioPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ mes?: string; visao?: string }> }) {
  const { slug } = await params;
  const session = await requireAuth(slug);
  const sp = await searchParams;
  const c = await getClient(slug);
  if (!c) notFound();
  const asClient = session.role === "admin" && sp.visao === "cliente";
  const role = session.role === "admin" && !asClient ? "admin" : "cliente";
  const today = todayISO();
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mes ?? "") ? sp.mes! : today.slice(0, 7);
  const q = asClient ? "visao=cliente&" : "";
  const postHref = (id: string) => `/cliente/${slug}/conteudo?${q}post=${id}#post`;
  const mesHref = (ym: string) => `/cliente/${slug}/calendario?${q}mes=${ym}`;
  const cal = await calendarioDoMes(slug, month, role, postHref);

  const [y, m] = month.split("-").map(Number);
  const dias = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const inicio = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const porDia = new Map<string, CalItem[]>();
  for (const i of cal.items) porDia.set(i.day, [...(porDia.get(i.day) ?? []), i]);
  const celulas: (string | null)[] = [...Array(inicio).fill(null), ...Array.from({ length: dias }, (_, k) => `${month}-${String(k + 1).padStart(2, "0")}`)];
  while (celulas.length % 7) celulas.push(null);
  const conta = (k: CalKind) => cal.items.filter((i) => i.kind === k || (k === "entrega" && i.kind === "etapa")).length;
  const diasComItens = [...porDia.keys()].sort();

  return (
    <Shell active="calendario" session={session} clientSlug={slug}>
      <section className="ct-hero">
        <div className="min-w-0">
          <p className="label">Calendário</p>
          <h1 className="mt-1.5">{titulo(month)}</h1>
          <p className="text-[14px] sm:text-[15px] text-[var(--muted)] mt-2">{conta("post")} {conta("post") === 1 ? "post" : "posts"} · {conta("reuniao")} {conta("reuniao") === 1 ? "reunião" : "reuniões"} · {conta("entrega")} {conta("entrega") === 1 ? "entrega" : "entregas"}</p>
        </div>
        <div className="ct-hero-actions cal-nav">
          <Link href={mesHref(shift(month, -1))} className="ct-icon-btn" aria-label="Mês anterior"><ChevronLeftIcon size={16} /></Link>
          {month !== today.slice(0, 7) && <Link href={mesHref(today.slice(0, 7))} className="ct-btn">Hoje</Link>}
          <Link href={mesHref(shift(month, 1))} className="ct-icon-btn" aria-label="Próximo mês"><ChevronRightIcon size={16} /></Link>
        </div>
      </section>

      <div className="cal-legend" aria-label="Legenda">
        <span className="cal-key is-post-aprovado"><span className="cal-dot" />Post</span>
        <span className="cal-key is-reuniao"><span className="cal-dot" />Reunião</span>
        <span className="cal-key is-entrega"><span className="cal-dot" />Entrega</span>
        <span className="cal-key is-etapa"><span className="cal-dot" />Etapa prevista</span>
      </div>
      {cal.agenda !== "ok" && role === "admin" && (
        <p className="text-[13px] text-[var(--muted)] mb-3">{cal.agenda === "off" ? "A agenda do Google não está ligada (GOOGLE_CALENDAR_ICS): as reuniões não aparecem." : "Não consegui ler a agenda do Google agora: as reuniões não aparecem."}</p>
      )}

      {/* Computador e tablet: grade do mês */}
      <section className="card cal-grid-wrap">
        <div className="cal-grid" role="grid" aria-label={`Calendário de ${titulo(month)}`}>
          {SEMANA.map((d) => <div key={d} className="cal-wd" role="columnheader">{d}</div>)}
          {celulas.map((d, k) => (
            <div key={d ?? `vazio-${k}`} className={`cal-cell ${d ? "" : "is-empty"} ${d === today ? "is-today" : ""}`} role="gridcell">
              {d && <>
                <span className="cal-num">{Number(d.slice(8, 10))}</span>
                <ul className="cal-list">{(porDia.get(d) ?? []).map((i) => <Item key={i.id} i={i} compact />)}</ul>
              </>}
            </div>
          ))}
        </div>
      </section>

      {/* Celular: lista por dia */}
      <section className="cal-agenda">
        {diasComItens.length === 0 && <p className="card p-5 text-[14px] text-[var(--muted)]">Nada marcado neste mês.</p>}
        {diasComItens.map((d) => {
          const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
          return (
            <div key={d} className={`card cal-day ${d === today ? "is-today" : ""}`}>
              <p className="cal-day-h"><b>{Number(d.slice(8, 10))}</b> {SEMANA_LONGA[wd]}{d === today ? " · hoje" : ""}</p>
              <ul className="cal-list">{porDia.get(d)!.map((i) => <Item key={i.id} i={i} />)}</ul>
            </div>
          );
        })}
      </section>
    </Shell>
  );
}
