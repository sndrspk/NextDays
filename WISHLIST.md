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

## 4. Drag-and-drop tasks between calendar days — **M**

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
- Settings UI: new "Settings" entry in the sidebar footer (next to sign-out) opening a small panel.
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

## 6. Read-only Google Calendar (and friends) overlay — **L**

**Goal:** Events from my Google Calendar (and ideally any ICS-compatible source) appear in the calendar strip alongside my tasks, read-only. I see them so I can plan around them; I can't tick them off or edit them.

**Two paths, both worth knowing:**

**Path A — ICS subscription (start here):**
- Almost every calendar service (Google, Apple iCloud, Outlook, Fastmail) lets you publish a calendar as a secret `.ics` URL.
- User pastes the URL into Settings; we store it on `app_settings.ics_urls text[]`.
- A Supabase Edge Function fetches each URL on a cron (every ~15 min), parses with `ical.js` or `node-ical`, and upserts into a new `external_events` table: `{ id, source_url, uid, title, start_at, end_at, all_day, fetched_at }`.
- Client subscribes via a new `useExternalEvents(dateRange)` hook and renders them as a distinct visual style in `DayColumn` (e.g. a slim coloured chip with a 🗓 icon, no checkbox, click does nothing or opens a read-only popover with location/notes).
- Pros: works for every calendar service in one stroke. No OAuth.
- Cons: 15-min lag, can't write back, depends on user generating the secret URL.

**Path B — Google Calendar OAuth:**
- Set up a Google Cloud project, enable Calendar API, OAuth consent screen, store refresh tokens server-side (Edge Function + service-role-only table `google_oauth_tokens`).
- Sync API token refresh + incremental sync (`syncToken`).
- Pros: real-time-ish, can extend later (e.g. block out a day from tasks).
- Cons: substantial scaffolding for very little extra benefit over (A) for a read-only use case.

**Recommendation:** ship Path A first. Only build Path B if (a) we want to render events as they're created without a 15-min delay, or (b) we eventually want write-back.

**Implementation notes (Path A):**
- Migration: `supabase/migrations/0005_external_events.sql` with the table above + RLS scoped to `user_id` + an index on `(user_id, start_at)`.
- Edge Function `sync-ics`: fetch URL, parse, expand recurring events for the next 60 days, upsert by `(source_url, uid, start_at)`, delete rows older than today.
- UI: events sit in `DayColumn` above the task list with a small left border in a calendar-specific colour. Clicking opens a tiny popover with title / time / location. They never move on rollover and never have checkboxes.
- Decide whether they count as "stuff for today" in the Discord digest (item 5). Probably yes, as a separate "Today's events" section.

**Manual test plan:**
- Add a Google Calendar secret ICS URL in settings → within 15 min, events appear in the right columns.
- Add a recurring event on Google's side → expanded instances show up.
- Remove the URL → events disappear on next sync.
- Add an Outlook ICS URL alongside Google → both render with distinguishable colours.

---

## Sizing summary

| # | Item | Size | Status |
|---|---|---|---|
| 1 | Bold overdue / due-today tasks | **S** | ✅ 0.0.12 |
| 2 | Quick-add from Project view | **S** | ✅ 0.0.12 |
| 3 | Recurring start / due dates | **M–L** | ✅ 0.0.12 |
| 4 | Drag-and-drop in calendar | **M** | open |
| 5 | Daily Discord digest | **M** | open |
| 6 | Read-only calendar overlay (ICS first, Google OAuth later) | **L** | open |

Tackle them roughly in that order — items 1 and 2 are quick wins that improve daily use; 3 and 4 are the next big UX leaps; 5 and 6 require server-side scaffolding (Edge Functions, cron) and should probably share that groundwork.
