# NextDays — Project Plan & Documentation

> A rolling-day task manager inspired by Teuxdeux and Tweek, with project support, smart due date warnings, and custom lists.

---

## 1. Vision & Design Philosophy

RollingDay is a keyboard-first, distraction-free task manager for desktop browsers. Its central metaphor is a **rolling strip of days**: today and the next few days are always visible, tasks that weren't completed yesterday automatically appear at the top of today's column, and due dates surface urgency without demanding attention.

The aesthetic should be **refined and minimal** — clean typography, generous whitespace, subtle colour accents only where they carry meaning (e.g. due date colouring). Think Teuxdeux's calm confidence, not a dashboard.

---

## 2. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | React + TypeScript | Type safety, component model, ecosystem |
| Styling | Tailwind CSS | Utility-first, easy responsive design |
| State / data fetching | TanStack Query (React Query) | Clean server-state management |
| Backend / DB | Supabase | Postgres + auth + real-time, generous free tier |
| Hosting (frontend) | GitHub Pages | Free, works with Vite static output |
| Build tool | Vite | Fast dev server, straightforward GH Pages deploy |

---

## 3. Architecture Overview

```
src/
├── components/
│   ├── calendar/
│   │   ├── DayColumn.tsx         # Single day column
│   │   ├── CalendarStrip.tsx     # Horizontal scrolling strip of DayColumns
│   │   └── TaskCard.tsx          # Task item within a day column
│   ├── task/
│   │   ├── TaskDetail.tsx        # Slide-in/modal panel for editing a task
│   │   └── QuickAddInput.tsx     # Inline text input at bottom of column
│   ├── sidebar/
│   │   ├── Sidebar.tsx           # Left sidebar container
│   │   ├── ProjectList.tsx       # List of projects with task counts
│   │   └── CustomLists.tsx       # Non-calendar named lists
│   └── ui/                       # Generic UI primitives (Button, Badge, etc.)
├── hooks/
│   ├── useTasks.ts               # Fetch, create, update, delete tasks
│   ├── useProjects.ts
│   └── useCustomLists.ts
├── lib/
│   ├── supabase.ts               # Supabase client init
│   ├── rollover.ts               # Rollover logic (run on app load)
│   └── dateUtils.ts              # Date helpers
├── pages/
│   ├── App.tsx                   # Root: sidebar + calendar strip
│   └── ProjectView.tsx           # Full project task list
└── types/
    └── index.ts                  # Shared TypeScript types
```

---

## 4. Database Schema (Supabase / Postgres)

### `tasks`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `title` | text | |
| `notes` | text | nullable |
| `scheduled_date` | date | The date the task currently lives on in the calendar. Updated on rollover. |
| `start_date` | date | nullable. Task first appears in calendar on this date. |
| `due_date` | date | nullable |
| `completed` | boolean | default false |
| `completed_at` | timestamptz | nullable |
| `project_id` | uuid (FK → projects) | nullable |
| `tags` | text[] | array of tag strings |
| `sort_order` | integer | for manual ordering within a day |
| `created_at` | timestamptz | |

### `projects`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `name` | text | |
| `colour` | text | hex colour string |
| `is_personal` | boolean | true = personal (rolls over daily), false = work (skips weekends) |
| `created_at` | timestamptz | |

### `custom_lists`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `name` | text | e.g. "Books to read", "Shopping" |
| `sort_order` | integer | for sidebar ordering |
| `created_at` | timestamptz | |

### `custom_list_items`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `list_id` | uuid (FK → custom_lists) | |
| `title` | text | |
| `notes` | text | nullable |
| `completed` | boolean | default false |
| `sort_order` | integer | |
| `created_at` | timestamptz | |

> **Note:** Custom list items intentionally have no dates, projects, or tags — they are permanently separate from the calendar.

---

## 5. Core Features (v1 scope)

### 5.1 Rolling Day Calendar Strip

- Displays **today + the next N days** as vertical columns side by side, scrollable horizontally.
- **N is responsive:** show 4 days (today + 3) on smaller desktop screens, 7 days (today + 6) on wider screens. Breakpoint suggestion: < 1280px → 4 columns, ≥ 1280px → 7 columns.
- Each column header shows the weekday name and date (e.g. "Tuesday 13 May").
- Today's column is visually distinguished (slightly different background or stronger header).

### 5.2 Task Display Order Within a Day Column

Tasks within each day are sorted in this priority order:

1. **Due today or tomorrow** (not yet completed) — pinned to top, sorted by due date ascending
2. **Regular tasks** (no due date urgency) — sorted by `sort_order`
3. **Completed tasks** — always at the bottom, greyed out and struck through

### 5.3 Rollover Logic

- Runs **once on app load**, server-side via a Supabase function or client-side check.
- Any task where `completed = false` and `scheduled_date < today` has its `scheduled_date` updated to today.
- **Work project rollover exception:** if a task belongs to a work project (`is_personal = false`) and today is a Monday, tasks that were scheduled for the previous Saturday or Sunday roll to Monday. Tasks scheduled for Friday roll to the next Monday if the weekend passes unchecked.
- A task with a `start_date` in the future does **not** appear in the calendar until that date arrives. Once `start_date <= today`, it behaves normally (rolls over if unchecked).

### 5.4 Due Date Visual Indicators

| Situation | Indicator |
|---|---|
| Due in 2+ days | No indicator |
| Due tomorrow | 🔔 orange alarm emoji prefix in title |
| Due today | 🔔 orange alarm emoji + title text turns **orange** |
| Overdue (past due date, unchecked) | 🔔 red alarm emoji + title text turns **red** |

> Note: the alarm emoji and colour stay visible even after rollover — they are derived from `due_date` relative to today, not from `scheduled_date`.

### 5.5 Completing a Task

- Clicking the checkbox marks `completed = true` and sets `completed_at`.
- The task **moves to the bottom** of its day column immediately, rendered greyed out and struck through.
- It stays visible for the rest of the session (not hidden), so you can see what you've done.
- Completed tasks do **not** roll over.

### 5.6 Quick Task Entry

- Each day column has an input field at the bottom (or a "+ Add task" prompt that expands into one).
- Pressing Enter creates the task with `scheduled_date` set to that column's date.
- Default project: none. Default start/due dates: none.

### 5.7 Task Detail Panel

- Clicking anywhere on a task card (except the checkbox) opens a **slide-in panel or modal**.
- Editable fields:
  - Title
  - Notes (multi-line)
  - Project (dropdown)
  - Tags (free-form, comma-separated or tag chips)
  - Start date (date picker)
  - Due date (date picker)
- Changes save automatically on blur or via an explicit Save button.
- Panel can be closed with Escape or a close button.

### 5.8 Projects

- Listed in the left sidebar.
- Each project has a name and a colour.
- **Type toggle:** Personal (rolls over every day) or Work (skips weekends on rollover).
- Clicking a project opens a **Project View**: a flat list of all tasks in that project, regardless of date, filterable by status (active / completed).
- Tasks in the calendar strip show a small coloured dot or left border in the project colour.

### 5.9 Tags

- Free-form strings stored as an array on the task.
- No dedicated tag management UI in v1 — tags are entered in the Task Detail panel.
- A tag filter could be added in v2.

### 5.10 Custom Lists (non-calendar)

- Listed in the left sidebar below projects, under a "Lists" heading.
- Each list is a named, ordered list of items (title + optional notes).
- Items have a checkbox (completed state) but no dates, projects, or tags.
- Lists are managed inline in the sidebar or in a dedicated list view (clicking the list name expands it or navigates to it).
- New lists can be created from the sidebar.
- Custom list items **never appear in the calendar**.

### 5.11 Sidebar Layout

```
[ NextDays logo / app name ]

PROJECTS
  ● My Novel          (work, blue)
  ● Home Reno         (personal, green)
  + New project

LISTS
  ▸ Books to read
  ▸ Shopping
  + New list
```

---

## 6. Authentication

- Single-user for v1: use **Supabase Auth with magic link (email)** or simply a hardcoded user session.
- Row-level security (RLS) on all tables scoped to `auth.uid()` — future-proofed for multi-user even if not needed now.
- No sign-up flow needed; the owner logs in via Supabase magic link.

---

## 7. Hosting & Deployment

- **Frontend:** Built with Vite, deployed to **GitHub Pages** via a GitHub Actions workflow (`vite build` → deploy `dist/` to `gh-pages` branch).
- **Backend:** Supabase cloud (free tier). No self-hosted backend needed.
- **Environment variables:** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` stored as GitHub Actions secrets and injected at build time.

---

## 8. Build Order / Milestones

Build in this sequence to always have something working at each step:

### Milestone 1 — Skeleton & DB
- Vite + React + TypeScript + Tailwind scaffold
- Supabase project created, schema applied (tasks, projects, custom_lists, custom_list_items)
- Supabase client connected, basic read/write confirmed

### Milestone 2 — Calendar Strip (read-only)
- `CalendarStrip` renders N day columns based on viewport width
- Tasks fetched from Supabase and displayed in correct columns
- Due date indicators rendered correctly
- Task sort order within columns (due-soon pinned, completed at bottom)

### Milestone 3 — Task Interactions
- Quick-add input per column
- Checkbox to complete (task moves to bottom)
- Rollover logic runs on app load

### Milestone 4 — Task Detail Panel
- Click task → slide-in panel
- Edit title, notes, start date, due date, project, tags
- Auto-save on blur

### Milestone 5 — Projects
- Create/edit projects (name, colour, personal/work toggle)
- Project view (all tasks in project)
- Coloured indicator on task cards

### Milestone 6 — Custom Lists
- Create/rename lists
- Add/complete/delete list items
- Sidebar integration

### Milestone 7 — Polish & Deploy
- Responsive column count (4 vs 7)
- Keyboard shortcuts (at minimum: Enter to add, Escape to close panel)
- GitHub Actions deploy to GitHub Pages
- Final visual polish

---

## 9. Postponed Features (v2+)

These are explicitly out of scope for v1 but should be kept in mind architecturally so they don't require breaking changes later.

| Feature | Notes |
|---|---|
| **Calendar sync** | Sync with Google Calendar or Morgen via API. Would require OAuth flow and a mapping layer between calendar events and tasks. |
| **Reminders / notifications** | Browser push notifications or email reminders for due dates. |
| **Tag filter view** | Filter the calendar or a list by one or more tags. |
| **Recurring tasks** | Tasks that regenerate automatically on a schedule. |
| **Android app** | Native Kotlin app or React Native / Expo companion. Supabase backend already supports this. |
| **Multi-user / sharing** | Supabase RLS already scoped per user — just needs auth UI expansion. |
| **Drag to reschedule** | Drag a task card from one day column to another to change its `scheduled_date`. |
| **Subtasks** | Nested task items within a task. |
| **Keyboard command palette** | Cmd+K style quick task creation or navigation. |

---

## 10. Key Design Decisions to Preserve

- **`scheduled_date` is mutable** — it's the "live" date of a task in the calendar, updated by rollover. `start_date` is set by the user (on create or edit) and controls the earliest date a task can appear in the calendar. The rollover logic never modifies `start_date`.
- **Custom list items are a separate data model** — they share no fields with calendar tasks intentionally. Do not merge them.
- **Work/personal project distinction lives on the project, not the task** — a task inherits rollover behaviour from its project.
- **No week concept** — the calendar is a continuous rolling strip, not Mon–Sun blocks.
- **Completed tasks are never deleted automatically** — they remain queryable for history.
