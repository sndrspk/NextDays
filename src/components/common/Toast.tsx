import { useToast } from "../../state/toast";

interface ToastProps {
  id: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function ToastItem({ id, message, actionLabel, onAction }: ToastProps) {
  const { dismiss } = useToast();

  return (
    <div
      role="status"
      className="pointer-events-auto flex w-full items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-panel sm:w-auto"
    >
      <span className="flex-1 text-[13px] text-stone-800">{message}</span>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={() => {
            onAction();
            dismiss(id);
          }}
          className="focus-ring flex-none rounded-md px-2 py-1 text-[12px] font-medium text-accent transition-colors hover:bg-accent-50"
        >
          {actionLabel}
        </button>
      )}
      <button
        type="button"
        onClick={() => dismiss(id)}
        aria-label="Dismiss"
        className="focus-ring flex-none rounded-md p-1 text-stone-400 transition-colors hover:bg-slate-100 hover:text-stone-700"
      >
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-4 py-4 sm:bottom-4 sm:left-auto sm:right-4 sm:items-end sm:px-0 sm:py-0"
    >
      {toasts.map((t) => (
        <ToastItem
          key={t.id}
          id={t.id}
          message={t.message}
          actionLabel={t.actionLabel}
          onAction={t.onAction}
        />
      ))}
    </div>
  );
}
