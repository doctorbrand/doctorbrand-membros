import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { ActionButton, DeleteIconButton, IconAction } from "@/components/content/ContentActions";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "@/components/Icons";
import { deliveredIn, type Deliverable } from "@/lib/project";
import {
  addDeliverableAction, applyDefaultDeliverablesAction, deleteDeliverableAction, deleteDeliveryAction, logDeliveryAction, updateDeliverableAction,
} from "@/app/cliente/[slug]/actions";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const n = MONTHS[m - 1];
  return `${n.charAt(0).toUpperCase()}${n.slice(1)} de ${y}`;
}

export function shiftMonth(ym: string, n: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function day(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1].slice(0, 3)}`;
}

/** Qual tipo de evento da agenda conta para esta entrega (pelo nome). */
export function autoSource(title: string): "captacao" | "planejamento" | null {
  const t = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/capta|gravac/.test(t)) return "captacao";
  if (/planejamento/.test(t)) return "planejamento";
  return null;
}

export interface AutoRow { title: string; done: number; expected: number; dates: string[] }

/**
 * Entregas do mês: as recorrentes registradas pela equipe (captação, planejamento…) e os posts
 * do feed, que contam sozinhos a partir do planejamento de conteúdo.
 */
export function Deliverables({ slug, month, today, deliverables, auto, admin, hrefFor, fromCalendar = {}, agendaOn = false }: {
  slug: string; month: string; today: string; deliverables: Deliverable[]; auto: AutoRow | null; admin: boolean; hrefFor: (ym: string) => string;
  /** Datas (AAAA-MM-DD) que a agenda já registra para cada entrega, no mês. */
  fromCalendar?: Record<string, string[]>; agendaOn?: boolean;
}) {
  const year = month.slice(0, 4);
  const current = today.slice(0, 7);
  const isFuture = month > current;
  const rows = deliverables.map((d) => {
    const got = deliveredIn(d, month);
    const manualDates = new Set(got.map((e) => e.date));
    const cal = (fromCalendar[d.id] ?? []).filter((dt) => !manualDates.has(dt));
    const yearCount = d.log.filter((e) => e.date.startsWith(year)).length;
    return { d, got, cal, yearCount };
  });
  const totalExpected = rows.reduce((a, r) => a + r.d.perMonth, 0) + (auto?.expected ?? 0);
  const totalDone = rows.reduce((a, r) => a + Math.min(r.got.length + r.cal.length, r.d.perMonth), 0) + Math.min(auto?.done ?? 0, auto?.expected ?? 0);

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="pj-h2">Entregas do mês</h2>
        <div className="pj-month">
          <Link href={hrefFor(shiftMonth(month, -1))} scroll={false} aria-label="Mês anterior" title="Mês anterior"><ChevronLeftIcon size={16} /></Link>
          <span>{monthLabel(month)}</span>
          {month < current ? <Link href={hrefFor(shiftMonth(month, 1))} scroll={false} aria-label="Próximo mês" title="Próximo mês"><ChevronRightIcon size={16} /></Link> : <span className="off"><ChevronRightIcon size={16} /></span>}
        </div>
      </div>

      {rows.length === 0 && !auto ? (
        <p className="text-sm text-[var(--muted)] mt-3">{admin ? "Nenhuma entrega recorrente cadastrada." : "A equipe DoctorBrand vai registrar aqui as entregas de cada mês."}</p>
      ) : (
        <>
          {totalExpected > 0 && <p className="text-[13px] text-[var(--muted)] mt-1">{totalDone} de {totalExpected} {isFuture ? "previstas" : "entregues"}{month === current ? " até agora" : ""}</p>}
          <ul className="mt-3 flex flex-col">
            {auto && <DeliveryRow title={auto.title} done={auto.done} expected={auto.expected} sub="Conta sozinho pelo planejamento de conteúdo" chips={auto.dates.map((d) => ({ key: d, label: day(d) }))} />}
            {rows.map(({ d, got, cal, yearCount }) => (
              <DeliveryRow key={d.id} title={d.title} done={got.length + cal.length} expected={d.perMonth} sub={agendaOn && autoSource(d.title) ? "Conta sozinho pela agenda" : `${yearCount} em ${year}`}
                chips={[
                  ...cal.map((dt) => ({ key: `cal-${dt}`, label: day(dt), note: "Registrado pela agenda" })),
                  ...got.map((e) => ({ key: e.id, label: day(e.date), href: e.url, note: e.note, remove: admin ? deleteDeliveryAction.bind(null, slug, d.id, e.id) : undefined })),
                ].sort((a, b) => a.label.localeCompare(b.label))} />
            ))}
          </ul>
        </>
      )}

      {admin && (
        <div className="flex flex-col gap-3 mt-4">
          {deliverables.length === 0 && <div><ActionButton action={applyDefaultDeliverablesAction.bind(null, slug)} label="Usar padrão: captação e planejamento mensal" variant="dark" /></div>}
          {deliverables.length > 0 && (
            <details className="pj-edit">
              <summary className="pj-edit-toggle">Registrar entrega</summary>
              <ActionForm action={logDeliveryAction.bind(null, slug)} className="pj-log mt-3">
                <select name="deliverable" className="ct-input" required defaultValue="">
                  <option value="" disabled>Qual entrega?</option>
                  {deliverables.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
                <input name="date" type="date" defaultValue={today} className="ct-input" required aria-label="Data" />
                <input name="url" type="url" placeholder="Link (opcional)" className="ct-input" />
                <input name="note" placeholder="Nota (opcional)" className="ct-input" />
                <button className="ct-btn ct-btn-dark">Registrar</button>
              </ActionForm>
            </details>
          )}
          <details className="pj-edit">
            <summary className="pj-edit-toggle">Editar entregas recorrentes</summary>
            <div className="flex flex-col gap-2 mt-3">
              {deliverables.map((d) => (
                <div key={d.id} className="pj-edit-row">
                  <ActionForm action={updateDeliverableAction.bind(null, slug, d.id)} className="pj-deliv-form">
                    <input name="title" defaultValue={d.title} className="ct-input" aria-label="Entrega" />
                    <label className="pj-per"><input name="perMonth" type="number" min={1} max={60} defaultValue={d.perMonth} className="ct-input" aria-label="Por mês" /><span>por mês</span></label>
                    <button className="ct-btn">Salvar</button>
                  </ActionForm>
                  <DeleteIconButton action={deleteDeliverableAction.bind(null, slug, d.id)} confirm={`Excluir "${d.title}" e o histórico de entregas?`} label={`Excluir ${d.title}`} />
                </div>
              ))}
              <ActionForm action={addDeliverableAction.bind(null, slug)} className="pj-deliv-form">
                <input name="title" placeholder="Nova entrega (ex.: Relatório de resultados)" className="ct-input" required />
                <label className="pj-per"><input name="perMonth" type="number" min={1} max={60} defaultValue={1} className="ct-input" aria-label="Por mês" /><span>por mês</span></label>
                <button className="ct-btn ct-btn-dark">Adicionar</button>
              </ActionForm>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}

type Chip = { key: string; label: string; href?: string; note?: string; remove?: (prev: import("@/lib/types").ActionResult | null) => Promise<import("@/lib/types").ActionResult> };

function DeliveryRow({ title, done, expected, sub, chips }: { title: string; done: number; expected: number; sub: string; chips: Chip[] }) {
  const complete = done >= expected;
  const ratio = Math.min(1, expected ? done / expected : 0);
  return (
    <li className="pj-deliv">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block font-medium">{title}</span>
          <span className="block text-[12.5px] text-[var(--muted)]">{sub}</span>
        </span>
        <span className={`pj-count ${complete ? "is-done" : done > 0 ? "is-part" : ""}`}>{done}<span>/{expected}</span></span>
      </div>
      <div className="pj-bar"><span style={{ width: `${ratio * 100}%` }} className={complete ? "is-done" : ""} /></div>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {chips.map((c) => (
            <span key={c.key} className="pj-chip" title={c.note}>
              {c.href ? <a href={c.href} target="_blank" rel="noreferrer">{c.label}</a> : c.label}
              {c.remove && <IconAction action={c.remove} label="Apagar registro"><XIcon size={12} /></IconAction>}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}
