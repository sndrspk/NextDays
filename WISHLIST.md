# Wishlist

Status legend: ✅ shipped (see `VERSIONS.md` for the matching entry).

Future features, written out so a future Claude session can pick one up and implement it without re-deriving the design. Each item is sized roughly:

- **S** ≈ a focused afternoon, one or two files, no schema change.
- **M** ≈ a milestone-sized chunk: a couple of new components, possibly a migration, manual testing.
- **L** ≈ a multi-day effort spanning schema, server-side code, OAuth, or third-party integration.

When picking one up, follow the working agreements in `CLAUDE.md` (branch per milestone, PR into `main`, update `VERSIONS.md`).

---

## 1. Bold overdue / due-today tasks in every view — **S** — ✅ shipped (0.0.12)

**Goal:** A task whose `due_date <= today` and `completed === false` should render in **bold** wherever it appears, so urgency is visible at a glance without relying on colour or the 🔔 alone.

**Where it has to apply:**
- `src/components/calendar/TaskCard.tsx` — the calendar strip cards.
- `src/components/projects/ProjectView.tsx` → `ProjectTaskRow` — the project list rows.
- (Custom list items in `src/components/lists/CustomListView.tsx` are out of scope: they have no `due_date`.)

**Implementation notes:**
- Extract the "is urgent now" check into a small helper in `src/lib/dates.ts` (e.g. `isDueOrOverdue(task, today)`) so the two call sites stay consistent. The existing `urgency()` in `TaskCard.tsx` already encodes the rule — promote it or reuse the `"overdue" | "today"` cases.
- Apply `font-semibold` (or `font-medium` if semibold looks too heavy against Inter) to the title span. Keep the existing red/orange colour treatment — bold is additive.
- Completed tasks must **not** bold even if they were once overdue — the strike-through styling already wins, but make the helper return `false` when `completed` is true.

**Manual test plan:**
- Create a task due yesterday → bold + red in calendar and project view.
- Create a task due today → bold + orange in calendar, bold in project view.
- Tick it complete → reverts to muted strike-through.
- Task due tomorrow → not bold (current orange 🔔 styling unchanged).

---

## 2. Quick-add tasks from inside a Project view — **S** — ✅ shipped (0.0.12)

**Goal:** While viewing a project (`ProjectView`), I can add a task to that project without bouncing back to the calendar.

**Open design question to confirm before building:** what `scheduled_date` should a project-view-added task get? Options:
- **(a) Today** — matches the calendar quick-add semantics and the task immediately appears in today's column. Recommended default.
- **(b) `null`/no calendar slot** — would require the schema to allow nullable `scheduled_date` (currently `date not null`). Probably out of scope.
- **(c) Prompt the user** — overkill for a quick-add.

Go with (a) unless the user says otherwise.

**Implementation notes:**
- Add a `QuickAdd`-style input pinned at the top (above the segmented filter) or bottom of the task list inside `ProjectView`. Mirror the styling of `src/components/calendar/QuickAdd.tsx`.
- Wire it to `useCreateTask` (already exposed from `useTaskMutations`) with `{ title, project_id: projectId, scheduled_date: today }`.
- After insert, the existing `useProjectTasks(projectId)` query should refetch via the same invalidation `useCreateTask` already triggers — verify it does, and add a `["projectTasks", projectId]` invalidation if not.
- Empty state copy in `ProjectView` currently says "Add a task on the calendar and assign it to this project." — update it now that you can add directly.

**Manual test plan:**
- Open a project with zero tasks → empty state, type a title, press Enter → task appears in the list and also in today's column on the calendar.
- Toggle filter to "completed" → quick-add still works, new task lands in "active".

---

## 3. Recurring start and due dates — **M / L** — ✅ shipped (0.0.12 initial; 0.0.13 reworked to per-field recurrence with start-drives pairing)

**Goal:** A task can recur. Both `start_date` and `due_date` should be expressible as repeating rules (e.g. "every Monday", "every 2 weeks", "the 1st of every month"). When one instance is completed, the next one materialises.

**This is the biggest unknown in the list — confirm the model with the user before building.** Two viable approaches:

**Approach A — "template + instances" (recommended):**
- New table `task_templates` holding the title, notes, project, tags, and an `rrule`-style recurrence (use the `rrule` npm package — it speaks iCal RFC 5545, which keeps us aligned with calendar tooling for item 6).
- A nightly (or on-app-load) job materialises the next pending instance into `tasks` with concrete `scheduled_date` / `start_date` / `due_date`. When an instance is completed, the template generates the next one if one isn't already pending.
- Pros: the existing `tasks` table stays simple, rollover logic untouched.
- Cons: a real new concept in the UI ("this is a recurring task — edit series or edit instance?").

**Approach B — "recurrence on the task row":**
- Add `recurrence_rule text` (RRULE string) and `recurrence_anchor date` columns to `tasks`. When a task with a rule is completed, a clone is inserted with the next occurrence's dates.
- Pros: smaller schema change.
- Cons: muddies the "task is a single thing on a single day" model; editing future occurrences is awkward.

**Implementation notes (whichever approach):**
- New migration: `supabase/migrations/0003_recurrence.sql`.
- Add `rrule` to dependencies.
- UI in `TaskDetailPanel`: a "Repeats" section with the common presets (Daily, Weekly on <weekday>, Monthly on date N, Custom…) plus an "Ends" option (never / after N / on date).
- Decide where the generator runs:
  - **Client-side on app load** (cheap, ships with the SPA) — mirrors the current rollover. Good enough for a single-user app.
  - **Supabase Edge Function on a cron** (e.g. daily) — required if item 5 (Discord notifications) lands, because the notification job needs accurate "today's tasks" without the app being open.
- Visual marker on recurring tasks: a small ↻ glyph next to the title in `TaskCard`.

**Manual test plan:**
- Create a task that repeats every Monday with due_date = same day → today's calendar shows it on each Monday in the window. Completing this Monday's instance does not affect future Mondays.
- "Every 2 weeks starting tomorrow" → only appears every fortnight.
- Delete a single instance from a recurring series → confirmation: "delete just this one, or the whole series?".

---

## 4. Drag-and-drop tasks between calendar days — **M** — ✅ shipped (0.0.26)

**Goal:** Drag a task card from one day column and drop it onto another day; `tasks.scheduled_date` updates to the drop target's date. Should feel native — a slight lift on grab, a drop-zone highlight on the target column, optimistic update on drop.

**Implementation notes:**
- Use `@dnd-kit/core` (lighter than `react-dnd`, no HTML5 backend quirks, great keyboard a11y story). Add `@dnd-kit/core` + `@dnd-kit/sortable` to deps.
- Wrap `CalendarStrip` in a `<DndContext>`. Each `TaskCard` becomes a draggable; each `DayColumn`'s task list becomes a droppable (with an id like `day:2026-05-12`).
- On `onDragEnd`, if the drop target id parses to a date different from the source date, call `useUpdateTask` with `{ scheduled_date: targetDate }`. Use TanStack Query's optimistic update so the card jumps immediately and rolls back on error.
- Edge cases:
  - Dropping onto the same day is a no-op.
  - Dropping a task with a future `start_date` onto a day before that start_date: either also update `start_date` (simplest) or block with a toast. **Recommendation:** also pull `start_date` forward to the new `scheduled_date` if it would otherwise be in the past — matches user intent.
  - Completed tasks should still be draggable (they sit at the bottom of the column) — verify the sort still places them correctly after the move.
- Keep keyboard parity: dnd-kit supports `useKeyboardSensor`; bind something like `space` to pick up, arrow keys to move between columns, `enter` to drop.

**Manual test plan:**
- Drag a task from today's column to "+2 days" → it disappears from today and appears in that column; refresh → still there.
- Drag a task with `due_date = today` to "+3 days" → still bold/red (overdue) per item 1.
- Drag with keyboard (space → arrow right → enter) → same result.
- Drag while offline / Supabase error → card snaps back.

---

## 5. Daily Discord DM with today's scheduled tasks — **M**

**Goal:** Every morning (say, 07:00 in the user's timezone), I get a Discord DM listing today's scheduled, uncompleted tasks. The user already has a Discord server they can reuse for the bot.

**Architecture:**
- **Trigger:** a Supabase scheduled Edge Function. Supabase supports `pg_cron` + `pg_net` natively, or you can use the Edge Functions cron via the dashboard. Cron daily at the user's chosen hour (store as a setting, see below).
- **Delivery options (pick one with the user):**
  - **(a) Discord webhook on a channel** — simplest. The user creates a webhook in their server, we POST JSON to it. No bot, no OAuth. Tasks appear as a message in a chosen channel (not a true DM, but private to that server).
  - **(b) Discord bot with `users.fetch` + `createDM`** — actual DMs. Requires a bot token, the user joining a guild with the bot, and storing the user's Discord ID. Heavier.
  - **Recommendation:** start with (a). Move to (b) only if the user insists on a true DM.

**Implementation notes:**
- New table `user_settings` (or just a JSON column on… we don't have a users table — store in a single-row table `app_settings` keyed by `user_id`):
  - `discord_webhook_url text` (encrypted at rest if you can; otherwise rely on RLS + Supabase's vault).
  - `notification_hour int` (0-23, local).
  - `notification_timezone text` (IANA, e.g. `Europe/Amsterdam`).
  - `notifications_enabled bool`.
- Settings UI: the dedicated `SettingsView` reached from the gear icon in the sidebar footer (shipped 0.0.21) is the home for this — add a "Notifications" panel alongside Appearance and Backup & Restore.
- Edge Function `daily-discord-digest`:
  - Runs hourly via cron.
  - For each user whose `notifications_enabled = true` and whose local time is currently at `notification_hour`, query `tasks` where `scheduled_date = today_local && !completed`, format a message, POST to the webhook.
  - Use the **service-role key** inside the function (server-side only — never expose).
- Migration: `supabase/migrations/0004_notifications.sql`.

**Manual test plan:**
- Set hour to "now + 1 minute", wait, confirm message arrives in Discord.
- Mark all of today's tasks complete → next day's message reads "Nothing scheduled. Enjoy the day."
- Disable notifications → no message.
- Wrong webhook URL → function logs an error, app stays healthy.

---

## 6. Read-only Google Calendar (and friends) overlay — **L** — Path A in progress

**Goal:** Events from my calendars (Google, iCloud, Outlook, Fastmail, …) appear in the day columns alongside my tasks, read-only. Tasks remain the focus; events are visual reminders so I can plan around them.

### Path A — client-side ICS subscription (this implementation)

The original WISHLIST proposed a Supabase Edge Function + new `external_events` table. After consultation with the user we decided to ship a simpler **client-side fetch + cache** version first — zero new server infra, no migration, no cron. The trade-off is that the calendar provider must allow CORS on its secret ICS URL (Google's `calendar.google.com/calendar/ical/.../basic.ics` does; iCloud and Outlook typically do not — those will need Path B or a proxy later).

#### Data model & storage

The subscription list lives in a per-user Supabase table so it follows the account across devices. Parsed event payloads stay in `localStorage` because they're just network output — re-derivable from the URL on first paint.

- **Supabase table `ics_calendars`** (migration `0006_ics_calendars.sql`):
  ```sql
  create table ics_calendars (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid()
      references auth.users(id) on delete cascade,
    url text not null,
    name text not null,
    colour text not null,
    created_at timestamptz not null default now()
  );
  ```
  RLS enabled; per-command policies scoped to `auth.uid() = user_id`. Explicit GRANTs to `anon` (select) and `authenticated` / `service_role` (full CRUD) to comply with the Data API change from migration 0005.
- **`nextdays:icsCalendarCache:<calendarId>`** — most recent parsed result:
  ```ts
  type IcsCache = { fetchedAt: string; events: IcsEvent[] }
  type IcsEvent = {
    id: string;            // `${calendarId}::${uid}::${startAt}`
    calendarId: string;
    uid: string;
    title: string;
    startAt: string;       // ISO 8601 (UTC for timed, YYYY-MM-DD for all-day)
    endAt: string;
    allDay: boolean;
    location?: string;
  }
  ```
  TTL = 15 minutes. Cache is rehydrated on app load so the strip paints immediately; a background refresh runs if stale.

#### Library

`src/lib/ics.ts`:
- `parseIcs(text: string, calendarId: string): IcsEvent[]` — uses `ical.js` (Mozilla). Expands RRULEs into concrete instances spanning `today - 1d → today + 60d` so the calendar strip and future columns have data. Drops cancelled events. Detects all-day via `VALUE=DATE` on `DTSTART`.
- `fetchIcsCalendar(cal: IcsCalendar): Promise<IcsEvent[]>` — `fetch(url)` → parse. Network or CORS failures throw with a friendly message; the hook surfaces them inline (no toasts in this app).
- `loadCachedEvents(calendarId)` / `writeCachedEvents(calendarId, events)` — localStorage read/write with shape validation.
- `eventsForDate(events, isoDate)` — predicate used by `DayColumn` / `FocusView`.
- `formatEventTime(event)` — `"09:30"` for timed, `""` for all-day.

#### Hooks

`src/hooks/useIcsCalendars.ts` exposes the CRUD over the new table:
- `useIcsCalendars()` — `useQuery` (`queryKey: ["icsCalendars"]`) ordered by `created_at` ascending.
- `useCreateIcsCalendar()` / `useUpdateIcsCalendar()` / `useDeleteIcsCalendar()` — all invalidate `["icsCalendars"]`. Delete also clears the local cache entry for that calendar.

`src/hooks/useExternalEvents.ts`:
- Reads the calendar list from `useIcsCalendars()`.
- For each calendar runs a TanStack Query (`queryKey: ["icsCalendar", calendar.id, calendar.url]`, `staleTime: 15 * 60_000`):
  - Initial data comes from `loadCachedEvents` so the UI paints synchronously.
  - `queryFn` calls `fetchIcsCalendar`; on success writes to cache.
- Returns:
  - `events: IcsEvent[]` (flattened across calendars, sorted)
  - `byDate: Map<ISODate, IcsEvent[]>` for O(1) lookup per day
  - `errors: Array<{ calendarId: string; message: string }>` so Settings can show a per-row warning
- Manual refresh handled by `qc.invalidateQueries({ queryKey: ["icsCalendar"] })`.

#### Calendar display

- New component `src/components/calendar/EventCard.tsx`:
  - Renders above the task list inside `DayColumn` (events always go before tasks per the user's request).
  - Card: rounded-md with `background: <colour>20` (12.5% alpha hex suffix) + thin left border `4px solid <colour>` + `text-[12px]`.
  - Timed event: small monospace `09:30` prefix in the calendar colour, then title.
  - All-day event: title only, no time prefix.
  - Non-interactive (`pointer-events-none` is too aggressive — just no `onClick`/no hover state).
- `DayColumn` accepts an `events: IcsEvent[]` prop and renders them in a `<ul>` ahead of the tasks `<ul>`, separated by a 6px gap. Empty event list collapses cleanly.
- `CalendarStrip` calls `useExternalEvents()` once and passes `byDate.get(iso) ?? []` per column.
- Events sort: all-day first, then by `startAt` ascending.

#### Focus screen

`FocusView` gains a new section, rendered **above** "Scheduled for today" only, listing today's calendar events (all-day + timed, sorted as above). When there are no events today the section is hidden entirely — matches the existing pattern for empty sections in this view. Uses the same `EventCard` so styling stays in sync.

The "Inbox zero" empty state only fires when both tasks and events are empty.

#### Settings panel

`src/components/settings/IcsCalendarsSection.tsx`, slotted between **Tags** and **Backup & Restore** in `SettingsView`:
- **Add form** at the top — URL input (required) + name input (optional; defaults to the host or to the first calendar's `X-WR-CALNAME` if we can parse it after a successful fetch) + a colour swatch grid (reuses `PROJECT_COLOURS`) + an Add button. Submit triggers `addIcsCalendar` and an immediate fetch.
- **List** of existing calendars — each row shows: colour swatch (click → palette popover to change), name (click → inline edit), URL (truncated, monospace, click-to-reveal full), last-synced timestamp or error message, a refresh button, and a trash button (with `window.confirm`).
- No drag-reorder; first-added is first-shown.

#### Backup & Restore interaction

Now that the subscription list is account-scoped, `exportAll()` includes the `ics_calendars` rows and `importBackup()` restores them alongside the rest of the data. The envelope keeps `schema_version: 1` and `ics_calendars` is treated as **optional** so older v1 backups taken before this table existed still import cleanly — they just don't carry any calendar rows.

#### Known caveats (call out in the Settings panel)

- **CORS:** Many calendar providers don't send `Access-Control-Allow-Origin: *` on their secret ICS URLs. Google's `basic.ics` form does work. Outlook / iCloud often don't — when they fail the row shows the error message.
- **RRULE limits:** `ical.js` handles standard RFC 5545. Exotic rules (BYSETPOS combinations, complex EXDATE chains) may not expand perfectly; we generate 60 days ahead so any glitch becomes visible quickly.
- **Time zones:** Timed events render in the browser's local time zone. All-day events stay tied to their original date (no UTC shift).

#### Manual test plan

- Add a Google Calendar secret ICS URL → events appear in the right day columns within ~1s; refresh the page → still there (cached).
- Add a colour, switch it → all that calendar's events repaint with the new tint.
- Add an event on Google's side → wait 15 min or hit the refresh button → it shows up.
- Add an event with a daily recurrence → instances appear across every day in the strip.
- Today has 2 events → Focus view shows them in a new section above "Scheduled for today"; if today has none, the section is hidden.
- Remove a calendar → its events disappear from strip and Focus immediately.
- Add an URL that returns 404 / blocked by CORS → row in Settings shows the error; other calendars keep working.
- Backup → restore on a fresh browser → ICS list does **not** carry over (by design).

### Path B — Google Calendar OAuth (future)

Set up a Google Cloud project, enable Calendar API, OAuth consent screen, store refresh tokens server-side (Edge Function + service-role-only table `google_oauth_tokens`). Sync API token refresh + incremental sync (`syncToken`).

Pros: real-time-ish, can extend later (e.g. block out a day from tasks). Cons: substantial scaffolding for very little extra benefit over Path A for a read-only use case. Only build Path B if (a) we want to render events as they're created without delay, (b) we want to render iCloud/Outlook calendars that don't allow CORS, or (c) we eventually want write-back.

---

## 7. "Focus" view — focused list grouped by urgency — **S** — ✅ shipped (0.0.15)

**Goal:** A second top-level view in the sidebar (directly under "Calendar") that strips the rolling-day strip away and shows a single, focused list of what to do *right now*, broken into three sections:

1. **Overdue** — uncompleted tasks with `due_date < today`.
2. **Due today** — uncompleted tasks with `due_date = today`.
3. **Scheduled for today** — uncompleted tasks with `scheduled_date = today` that aren't already in one of the two sections above (i.e. `due_date` is null or `> today`).

Rollover guarantees that overdue tasks have `scheduled_date = today`, so in practice all three groups are subsets of "today's column" partitioned by due date. The view is read/write — clicking a row opens the existing `TaskDetailPanel`, the circular checkbox toggles `completed`, and there's a quick-add at the top that creates a task with `scheduled_date = today`.

**Name: "Focus".** Conveys that the view is opinionated and curated rather than exhaustive. Alternatives considered: "Today" (more literal, matches Things/Todoist convention), "Agenda" (calendar-app convention; potentially confusing next to wishlist item 6's calendar overlay).

**Where it slots into the app:**
- Sidebar (`src/components/sidebar/Sidebar.tsx`): a new entry above the "Projects" section, directly below the "Calendar" entry.
- `src/state/view.ts`: extend the `View` discriminated union with `{ kind: "focus" }`.
- `src/App.tsx` → `MainView`: route `view.kind === "focus"` to a new `FocusView` component.

**Implementation notes:**
- New file `src/components/focus/FocusView.tsx`. Lay it out like `ProjectView` — left-aligned column, h2 heading, three section blocks each with a small uppercase label, a count badge, and the same `TaskCard`-style rows.
- Data: simplest is one query (`useFocusTasks` in `src/hooks/useFocusTasks.ts`) that fetches `tasks` where `completed = false` AND `(scheduled_date = today OR due_date <= today)`. Partition client-side into the three groups in a `useMemo`. RLS already scopes to the owner.
- Reuse the existing `TaskCard` from the calendar so styling (project dot, urgency colouring, bold-on-due, ↻ glyph) stays in sync. If `TaskCard` is too column-specific, refactor it lightly or build a thin `FocusTaskRow` that delegates to the shared parts.
- Quick-add at the top mirrors `QuickAdd.tsx` from the calendar (calls `useCreateTask` with `scheduled_date = today`).
- Empty groups: hide the heading entirely rather than rendering "Nothing here" three times. If *all* three are empty, show a single celebratory empty state ("Inbox zero. Enjoy the day.").
- Sorting within each section: same rule as the calendar (`sort_order` ascending, completed pushed to the bottom — though completed shouldn't appear here at all since the query filters it out).

**Open questions to confirm before building:**
- **Should completed tasks ever show?** Recommendation: no — "Focus" is for outstanding work. Once completed they vanish from this view (they remain visible in the calendar and project views).
- **Should the view auto-refresh at midnight?** Probably yes, but cheap: re-derive `today` whenever the view mounts; for long-running sessions, a lightweight interval (every minute) checking whether the local date has changed and invalidating the query is enough. Defer until someone hits the bug.
- **Should overdue tasks span all of recent history, or only those rolled forward to today?** They're the same set in practice (rollover always pulls overdue forward), but if rollover didn't run for some reason, the query `due_date < today` catches them regardless of `scheduled_date`. Recommend keeping it permissive.

**Manual test plan:**
- Create three tasks: one with due yesterday, one due today, one scheduled today with no due → each lands in the matching section.
- Tick the overdue one complete → it disappears from the view; remains in the calendar's today column with strike-through.
- Toggle to project view and back to Focus → state preserved (selection panel still works).
- With zero outstanding tasks → single "Inbox zero" empty state.
- Quick-add a task from the Focus view → appears at the bottom of the "Scheduled for today" section.

---

## Sizing summary

| # | Item | Size | Status |
|---|---|---|---|
| 1 | Bold overdue / due-today tasks | **S** | ✅ 0.0.12 |
| 2 | Quick-add from Project view | **S** | ✅ 0.0.12 |
| 3 | Recurring start / due dates | **M–L** | ✅ 0.0.12 |
| 4 | Drag-and-drop in calendar | **M** | ✅ 0.0.26 |
| 5 | Daily Discord digest | **M** | open |
| 6 | Read-only calendar overlay (ICS first, Google OAuth later) | **L** | Path A in progress |
| 7 | "Focus" view (overdue / due today / scheduled today) | **S** | ✅ 0.0.15 |

Tackle them roughly in that order — items 1 and 2 are quick wins that improve daily use; 3 and 4 are the next big UX leaps; 5 and 6 require server-side scaffolding (Edge Functions, cron) and should probably share that groundwork. Item 7 is another quick win and a natural follow-up to items 1 and 3.
