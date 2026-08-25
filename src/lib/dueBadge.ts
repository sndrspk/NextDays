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
