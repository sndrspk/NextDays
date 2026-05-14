import ICAL from "ical.js";
import type { IcsCalendarRow, ISODate } from "../types";
import { addDays, todayLocal, toISODate } from "./dates";
import { supabase } from "./supabase";

// Backwards-compat alias for the rest of the app that imports IcsCalendar
// from this module. The canonical shape is the Postgres row.
export type IcsCalendar = IcsCalendarRow;

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

interface IcsCache {
  fetchedAt: string;
  events: IcsEvent[];
}

const CACHE_KEY_PREFIX = "nextdays:icsCalendarCache:";
const EXPANSION_DAYS_PAST = 1;
const EXPANSION_DAYS_FUTURE = 60;
export const ICS_STALE_MS = 15 * 60 * 1000;

function jsDateToISOString(date: Date): string {
  return date.toISOString();
}

function timeToISODate(time: ICAL.Time): ISODate {
  // All-day Times have isDate=true; toJSDate() returns midnight in floating tz,
  // so we read the date components directly to avoid a timezone shift.
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
      out.push(buildEvent(calendarId, uid, summary, location, start, end));
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
        out.push(
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

// Most public .ics endpoints don't send CORS headers, so we route the fetch
// through the `fetch-ics` Supabase Edge Function. The user's JWT is sent
// automatically via the supabase client — only signed-in members of this
// project can use the proxy.
export async function fetchIcsCalendar(cal: IcsCalendar): Promise<IcsEvent[]> {
  const { data, error } = await supabase.functions.invoke<{
    text?: string;
    error?: string;
  }>("fetch-ics", { body: { url: cal.url } });

  if (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (/Function not found|404|not.*deploy/i.test(detail)) {
      throw new Error(
        "The fetch-ics Edge Function isn't deployed yet. Run `supabase functions deploy fetch-ics`.",
      );
    }
    throw new Error(`Couldn't reach the calendar: ${detail}`);
  }
  if (data?.error) {
    throw new Error(data.error);
  }
  const text = data?.text ?? "";
  if (!text) {
    throw new Error("Empty response from the calendar.");
  }
  return parseIcs(text, cal.id);
}

function cacheKey(calendarId: string): string {
  return `${CACHE_KEY_PREFIX}${calendarId}`;
}

export function loadCachedEvents(calendarId: string): IcsCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(calendarId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "fetchedAt" in parsed &&
      "events" in parsed &&
      Array.isArray((parsed as IcsCache).events)
    ) {
      return parsed as IcsCache;
    }
  } catch {
    // Corrupt cache — ignore.
  }
  return null;
}

export function writeCachedEvents(calendarId: string, events: IcsEvent[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload: IcsCache = { fetchedAt: new Date().toISOString(), events };
    window.localStorage.setItem(cacheKey(calendarId), JSON.stringify(payload));
  } catch {
    // Quota / private mode — silent.
  }
}

export function clearCachedEvents(calendarId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(cacheKey(calendarId));
  } catch {
    // ignore
  }
}

export function eventISODate(event: IcsEvent): ISODate {
  if (event.allDay) return event.startAt as ISODate;
  return toISODate(new Date(event.startAt));
}

export function eventsByDate(events: IcsEvent[]): Map<ISODate, IcsEvent[]> {
  const map = new Map<ISODate, IcsEvent[]>();
  for (const ev of events) {
    const key = eventISODate(ev);
    const list = map.get(key);
    if (list) {
      list.push(ev);
    } else {
      map.set(key, [ev]);
    }
  }
  for (const list of map.values()) {
    list.sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.startAt < b.startAt ? -1 : a.startAt > b.startAt ? 1 : 0;
    });
  }
  return map;
}

export function formatEventTime(event: IcsEvent): string {
  if (event.allDay) return "";
  const d = new Date(event.startAt);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// All-day events stay visible for the full day they span (endAt is exclusive
// midnight of the next day). Timed events disappear once endAt has passed.
export function isPastEvent(event: IcsEvent, now: number = Date.now()): boolean {
  if (event.allDay) return false;
  return new Date(event.endAt).getTime() <= now;
}

export function tintBackground(colour: string): string {
  // Append a low-alpha hex byte so the colour reads as a translucent fill.
  // Works for #rrggbb inputs (PROJECT_COLOURS are all 6-digit hex).
  if (/^#[0-9a-f]{6}$/i.test(colour)) return `${colour}22`;
  return colour;
}
