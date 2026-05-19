interface CompletedToggleProps {
  showCompleted: boolean;
  onChange: (next: boolean) => void;
}

// Segmented toggle: the "visible" side is marked with a stricken-through T;
// the "hide" side is intentionally empty to read as "no completed tasks shown".
// Defaults are owned by the caller and reset on every refresh (no persistence).
export default function CompletedToggle({ showCompleted, onChange }: CompletedToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Show completed tasks"
      className="inline-flex w-fit gap-0.5 rounded-lg border border-slate-200/80 bg-white/60 p-0.5 text-[12px]"
    >
      <button
        type="button"
        role="radio"
        aria-checked={showCompleted}
        aria-label="Show completed tasks"
        title="Show completed"
        onClick={() => onChange(true)}
        className={`focus-ring flex h-7 w-9 items-center justify-center rounded-md transition-all duration-150 ease-out-soft ${
          showCompleted
            ? "bg-accent-50 text-accent-700"
            : "text-stone-500 hover:text-stone-900"
        }`}
      >
        <StrickenT />
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={!showCompleted}
        aria-label="Hide completed tasks"
        title="Hide completed"
        onClick={() => onChange(false)}
        className={`focus-ring h-7 w-9 rounded-md transition-all duration-150 ease-out-soft ${
          !showCompleted
            ? "bg-accent-50 text-accent-700"
            : "text-stone-500 hover:text-stone-900"
        }`}
      />
    </div>
  );
}

function StrickenT() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <path d="M4 4 L12 4" />
      <path d="M8 4 L8 12" />
      <path d="M3 8.5 L13 8.5" />
    </svg>
  );
}
