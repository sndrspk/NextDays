import { RRule, type Frequency } from "rrule";
import type { ISODate } from "../types";

// How far ahead the client materialises recurring instances.
export const RECURRENCE_HORIZON_DAYS = 60;

export type RecurrencePreset = "none" | "daily" | "weekly" | "monthly" | "custom";

export type RecurrenceUnit = "day" | "week" | "month";

export type RecurrenceEnds =
  | { kind: "never" }
  | { kind: "after"; count: number }
  | { kind: "on"; date: ISODate };

export interface RecurrenceForm {
  preset: RecurrencePreset;
  // Only consulted for preset === "custom".
  interval: number;
  unit: RecurrenceUnit;
  ends: RecurrenceEnds;
}

export const NO_RECURRENCE: RecurrenceForm = {
  preset: "none",
  interval: 1,
  unit: "week",
  ends: { kind: "never" },
};

// All date arithmetic here lives in UTC so RRule's UTC outputs and our ISO
// strings agree regardless of the browser timezone. We never reach for the
// local helpers in ./dates from inside this file.
function isoToDate(iso: ISODate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function dateToIso(date: Date): ISODate {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDaysIso(iso: ISODate, days: number): ISODate {
  const d = isoToDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return dateToIso(d);
}

const WEEKDAY_RRULE_TOKENS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

// Build an RFC 5545 RRULE string (the part after "RRULE:") from a form.
export function buildRRule(form: RecurrenceForm, dtstart: ISODate): string {
  const parts: string[] = [];

  switch (form.preset) {
    case "daily":
      parts.push("FREQ=DAILY");
      break;
    case "weekly": {
      const weekday = isoToDate(dtstart).getUTCDay();
      parts.push("FREQ=WEEKLY", `BYDAY=${WEEKDAY_RRULE_TOKENS[weekday]}`);
      break;
    }
    case "monthly": {
      const day = isoToDate(dtstart).getUTCDate();
      parts.push("FREQ=MONTHLY", `BYMONTHDAY=${day}`);
      break;
    }
    case "custom": {
      const freq: Record<RecurrenceUnit, string> = {
        day: "DAILY",
        week: "WEEKLY",
        month: "MONTHLY",
      };
      parts.push(`FREQ=${freq[form.unit]}`);
      if (form.interval > 1) parts.push(`INTERVAL=${form.interval}`);
      break;
    }
    case "none":
      throw new Error("buildRRule: preset 'none' has no rule");
  }

  if (form.ends.kind === "after") {
    parts.push(`COUNT=${form.ends.count}`);
  } else if (form.ends.kind === "on") {
    // RRULE UNTIL takes a UTC datetime; encode end-of-day so the date itself is inclusive.
    const [y, m, d] = form.ends.date.split("-");
    parts.push(`UNTIL=${y}${m}${d}T235959Z`);
  }

  return parts.join(";");
}

// Reverse: parse an RRULE string back into a form, best-effort. Used to seed
// the editor when re-opening a recurring task. Anything we can't recognise
// surfaces as "custom" with sensible defaults so the user can still edit it.
export function parseRRule(rrule: string, dtstart: ISODate): RecurrenceForm {
  const kv = Object.fromEntries(
    rrule.split(";").map((p) => {
      const [k, v] = p.split("=");
      return [k.toUpperCase(), v];
    }),
  );

  const freq = (kv.FREQ ?? "").toUpperCase();
  const interval = kv.INTERVAL ? Number(kv.INTERVAL) : 1;

  let ends: RecurrenceEnds = { kind: "never" };
  if (kv.COUNT) {
    ends = { kind: "after", count: Number(kv.COUNT) };
  } else if (kv.UNTIL) {
    const u = kv.UNTIL;
    // UNTIL is YYYYMMDDTHHMMSSZ; we want the date portion only.
    ends = { kind: "on", date: `${u.slice(0, 4)}-${u.slice(4, 6)}-${u.slice(6, 8)}` };
  }

  if (interval === 1) {
    if (freq === "DAILY") return { preset: "daily", interval: 1, unit: "day", ends };
    if (freq === "WEEKLY") {
      const weekday = isoToDate(dtstart).getUTCDay();
      const byday = kv.BYDAY?.toUpperCase();
      if (!byday || byday === WEEKDAY_RRULE_TOKENS[weekday]) {
        return { preset: "weekly", interval: 1, unit: "week", ends };
      }
    }
    if (freq === "MONTHLY") {
      const day = isoToDate(dtstart).getUTCDate();
      const bymonthday = kv.BYMONTHDAY ? Number(kv.BYMONTHDAY) : null;
      if (bymonthday === null || bymonthday === day) {
        return { preset: "monthly", interval: 1, unit: "month", ends };
      }
    }
  }

  const unit: RecurrenceUnit =
    freq === "DAILY" ? "day" : freq === "MONTHLY" ? "month" : "week";
  return { preset: "custom", interval: Math.max(1, interval), unit, ends };
}

function buildRule(rruleStr: string, dtstart: ISODate): RRule {
  return new RRule({
    ...RRule.parseString(rruleStr),
    dtstart: isoToDate(dtstart),
  } as { freq: Frequency; dtstart: Date });
}

// Compute the occurrences of an rrule that fall within [from, to], inclusive.
export function occurrencesBetween(
  rruleStr: string,
  dtstart: ISODate,
  from: ISODate,
  to: ISODate,
): ISODate[] {
  return buildRule(rruleStr, dtstart)
    .between(isoToDate(from), isoToDate(to), true)
    .map(dateToIso);
}

// First occurrence of the rule on or after `after`. Used to pair a due-rule
// occurrence to a start-rule occurrence inside the generator.
export function nextOccurrenceOnOrAfter(
  rruleStr: string,
  dtstart: ISODate,
  after: ISODate,
): ISODate | null {
  const next = buildRule(rruleStr, dtstart).after(isoToDate(after), true);
  return next ? dateToIso(next) : null;
}

export function horizonEnd(today: ISODate): ISODate {
  return addDaysIso(today, RECURRENCE_HORIZON_DAYS);
}
