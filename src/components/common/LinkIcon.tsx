// The single link glyph used everywhere a task's URL is shown — the task card
// in Calendar / Focus and the URL row in the task detail panel.
export default function LinkIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <path d="M6.6 9.4a2.6 2.6 0 003.68 0l2.12-2.12a2.6 2.6 0 10-3.68-3.68l-.9.9" />
      <path d="M9.4 6.6a2.6 2.6 0 00-3.68 0L3.6 8.72a2.6 2.6 0 103.68 3.68l.9-.9" />
    </svg>
  );
}
