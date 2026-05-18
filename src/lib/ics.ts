import type { IcsCalendarRow, ISODate } from "../types";
import { toISODate } from "./dates";
import { parseIcs, type IcsEvent } from "./icsParse";
import IcsParserWorker from "../workers/icsParser.worker?worker";
import type { ParseResponse } from "../workers/icsParser.worker";
import { supabase } from "./supabase";

// Backwards-compat alias for the rest of the app that imports IcsCalendar
// from this module. The canonical shape is the Postgres row.
export type IcsCalendar = IcsCalendarRow;

// Re-exports so existing callers (`import { parseIcs, IcsEvent } from "./ics"`)
// keep working — the pure parser now lives in ./icsParse so it can be loaded
// from a worker without dragging in the Supabase client.
export { parseIcs };
export type { IcsEvent };

interface IcsCache {
  fetchedAt: string;
  events: IcsEvent[];
}

const CACHE_KEY_PREFIX = "nextdays:icsCalendarCache:";
export const ICS_STALE_MS = 15 * 60 * 1000;
const PARSE_TIMEOUT_MS = 5_000;

// Parse off the main thread. The worker is one-shot — created on demand,
// terminated on either resolution or timeout, so a runaway parse can't leak.
// The 5s timeout bounds even the cap-bail path (`IcsTooLargeError` from
// `icsParse`) so a pathological feed can't lock the UI.
export function parseIcsInWorker(
  text: string,
  calendarId: string,
): Promise<IcsEvent[]> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const worker = new IcsParserWorker();
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      worker.terminate();
      reject(
        new Error(
          `Parsing this calendar took longer than ${PARSE_TIMEOUT_MS / 1000}s and was aborted.`,
        ),
      );
    }, PARSE_TIMEOUT_MS);

    worker.onmessage = (event: MessageEvent<ParseResponse>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      const data = event.data;
      if (data.ok) resolve(data.events);
      else reject(new Error(data.error));
    };

    worker.onerror = (event: ErrorEvent) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      reject(new Error(event.message || "Failed to parse the calendar."));
    };

    worker.postMessage({ text, calendarId });
  });
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
  return parseIcsInWorker(text, cal.id);
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
