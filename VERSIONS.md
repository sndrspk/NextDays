# Versions

A running log of changes. Newest at the top. One line per change.

- **0.0.5** — Milestone 3: task interactions. Per-column quick-add (Enter creates task with `scheduled_date` = column date), functional checkbox toggle (sets `completed`/`completed_at`, re-sorts to bottom of column), client-side rollover on app load — unchecked tasks with `scheduled_date < today` move to today, with work-project weekend exception per §5.3.
- **0.0.4** — Milestone 2: read-only `CalendarStrip` with responsive 4/7-day window (`useDayCount`), today highlighted, tasks fetched via `useTasks` and sorted per §5.2 (due-soon pinned, completed greyed/struck at bottom), due-date 🔔 indicators per §5.4, future `start_date` tasks hidden. SmokeScreen removed.
- **0.0.3** — Bumped to Vite 8 + `@vitejs/plugin-react` 6 to clear the rolldown/oxc deprecation warnings emitted under Vite 8. The standalone `@vitejs/plugin-react-oxc` package is deprecated; its functionality is now in `@vitejs/plugin-react`. Typecheck + build green, dev server starts warning-free.
- **0.0.2** — Milestone 1 scaffold: Vite + React + TS + Tailwind + TanStack Query, Supabase client, `supabase/migrations/0001_init.sql` schema, dev-only Supabase smoke screen. Typecheck and production build green.
- **0.0.1** — Added `CLAUDE.md` and `VERSIONS.md` bookkeeping files; Milestone 1 work begins.
