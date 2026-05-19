import ICAL from "ical.js";
import type { ISODate } from "../types";
import { addDays, todayLocal } from "./dates";

// Pure ICS parsing — no DOM, no Supabase client. Safe to import from a Web
// Worker. The supabase-bound fetch logic lives in `./ics.ts`.

export interface IcsEvent {
  id: string;
  calendarId: string;
  uid: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  location?: string;
}

const EXPANSION_DAYS_PAST = 1;
const EXPANSION_DAYS_FUTURE = 60;

// Global per-feed cap on expanded recurrence instances. A pathological feed
// (10k weekly RRULEs over a decade) could otherwise blow the worker out. We
// bail with an Error well before that point so the UI can surface a clear
// per-row message in Settings instead of freezing.
export const MAX_INSTANCES_PER_FEED = 5000;

export class IcsTooLargeError extends Error {
  constructor() {
    super(
      `This calendar expands to more than ${MAX_INSTANCES_PER_FEED} events in the ~60-day window. ` +
        `Subscribe to a smaller or more focused feed.`,
    );
    this.name = "IcsTooLargeError";
  }
}

function jsDateToISOString(date: Date): string {
  return date.toISOString();
}

function timeToISODate(time: ICAL.Time): ISODate {
  const y = String(time.year).padStart(4, "0");
  const m = String(time.month).padStart(2, "0");
  const d = String(time.day).padStart(2, "0");
  return `${y}-${m}-${d}` as ISODate;
}

function makeEventId(calendarId: string, uid: string, startAt: string): string {
  return `${calendarId}::${uid}::${startAt}`;
}

function buildEvent(
  calendarId: string,
  uid: string,
  summary: string,
  location: string | undefined,
  start: ICAL.Time,
  end: ICAL.Time,
): IcsEvent {
  const allDay = start.isDate;
  const startAt = allDay ? timeToISODate(start) : jsDateToISOString(start.toJSDate());
  const endAt = allDay ? timeToISODate(end) : jsDateToISOString(end.toJSDate());
  return {
    id: makeEventId(calendarId, uid, startAt),
    calendarId,
    uid,
    title: summary || "(no title)",
    startAt,
    endAt,
    allDay,
    location: location || undefined,
  };
}

export function parseIcs(text: string, calendarId: string): IcsEvent[] {
  const jcal = ICAL.parse(text);
  const root = new ICAL.Component(jcal);
  const vevents = root.getAllSubcomponents("vevent");

  const today = todayLocal();
  const rangeStartJs = addDays(today, -EXPANSION_DAYS_PAST);
  const rangeEndJs = addDays(today, EXPANSION_DAYS_FUTURE + 1);
  const rangeStart = ICAL.Time.fromJSDate(rangeStartJs, false);
  const rangeEnd = ICAL.Time.fromJSDate(rangeEndJs, false);

  const out: IcsEvent[] = [];

  const push = (ev: IcsEvent) => {
    out.push(ev);
    if (out.length > MAX_INSTANCES_PER_FEED) {
      throw new IcsTooLargeError();
    }
  };

  for (const ve of vevents) {
    const status = ve.getFirstPropertyValue("status");
    if (typeof status === "string" && status.toUpperCase() === "CANCELLED") continue;

    const event = new ICAL.Event(ve);
    const uid = event.uid ?? "no-uid";
    const summary = event.summary ?? "";
    const location = event.location || undefined;

    if (!event.startDate) continue;

    if (!event.isRecurring()) {
      const start = event.startDate;
      const end = event.endDate ?? start;
      const startJs = start.toJSDate();
      if (startJs < rangeStartJs || startJs > rangeEndJs) continue;
      push(buildEvent(calendarId, uid, summary, location, start, end));
      continue;
    }

    const iterator = event.iterator();
    let safety = 1000;
    while (safety-- > 0) {
      const next = iterator.next();
      if (!next) break;
      if (next.compare(rangeEnd) > 0) break;
      if (next.compare(rangeStart) < 0) continue;
      try {
        const details = event.getOccurrenceDetails(next);
        push(
          buildEvent(
            calendarId,
            uid,
            details.item.summary ?? summary,
            details.item.location || location,
            details.startDate,
            details.endDate,
          ),
        );
      } catch {
        // skip occurrences we can't resolve (rare exception edge cases)
      }
    }
  }

  out.sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return a.startAt < b.startAt ? -1 : a.startAt > b.startAt ? 1 : 0;
  });
  return out;
}
