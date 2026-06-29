import type { CalendarLayout } from "../../state/settings";

interface LayoutToggleProps {
  layout: CalendarLayout;
  onChange: (next: CalendarLayout) => void;
}

// Segmented toggle for the calendar layout. "Columns" is drawn as three
// vertical bars; "Grid" as one wide bar on top with two smaller bars below.
export default function LayoutToggle({ layout, onChange }: LayoutToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Calendar layout"
      className="inline-flex w-fit gap-0.5 rounded-lg border border-slate-200/80 bg-white/60 p-0.5 text-[12px]"
    >
      <button
        type="button"
        role="radio"
        aria-checked={layout === "columns"}
        aria-label="Columns layout"
        title="Columns"
        onClick={() => onChange("columns")}
        className={`focus-ring flex h-7 w-9 items-center justify-center rounded-md transition-all duration-150 ease-out-soft ${
          layout === "columns"
            ? "bg-accent-50 text-accent-700"
            : "text-stone-500 hover:text-stone-900"
        }`}
      >
        <ColumnsIcon />
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={layout === "grid"}
        aria-label="Grid layout"
        title="Grid"
        onClick={() => onChange("grid")}
        className={`focus-ring flex h-7 w-9 items-center justify-center rounded-md transition-all duration-150 ease-out-soft ${
          layout === "grid"
            ? "bg-accent-50 text-accent-700"
            : "text-stone-500 hover:text-stone-900"
        }`}
      >
        <GridIcon />
      </button>
    </div>
  );
}

function ColumnsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" width="15" height="15" fill="currentColor">
      <rect x="2" y="3" width="3" height="10" rx="1" />
      <rect x="6.5" y="3" width="3" height="10" rx="1" />
      <rect x="11" y="3" width="3" height="10" rx="1" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" width="15" height="15" fill="currentColor">
      <rect x="2" y="3" width="12" height="4" rx="1" />
      <rect x="2" y="9" width="5.5" height="4" rx="1" />
      <rect x="8.5" y="9" width="5.5" height="4" rx="1" />
    </svg>
  );
}
