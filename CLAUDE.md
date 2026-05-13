# CLAUDE.md — NextDays

Internal notes for Claude (future sessions) and human developers. Keep this current after every meaningful change.

## What this project is

NextDays is a keyboard-first rolling-day task manager (Teuxdeux / Tweek inspired). Full vision and spec live in `nextdays-project-plan.md` — always treat that file as the source of truth for product behaviour.

## Tech stack (target, per plan §2)

- React + TypeScript
- Vite (build + dev server)
- Tailwind CSS
- TanStack Query for server state
- Supabase (Postgres + Auth)
- GitHub Pages for hosting (deploy comes in Milestone 7)

## Repo layout (current)

```
/
├── CLAUDE.md                       # this file
├── VERSIONS.md                     # running changelog
├── README.md                       # user-facing readme
├── WISHLIST.md                     # post-M7.5 feature backlog, sized + spec'd
├── nextdays-project-plan.md        # product spec (do not modify lightly)
└── (scaffold added in Milestone 1)
```

Once Milestone 1 lands, expect to see:
```
├── index.html
├── package.json
├── tsconfig*.json
├── vite.config.ts
├── tailwind.config.ts / postcss.config.cjs
├── .env.example                    # template; real .env is gitignored
├── supabase/
│   └── migrations/0001_init.sql    # schema from plan §4
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── lib/supabase.ts
    └── components/dev/SmokeScreen.tsx
```

## Working agreements

- **Branches:** each milestone is developed on its own branch (e.g. M6 → `claude/nextdays-m6-UumCU`). Do not push to `main`.
- **PRs:** at the end of every milestone, open a pull request from the milestone branch into `main` so the user can review + merge. Don't wait to be asked — it's the default handoff. Include a short summary and a manual test plan.
- **Spec discipline:** if a task seems to conflict with `nextdays-project-plan.md`, ask before deviating. Section §10 ("Key Design Decisions to Preserve") is especially important.
- **Bookkeeping:** after each meaningful edit, update `CLAUDE.md` (this file) and add a one-line entry to `VERSIONS.md`.
- **Secrets:** never commit `.env`. Only `.env.example` goes in git. The Supabase **anon** key is fine to ship to the browser; the **service-role** key must never end up in client code or the repo.

## Supabase

- Project is hosted on Supabase cloud (free tier). The user owns the project; Claude does not provision it.
- Client lives in `src/lib/supabase.ts` and is constructed from `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
- Schema is checked into `supabase/migrations/` so anyone can re-apply it. Run it via the Supabase SQL editor (paste & run) or the Supabase CLI if/when added.
- **Auth + RLS (added at M7.5):** Supabase magic-link auth (single owner). RLS enabled on all four tables; every row has `user_id` defaulting to `auth.uid()`.
  - Client passes `shouldCreateUser: false` to `signInWithOtp`, so strangers entering their own email get rejected with "This email isn't authorised to sign in." Only existing rows in `auth.users` can request a magic link.
  - **The owner is created manually once**: Supabase dashboard → Authentication → Users → "Add user" → use your email. After that, sign-in works.
  - The Supabase project needs its **Redirect URLs** allowlist to include both `http://localhost:5173` (dev) and the deployed origin (`https://sndrspk.github.io/NextDays/`) for the magic-link round-trip to land back on the app.

## Schema notes (plan §4 + §10)

- `tasks.scheduled_date` is mutable; rollover rewrites it daily.
- `tasks.start_date` is user-set; rollover never touches it. A task is hidden from the calendar when `start_date > scheduled_date` (the "delayed start" one-off case). For recurring instances the generator always sets `start_date = scheduled_date`, so they appear in their own future column inside the calendar window. The filter is applied client-side in `useTasks` because PostgREST can't compare two columns in a URL.
- `projects.is_personal` flips weekend-rollover behaviour for tasks in that project (see plan §5.3).
- `custom_lists` / `custom_list_items` are intentionally separate from tasks — do not merge or share types.
- **Recurrence (added at M8, revised in same milestone):** `task_templates` holds two independent rules — `start_rrule` + `start_dtstart` and `due_rrule` + `due_dtstart`. The CHECK constraint `task_templates_at_least_one_rule` forces at least one pair to be populated. `tasks.template_id` (nullable, `on delete set null`) ties materialised instances back. Pairing model when both rules are set: **start drives** — every start_rrule occurrence in `[today, today+60d]` spawns one instance with `scheduled_date = start_date = occurrence`, and `due_date = next occurrence of due_rrule on or after that start_date`. When only due_rrule is set, that rule drives: `scheduled_date = due_date = occurrence`, `start_date = null`. The generator (`lib/recurrence.ts` + `useRecurrenceGenerator` / `runRecurrenceGenerator`) runs once per app load and again after the panel saves a recurrence. Past instances are never re-created — if you delete yesterday's, it stays deleted. Editing a single instance does not propagate to future instances; edit the template via the panel for that. The original scheduled-date-anchored model (migration 0003) is superseded by 0004 — apply both in order on a fresh DB, or just 0004 if 0003 already ran.

## How to run (will be true once Milestone 1 lands)

```
npm install
cp .env.example .env   # then fill in Supabase URL + anon key
npm run dev            # http://localhost:5173
```

The dev build includes a temporary "Smoke" panel that creates, lists, and deletes a task to prove the Supabase client works. Removed/hidden once Milestone 2 starts.

## Milestone status

- [x] M1 — Skeleton & DB (scaffold landed, schema applied to Supabase, smoke screen verified end-to-end)
- [x] M2 — Calendar Strip (read-only): responsive day window, today highlight, sort per §5.2, due-date 🔔 indicators per §5.4, future-`start_date` gating. **Desktop day count is user-controlled at 3 or 5 days (default 5)** — replaces the original fixed 7-day desktop window. A segmented toggle rendered in the calendar header at `xl:` (≥ 1280px) flips between the two; the choice is persisted in `localStorage` under `nextdays:desktopDayCount` via `SettingsProvider`. Desktop columns get wider min-widths (`xl:min-w-[180px]` / `2xl:min-w-[220px]`) so the 5-day default still breathes and 3-day mode fills the strip. Column headers were also flipped: the date (e.g. `13 May`) is the small-caps letter-spaced top line, and the larger label below reads `Today` for the current column, `Tomorrow` for the next, and the weekday name beyond that.
- [x] M3 — Task Interactions: per-column quick-add, checkbox toggle (`completed`/`completed_at`), client-side rollover on app load with work-project weekend exception
- [x] M4 — Task Detail Panel: click-to-open slide-in panel with auto-save-on-blur for title, notes, start/due dates, project (dropdown), and tags. Escape/backdrop/× to close.
- [x] M5 — Projects: sidebar list with create/edit/delete (`ProjectForm`), Personal/Work toggle that activates the rollover exception, `ProjectView` with active/completed/all filter, coloured project dot on task cards. Inter set as the interface font.
- [x] M6 — Custom Lists: sidebar "Lists" section with create/rename/delete (inline `ListNameForm`), `CustomListView` page with active/completed/all filter, inline item add, checkbox toggle, per-item notes (expand-on-demand), title editing on blur, and delete. View state extended with `{ kind: "list" }`.
- [x] M7 — Polish & Deploy: GitHub Pages deploy workflow (`.github/workflows/deploy.yml`) with Vite `base` set to `/NextDays/` under Actions. Visual overhaul to a macOS-app feel — Apple-gray canvas with soft radial accents, glass sidebar with `backdrop-blur`, floating calendar card with `shadow-elevated`, today column with gradient + accent stripe, circular accent-coloured checkboxes, segmented filter control, glass task-detail panel with larger title input, refined empty states, custom thin scrollbars, accent focus rings. Tailwind theme extended (`shadow-card`/`elevated`/`panel`, `accent`, `ease-out-soft`, `animate-fade-up`).
- [x] M7.5 — Auth + RLS (prerequisite for public deploy): Supabase magic-link sign-in (single owner), session gating, sign-out in sidebar footer. Migration `0002_auth.sql` wipes existing rows, adds `user_id uuid not null default auth.uid()` to all four tables, enables RLS, and adds per-command policies (select/insert/update/delete) scoped to `auth.uid() = user_id`.
- [x] M9 — Wishlist 7 (Focus view): new top-level sidebar entry below "Calendar" routes to `FocusView` (`src/components/focus/FocusView.tsx`). Three sections — Overdue / Due today / Scheduled for today — driven by `useFocusTasks` which fetches uncompleted tasks where `scheduled_date = today OR due_date <= today` and partitions client-side. Reuses `TaskCard` so urgency colouring + bold + recurring glyph stay in sync. Empty groups hide their heading; all-empty shows a single "Inbox zero" state. Quick-add at the top creates a task with `scheduled_date = today`. View union extended with `{ kind: "focus" }`.
- [x] Visual redesign (Morgen / Routine feel) — Body background is a single linear blue → lilac wash (`#eef2ff → #f1eefe → #f7eefd → #fdf4ff`) in `src/index.css`; brand accent moved to indigo `#6366f1` in `tailwind.config.ts` with matching 50/100/600/700 ramp. Glass surfaces (`bg-white/X` + `backdrop-blur-*`) have been removed across the app — surfaces are solid white (or `bg-white/95` so the gradient peeks through subtly) and elevation is now carried by thin `border-slate-200/80` lines, not shadow stacks. `shadow-card` / `shadow-elevated` are unused; `shadow-panel` is softened to a single `0 10px 30px -12px rgba(31,35,48,0.18)` and applied only to `TaskDetailPanel` and `SignIn`. Active states (sidebar rows, segmented filter pills) use a tinted `bg-accent-50 text-accent-700` instead of a white card; today column uses a flat `bg-accent-50/40` tint with no gradient or stripe. Hovers standardised on `slate-*` shades for palette coherence.
- [x] Mobile responsiveness — Three responsive tiers wired through `useDayCount` (3 days at `< 640`, 4 days at `640–1279`, user-chosen 3 or 5 days — default 5 — at `≥ 1280`; the desktop tier was originally a fixed 7 and is now driven by the `SettingsProvider` toggle). `CalendarStrip` switches to vertical stacking on phones (`flex-col sm:flex-row`); each `DayColumn` uses bottom-border dividers on mobile, right-border on `sm+`. `Sidebar` is an off-canvas drawer on `< md` (`fixed inset-y-0 left-0 w-72 max-w-[85vw]`, translate-x, backdrop overlay) and a static column on `md+`; props `mobileOpen` + `onMobileClose` drive the drawer. `AppShell` owns the open state and auto-closes the drawer on view change. A mobile-only top bar (`md:hidden`) above `<main>` exposes a hamburger plus the current view name. `TaskDetailPanel` becomes a bottom-sheet on `< sm` (`inset-x-0 bottom-0 top-12`, translate-y), retains the right-side floating card on `sm+`. View body padding drops to `px-4 py-5` on mobile across calendar / focus / project / list views, headers scale 26 → 22 px, the project quick-add input goes full-width on phones, and project/list row paddings tighten to `px-4`.
- [x] Project-coloured task circles — The per-task completion circle in `TaskCard` (calendar + focus) and `ProjectTaskRow` (project view) now carries the task's project colour: border always, fill on completion. Applied via inline `style={{ borderColor, backgroundColor }}` since the colour is dynamic per project. Border weight bumped to `border-[1.5px]` for legibility at the 16×16 size; the change applies uniformly so tintless tasks (no project assigned) match the same stroke. The redundant 1.5px coloured dot next to the title in `TaskCard` is removed. The square multi-select checkbox in `ProjectTaskRow` stays indigo so it reads as a separate control. `ProjectView` now passes `project.colour` into `ProjectTaskRow` as `tint`.
- [x] Backup & Restore — JSON snapshot of the user's full dataset, importable with two modes. `src/lib/backup.ts` owns the logic: `exportAll()` runs five parallel `SELECT *` queries and returns a `BackupEnvelope` (`schema_version: 1`, `app: "nextdays"`, `exported_at`, `projects` / `task_templates` / `tasks` / `custom_lists` / `custom_list_items`). `downloadBackup()` saves it as `nextdays-backup-<timestamp>.json`. `parseBackup()` validates JSON shape + app field + schema_version. `importBackup(envelope, mode)`: in **merge** mode each table is `.upsert(..., { onConflict: "id", ignoreDuplicates: true })` so existing IDs are skipped; in **replace** mode every table is wiped (children-then-parents, via `.delete().neq("id", SENTINEL_UUID)` since PostgREST refuses a filterless DELETE — RLS still scopes to the current user) then bulk-inserted parents-then-children. `user_id` is stripped from every row pre-insert so the DB column default `auth.uid()` populates it from the current session — backups are portable across accounts. UI now lives inside the Settings view (`BackupSection` in `src/components/settings/BackupSection.tsx`) — Export section, file picker that previews counts, Mode radio (Merge/Replace), action button. Replace mode requires a `window.confirm` showing exact counts. After a successful import the section calls `qc.invalidateQueries()` to refresh every view. (The previous modal `BackupPanel` triggered from a download-arrow icon in the sidebar footer is removed; the Settings gear icon next to sign-out is the new entry point.)
- [x] Settings view + interface font switcher — New top-level view (`{ kind: "settings" }`) reached from a gear icon in the sidebar footer (`UserFooter`). `src/components/settings/SettingsView.tsx` hosts two panels: **Appearance** with a radio picker for the interface font and **Backup & Restore** which embeds the inlined `BackupSection`. Font choices: Inter (default), Public Sans, Instrument Sans. `SettingsProvider` (`src/state/settings.tsx`) holds the current font in state, persists it in `localStorage` under `nextdays:font`, and writes a `--app-font-sans` CSS variable on `<html>`. Tailwind's `font-sans` consumes that variable with `'"Inter Variable"'` as the in-stack fallback (see `tailwind.config.ts`), so the choice applies to every component using the default font without per-component plumbing. `main.tsx` imports `@fontsource-variable/inter`, `@fontsource-variable/public-sans`, and `@fontsource-variable/instrument-sans` so all three ship with the build. `SettingsProvider` wraps the app above `AuthProvider`, so sign-in inherits the font too.
- [x] Text size setting — Settings gains a **Text size** panel below Appearance with a three-way segmented control: **Normal** (default, 1.0×), **Larger** (1.1×), **Largest** (1.2×). Each preview button renders its label at the target scale so the difference is visible before selecting. State lives alongside `font` and `desktopDayCount` in `SettingsProvider` as `fontSize` / `setFontSize`, persists in `localStorage` under `nextdays:fontSize`. Applied app-wide by writing CSS `zoom` (and a matching `--app-font-scale` variable) onto `<html>` whenever the value changes — `zoom` was chosen over a root `font-size` change because the app uses `text-[Npx]` Tailwind arbitrary values throughout that wouldn't respond to rem scaling; `zoom` proportionally scales typography, spacing, and hit targets in one shot. Mobile layouts stay usable because viewport-relative media queries evaluate at the un-zoomed viewport so the calendar still stacks vertically on phones at 1.20×. `FONT_SIZE_OPTIONS` exports `{ id, label, scale }` tuples; font family is untouched.
- [x] Task management improvements — (1) Stop-repeating deletes future un-completed instances: `useDeleteTaskTemplate` takes `{ id, deleteFutureAfter }` and deletes every `tasks` row with `template_id = X AND completed = false AND scheduled_date > cutoff` before dropping the template; `RecurrenceEditor.save` passes today, so past + today instances stay and only future occurrences disappear. (2) Delete button in `TaskDetailPanel` via new `useDeleteTask`; uses `window.confirm` and closes the panel on success. (3) `ProjectView` gains text search (substring match on title), a tag filter row (chips, OR semantics), and a Select mode with bulk `Complete` / `Mark active` / `Delete` actions. Bulk mutations live in `useBulkCompleteTasks` / `useBulkDeleteTasks` (single `.in("id", ids)` round-trip). Selection state is local to `ProjectView`; row click in select mode toggles selection instead of opening the detail panel. Task rows now also show their tag chips inline.
- [x] M8 — Wishlist 1–3: (1) bold overdue/due-today task titles in calendar + project views via `isDueOrOverdue()` in `lib/dates.ts`. (2) per-project quick-add (`ProjectQuickAdd` in `ProjectView`) schedules new tasks for today. (3) Recurring tasks with the template-plus-instances model. **Schema** (migrations `0003_recurrence.sql` and the follow-up `0004_recurrence_per_field.sql`): per-field recurrence — `start_rrule`/`start_dtstart` and `due_rrule`/`due_dtstart` are independent and at least one pair must be set (DB CHECK). Pairing: start drives generation; due_date for each instance is the next occurrence of the due rule on or after start. **UI**: `RecurrenceEditor` in the task detail panel renders one section per field (Start, Due), each with Daily / Weekly / Monthly / Custom presets and an Ends rule (never / after N / on date). Each section is disabled until the matching date is filled on the task. **Generator**: `useRecurrenceGenerator` + reusable `runRecurrenceGenerator` materialise 60 days ahead on app load and again after a save. `↻` glyph on `TaskCard` flags recurring instances. Editing a single instance affects only that row; the template is the source of truth for future occurrences.

## Backlog

Post-M7.5 feature ideas live in `WISHLIST.md`, each written out as an actionable spec with a rough S/M/L size. Pick the next milestone from there in consultation with the user.
