import type { DueUrgency } from "./dates";

export interface DueBadge {
  label: string;
  className: string;
}

// Casing is deliberately mixed per the spec, so no `uppercase` utility here —
// the label text is exactly what renders. Only the first four rungs of the
// urgency ladder get a badge; "later", "none", and completed tasks get none.
const BADGES: Partial<Record<DueUrgency, DueBadge>> = {
  overdue: { label: "OVERDUE", className: "bg-red-600 text-white" },
  today: { label: "DUE TODAY", className: "bg-orange-500 text-white" },
  tomorrow: { label: "Due Tomorrow", className: "bg-yellow-200 text-stone-900" },
  dayAfter: { label: "Due in 2 days", className: "bg-slate-200 text-stone-900" },
};

export function dueBadgeFor(urgency: DueUrgency): DueBadge | null {
  return BADGES[urgency] ?? null;
}

// Shared pill geometry, so the due badge and the tag chips on a task card sit
// on the same baseline and read as one row of pills.
export const PILL_BASE =
  "ml-1.5 whitespace-nowrap rounded-full px-1.5 py-px align-middle text-[10px] font-semibold leading-[1.4] no-underline";

// One pastel for every tag — deliberately outside the red/orange/yellow/grey
// urgency ramp so a tag never reads as a due state, and picked to sit with the
// app's lilac background wash.
export const TAG_PILL = "bg-violet-100 text-violet-700";

// Completed rows keep their tags, but muted: a bright chip next to a
// struck-through title pulls more attention than the task deserves.
export const TAG_PILL_COMPLETED = "bg-slate-100 text-stone-400";
