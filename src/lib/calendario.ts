import { clientMeetings, MEETING_LABEL, meetingDate, meetingTime } from "./agenda";
import { getClient } from "./clients";
import { getPosts, STATUS_LABEL, TYPE_LABEL, visibleTo, type PostStatus } from "./content";
import { calendarAliases, getProject, STEP_LABEL, type StepStatus } from "./project";

/**
 * Calendário do mês de um cliente: posts, reuniões da agenda e entregas do projeto, num lugar só.
 * Cada fonte falha sozinha: sem a agenda configurada, o calendário mostra o resto e avisa.
 */
export type CalKind = "post" | "reuniao" | "entrega" | "etapa";

export interface CalItem {
  id: string;
  /** Dia (AAAA-MM-DD, horário de Brasília). */
  day: string;
  kind: CalKind;
  title: string;
  /** Hora (HH:MM) ou "Dia todo". */
  time?: string;
  /** Rótulo curto embaixo do título (tipo de post, tipo de reunião, situação da etapa). */
  sub: string;
  postStatus?: PostStatus;
  stepStatus?: StepStatus;
  href?: string;
}

export interface CalMonth {
  month: string;
  items: CalItem[];
  agenda: "ok" | "off" | "erro";
}

const ultimoDia = (ym: string) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();

export async function calendarioDoMes(slug: string, month: string, role: "admin" | "cliente", postHref: (id: string) => string): Promise<CalMonth> {
  const [c, project, posts] = await Promise.all([getClient(slug), getProject(slug), getPosts(slug)]);
  const items: CalItem[] = [];

  for (const p of posts) {
    if (!p.date.startsWith(month) || !visibleTo(p, role)) continue;
    items.push({ id: `post:${p.id}`, day: p.date, kind: "post", title: p.title, time: p.time || undefined, sub: `${TYPE_LABEL[p.type]} · ${STATUS_LABEL[p.status]}`, postStatus: p.status, href: postHref(p.id) });
  }

  let agenda: CalMonth["agenda"] = "ok";
  if (c) {
    const from = new Date(`${month}-01T00:00:00-03:00`);
    const to = new Date(`${month}-${String(ultimoDia(month)).padStart(2, "0")}T23:59:59-03:00`);
    try {
      const ms = await clientMeetings(c.name, calendarAliases(slug, project), from, to);
      if (ms === null) agenda = "off";
      for (const m of ms ?? []) {
        const day = meetingDate(m.start);
        if (!day.startsWith(month)) continue;
        items.push({ id: `reuniao:${m.id}`, day, kind: "reuniao", title: m.title, time: meetingTime(m), sub: MEETING_LABEL[m.kind], ...(m.meetUrl ? { href: m.meetUrl } : {}) });
      }
    } catch {
      agenda = "erro";
    }
  }

  for (const d of project.deliverables ?? []) {
    for (const e of d.log) {
      if (!e.date.startsWith(month)) continue;
      items.push({ id: `entrega:${d.id}:${e.id}`, day: e.date, kind: "entrega", title: d.title, sub: e.note?.trim() || "Entrega feita", ...(e.url ? { href: e.url } : {}) });
    }
  }
  for (const s of project.steps) {
    if (!s.due?.startsWith(month)) continue;
    items.push({ id: `etapa:${s.id}`, day: s.due.slice(0, 10), kind: "etapa", title: s.title, sub: `Etapa · ${STEP_LABEL[s.status]}`, stepStatus: s.status });
  }

  // No mesmo dia: o que tem hora vem antes, na ordem da hora; depois reuniões, posts e entregas sem hora.
  const peso: Record<CalKind, number> = { reuniao: 0, post: 1, etapa: 2, entrega: 3 };
  const hora = (i: CalItem) => (i.time && /^\d/.test(i.time) ? i.time : "99");
  items.sort((a, b) => a.day.localeCompare(b.day) || hora(a).localeCompare(hora(b)) || peso[a.kind] - peso[b.kind]);
  return { month, items, agenda };
}
