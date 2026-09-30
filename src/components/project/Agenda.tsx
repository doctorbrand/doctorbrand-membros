import { CalendarIcon, VideoIcon } from "@/components/Icons";
import { MEETING_LABEL, meetingDay, meetingTime, meetingWeekday, type Meeting } from "@/lib/agenda";

export interface DateItem { key: string; date: string; title: string; sub: string; badge?: string }

/**
 * Agenda do projeto: próximas reuniões (da agenda da DoctorBrand), etapas com data e
 * publicações agendadas; reuniões fixas; e as últimas reuniões.
 */
export function Agenda({ meetings, extra, now, admin, error }: { meetings: Meeting[] | null; extra: DateItem[]; now: string; admin: boolean; error?: string }) {
  const list = meetings ?? [];
  const upcoming = list.filter((m) => m.end >= now);
  const past = list.filter((m) => m.end < now).reverse().slice(0, 6);
  // Uma linha por série de reunião fixa, com a próxima ocorrência.
  const fixed: Meeting[] = [];
  for (const m of upcoming) if (m.kind === "fixa" && !fixed.some((f) => f.seriesId === m.seriesId || f.title === m.title)) fixed.push(m);

  const items: (DateItem & { sort: string; meet?: string; kind?: string })[] = [
    ...upcoming.filter((m) => m.kind !== "fixa" || fixed.find((f) => f.id === m.id)).map((m) => ({
      key: m.id, sort: m.start, date: m.start, title: m.title, sub: meetingTime(m), badge: MEETING_LABEL[m.kind], meet: m.meetUrl, kind: m.kind,
    })),
    ...extra.map((e) => ({ ...e, sort: `${e.date}T23:59` })),
  ].sort((a, b) => a.sort.localeCompare(b.sort)).slice(0, 7);

  if (!items.length && !past.length && !fixed.length && !admin) return null;

  return (
    <section className="card p-5">
      <h2 className="pj-h2">Agenda</h2>

      {items.length > 0 ? (
        <ul className="mt-3 flex flex-col">
          {items.map((d) => (
            <li key={d.key} className="pj-date">
              <span className="pj-date-day"><CalendarIcon size={15} /> {meetingDay(d.date.length === 10 ? `${d.date}T12:00:00-03:00` : d.date)}</span>
              <span className="min-w-0 flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium truncate">{d.title}</span>
                  <span className="block text-[12.5px] text-[var(--muted)]">{d.badge ? `${d.badge} · ` : ""}{d.sub}</span>
                </span>
                {d.meet && <a href={d.meet} target="_blank" rel="noreferrer" className="pj-meet" title="Entrar pelo Google Meet"><VideoIcon size={15} /> Entrar</a>}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--muted)] mt-3">Nada marcado para as próximas semanas.</p>
      )}

      {fixed.length > 0 && (
        <div className="mt-4">
          <p className="label mb-1">Reuniões fixas</p>
          <ul className="flex flex-col gap-1">
            {fixed.map((m) => (
              <li key={m.seriesId} className="text-[14px]"><b className="font-medium">{m.title}</b> <span className="text-[var(--muted)]">· {meetingWeekday(m.start)}, {meetingTime(m)}</span></li>
            ))}
          </ul>
        </div>
      )}

      {past.length > 0 && (
        <details className="pj-done mt-4">
          <summary className="label cursor-pointer">Últimas reuniões ({past.length})</summary>
          <ul className="flex flex-col mt-1">
            {past.map((m) => (
              <li key={m.id} className="pj-date">
                <span className="pj-date-day text-[var(--muted)]">{meetingDay(m.start)}</span>
                <span className="min-w-0"><span className="block truncate">{m.title}</span><span className="block text-[12.5px] text-[var(--muted)]">{MEETING_LABEL[m.kind]}</span></span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {admin && meetings === null && (
        <p className="text-[12.5px] text-[var(--muted)] mt-4">A agenda do Google ainda não está ligada. Cole o endereço secreto iCal da agenda em GOOGLE_CALENDAR_ICS no Vercel.</p>
      )}
      {admin && error && <p className="text-[12.5px] g-bad mt-4">Não consegui ler a agenda: {error}</p>}
      {admin && meetings !== null && (
        <p className="text-[12.5px] text-[var(--muted)] mt-4">Entram só eventos com o título no padrão <b>Tipo | Cliente</b>. Use &quot;interno&quot; no título para esconder um evento.</p>
      )}
    </section>
  );
}
