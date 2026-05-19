// Dev-only logging helpers. In production builds these are no-ops so that
// Supabase error objects (which can contain row IDs and internal messages)
// never reach the browser console for end users. User-facing surfaces should
// always show their own toast / inline error in addition to calling these.

export function devError(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error(...args);
  }
}

export function devWarn(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(...args);
  }
}
