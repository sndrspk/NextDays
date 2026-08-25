import type { ISODate } from "../types";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function todayLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function toISODate(date: Date): ISODate {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function diffInDays(a: ISODate, b: ISODate): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const aMs = Date.UTC(ay, am - 1, ad);
  const bMs = Date.UTC(by, bm - 1, bd);
  return Math.round((aMs - bMs) / 86_400_000);
}

export function isSameISODate(a: ISODate, b: ISODate): boolean {
  return a === b;
}

export function isDueOrOverdue(
  dueDate: ISODate | null,
  today: ISODate,
  completed: boolean,
): boolean {
  if (!dueDate || completed) return false;
  return dueDate <= today;
}

// The urgency ladder: overdue → due today → tomorrow → the day after → the
// rest. `orderTasksForDisplay` sorts active tasks by due_date ascending
// (undated last), which walks this ladder in exactly this order, so the badge
// a task shows and its position inside its project group always agree.
export type DueUrgency =
  | "overdue"
  | "today"
  | "tomorrow"
  | "dayAfter"
  | "later"
  | "none";

export function dueUrgency(
  dueDate: ISODate | null,
  today: ISODate,
  completed: boolean,
): DueUrgency {
  if (!dueDate || completed) return "none";
  const d = diffInDays(dueDate, today);
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d === 2) return "dayAfter";
  return "later";
}

// Lower is more urgent. "later" and "none" share the tail of the list, where
// due_date (undated last) keeps ordering them. Used by the ordering tests to
// assert that sorted output never steps back up the ladder.
export const DUE_URGENCY_RANK: Record<DueUrgency, number> = {
  overdue: 0,
  today: 1,
  tomorrow: 2,
  dayAfter: 3,
  later: 4,
  none: 5,
};

export function formatColumnHeader(date: Date): { weekday: string; dayMonth: string } {
  return {
    weekday: WEEKDAYS[date.getDay()],
    dayMonth: `${date.getDate()} ${MONTHS[date.getMonth()]}`,
  };
}

export function buildDayWindow(start: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}
