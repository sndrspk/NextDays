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

export function formatColumnHeader(date: Date): { weekday: string; dayMonth: string } {
  return {
    weekday: WEEKDAYS[date.getDay()],
    dayMonth: `${date.getDate()} ${MONTHS[date.getMonth()]}`,
  };
}

export function buildDayWindow(start: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}
