import type { DueUrgency } from "./dates";

export interface DueBadge {
  label: string;
  className: string;
}

// Casing is deliberately mixed per the spec, so no `uppercase` utility here —
// the label text is exactly what renders.
const BADGES: Partial<Record<DueUrgency, DueBadge>> = {
  overdue: { label: "OVERDUE", className: "bg-red-600 font-semibold text-white" },
  today: { label: "DUE TODAY", className: "bg-orange-500 font-semibold text-white" },
  tomorrow: { label: "Due Tomorrow", className: "bg-yellow-200 font-semibold text-stone-900" },
  dayAfter: { label: "Due in 2 days", className: "bg-slate-200 font-semibold text-stone-900" },
};

// The calm end of the ladder: an outlined white pill with plain black text, so
// a date three weeks out reports itself without competing with the saturated
// rungs above it. This is the only pill that isn't bold.
const LATER = "border border-slate-300 bg-white font-normal text-stone-900";

// Rounded rather than exact once a date is a week or more away — "Due in 17
// days" is precision nobody acts on. The bands are: 3–6 days counted out, then
// a week (7–13), two weeks (14–20), and several weeks beyond that.
function laterLabel(daysUntil: number): string {
  if (daysUntil < 7) return `Due in ${daysUntil} days`;
  if (daysUntil < 14) return "Due in a week";
  if (daysUntil < 21) return "Due in two weeks";
  return "Due in several weeks";
}

/**
 * The pill for a task's due state, or null when it should show none.
 *
 * Every rung of the ladder carries a badge, so the only tasks without one are
 * those with no due date at all — and completed tasks, which `dueUrgency`
 * already collapses to "none" (a struck-through row doesn't need a countdown).
 *
 * `daysUntil` is only read for the "later" rung, where the label depends on
 * the actual distance; it is a required parameter so a call site can't forget
 * it and silently drop the pill. Pass null for an undated task.
 */
export function dueBadgeFor(urgency: DueUrgency, daysUntil: number | null): DueBadge | null {
  const fixed = BADGES[urgency];
  if (fixed) return fixed;
  if (urgency !== "later" || daysUntil === null) return null;
  return { label: laterLabel(daysUntil), className: LATER };
}

// Shared pill geometry, so the due badge and the tag chips on a task card sit
// on the same baseline and read as one row of pills. Font weight is *not* set
// here — the "later" badge is the one pill that stays non-bold, so each
// className below carries its own weight.
export const PILL_BASE =
  "ml-1.5 whitespace-nowrap rounded-full px-1.5 py-px align-middle text-[10px] leading-[1.4] no-underline";

// One pastel for every tag — deliberately outside the red/orange/yellow/grey
// urgency ramp so a tag never reads as a due state, and picked to sit with the
// app's lilac background wash.
export const TAG_PILL = "bg-violet-100 font-semibold text-violet-700";

// Completed rows keep their tags, but muted: a bright chip next to a
// struck-through title pulls more attention than the task deserves.
export const TAG_PILL_COMPLETED = "bg-slate-100 font-semibold text-stone-400";
