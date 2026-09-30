import ical, { type CalendarResponse, type VEvent } from "node-ical";

/**
 * Agenda do cliente a partir do Google Calendar da DoctorBrand, sem OAuth e sem custo:
 * a equipe cola o "endereço secreto no formato iCal" da agenda em GOOGLE_CALENDAR_ICS
 * (pode ter mais de um, separados por espaço ou vírgula).
 *
 * Padrão do título do evento:  "Tipo | Cliente"   (ex.: "Captação | Carlos Picasso",
 * "Alinhamento quinzenal | Carlos P.", "Onboarding | Glaciale").
 * Só entram eventos nesse padrão cujo lado do cliente bate com o nome (ou apelido) dele.
 * Eventos com "interno" no título ou #interno na descrição nunca aparecem para o cliente.
 */
export type MeetingKind = "onboarding" | "captacao" | "fixa" | "pontual" | "outra";

export const MEETING_LABEL: Record<MeetingKind, string> = {
  onboarding: "Onboarding",
  captacao: "Captação",
  fixa: "Reunião fixa",
  pontual: "Reunião",
  outra: "Outro",
};

export interface Meeting {
  id: string;
  /** Série (para reuniões fixas). */
  seriesId: string;
  title: string;
  kind: MeetingKind;
  start: string;
  end: string;
  allDay: boolean;
  recurring: boolean;
  meetUrl?: string;
}

const CACHE_MS = 10 * 60_000;
let cache: { at: number; cals: CalendarResponse[] } | null = null;

export function agendaConfigured(): boolean {
  return !!process.env.GOOGLE_CALENDAR_ICS?.trim();
}

async function loadCalendars(): Promise<CalendarResponse[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.cals;
  const urls = (process.env.GOOGLE_CALENDAR_ICS ?? "").split(/[\s,]+/).filter((u) => /^https?:\/\//.test(u));
  const cals = await Promise.all(urls.map(async (u) => {
    const r = await fetch(u, { cache: "no-store" });
    if (!r.ok) throw new Error(`Agenda respondeu ${r.status}`);
    return ical.sync.parseICS(await r.text());
  }));
  cache = { at: Date.now(), cals };
  return cals;
}

export const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\b(dra?|doutora?)\.?\s+/g, "").replace(/[.]/g, "").replace(/\s+/g, " ").trim();

/** Formas do nome que a equipe costuma usar na agenda: "Carlos Picasso", "Carlos P.", "Picasso". */
export function nameAliases(name: string, extra: string[] = []): string[] {
  const n = norm(name);
  const parts = n.split(" ").filter(Boolean);
  const out = new Set<string>([n, ...extra.map(norm).filter(Boolean)]);
  if (parts.length >= 2) {
    out.add(`${parts[0]} ${parts[parts.length - 1][0]}`);
    out.add(parts[parts.length - 1]);
  }
  return [...out];
}

function text(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && "val" in (v as Record<string, unknown>)) return String((v as { val: unknown }).val ?? "");
  return String(v);
}

const SKIP_TYPE = /^(agendar|enviar|entregar|contato|cancelar|lembrar|off\b|interno)/;

function classify(type: string, recurring: boolean): MeetingKind {
  const t = norm(type);
  if (/onboarding|kick ?off/.test(t)) return "onboarding";
  if (/capta|gravac/.test(t)) return "captacao";
  if (recurring || /quinzenal|mensal|semanal|fixa/.test(t)) return "fixa";
  if (/alinhamento|reuni|estrateg|planejamento|comercial|call|conversa|apresenta|previa|entrega|resultado|roteiro/.test(t)) return "pontual";
  return "outra";
}

/** Separa "Tipo | Cliente" e devolve o tipo quando o outro lado é este cliente. */
export function matchTitle(summary: string, aliases: string[]): string | null {
  if (!summary.includes("|")) return null;
  const parts = summary.split("|").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const idx = parts.findIndex((p) => {
    const n = norm(p);
    return aliases.some((a) => n === a || (a.includes(" ") && n.includes(a)));
  });
  if (idx < 0) return null;
  const type = parts.filter((_, i) => i !== idx).join(" · ");
  if (!type || SKIP_TYPE.test(norm(type))) return null;
  return type;
}

function prettyType(type: string): string {
  // Títulos em CAIXA ALTA viram "Captação cc"; os outros ficam como a equipe escreveu.
  return type === type.toUpperCase() ? type.charAt(0) + type.slice(1).toLowerCase() : type;
}

/** Reuniões de um cliente entre `from` e `to`. Devolve null quando a agenda não está configurada. */
export async function clientMeetings(name: string, extraAliases: string[], from: Date, to: Date): Promise<Meeting[] | null> {
  if (!agendaConfigured()) return null;
  const aliases = nameAliases(name, extraAliases);
  const cals = await loadCalendars();
  const out: Meeting[] = [];
  for (const cal of cals) {
    for (const [uid, comp] of Object.entries(cal)) {
      if (!comp || (comp as { type?: string }).type !== "VEVENT") continue;
      const ev = comp as VEvent;
      if (text(ev.status).toUpperCase() === "CANCELLED") continue;
      const summary = text(ev.summary);
      const desc = text(ev.description);
      if (/interno/i.test(summary) || /#interno/i.test(desc)) continue;
      const type = matchTitle(summary, aliases);
      if (!type) continue;
      const recurring = !!ev.rrule;
      const meet = `${desc} ${text(ev.location)}`.match(/https:\/\/meet\.google\.com\/[a-z0-9-]+/i)?.[0];
      let instances;
      try {
        instances = ical.expandRecurringEvent(ev, { from, to });
      } catch {
        continue;
      }
      for (const inst of instances) {
        const s = new Date(inst.start as unknown as Date), e = new Date(inst.end as unknown as Date);
        const instType = matchTitle(text(inst.summary), aliases) ?? type;
        out.push({
          id: `${uid}:${s.toISOString()}`,
          seriesId: uid,
          title: prettyType(instType),
          kind: classify(instType, recurring),
          start: s.toISOString(),
          end: e.toISOString(),
          allDay: inst.isFullDay,
          recurring,
          meetUrl: meet,
        });
      }
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

const TZ = "America/Sao_Paulo";

export function meetingDay(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "short" }).replace(".", "").replace(" de ", " ");
}

export function meetingTime(m: Meeting): string {
  if (m.allDay) return "Dia todo";
  return new Date(m.start).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

export function meetingWeekday(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "long" });
}

/** Data local (AAAA-MM-DD) do início da reunião. */
export function meetingDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Janela lida da agenda: desde o mês escolhido (ou 60 dias atrás) até 75 dias à frente. */
export function agendaWindow(month: string): { nowIso: string; from: Date; to: Date } {
  const now = Date.now();
  return { nowIso: new Date(now).toISOString(), from: new Date(Math.min(Date.parse(`${month}-01T00:00:00-03:00`), now - 60 * 86400_000)), to: new Date(now + 75 * 86400_000) };
}
