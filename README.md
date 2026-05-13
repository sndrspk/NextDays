# NextDays

A keyboard-first, rolling-day task manager inspired by Teuxdeux and Tweek. Tasks live on a horizontal strip of upcoming days; uncompleted tasks roll forward to today automatically.

Live app: <https://sndrspk.github.io/NextDays/> (single-owner, magic-link sign-in).

## Features

- **Rolling calendar strip** — responsive day window (3 days on phones, 4 on tablets / small laptops, and a user-chosen **3 or 5** on wide screens — default 5, toggled in the calendar header) with today highlighted; tasks sort by urgency and pin completed items to the bottom. Column headers show the date on top and a `Today` / `Tomorrow` / weekday label below.
- **Quick-add and inline interactions** — add a task on any day, tick it off with a click, or open the slide-in detail panel for title, notes, start/due dates, project, and tags (auto-save on blur).
- **Automatic rollover** — uncompleted tasks from past days move forward to today on app load, with a Personal/Work weekend exception.
- **Projects** — coloured projects with a Personal/Work flag; per-project view with text search, tag filters, and bulk select (complete / mark active / delete). Project colour tints the task circle.
- **Custom lists** — lightweight checklists kept separate from calendar tasks.
- **Focus view** — a single-page list of Overdue / Due today / Scheduled for today, with quick-add at the top.
- **Recurring tasks** — independent start and due-date rules (Daily / Weekly / Monthly / Custom) with an Ends option; instances materialise 60 days ahead and a `↻` glyph marks them.
- **Settings screen** — picks the interface font (Inter / Public Sans / Instrument Sans) and houses backup & restore. Reached from the gear icon in the sidebar footer; the font choice persists in `localStorage` and applies app-wide.
- **Backup & restore** — export the full dataset to a versioned JSON file; import in Merge or Replace mode. Portable across accounts (re-stamps `user_id` from the current session). Lives inside the Settings screen.
- **Auth + per-row security** — Supabase magic-link sign-in for a single owner; every table has RLS scoped to `auth.uid()`.
- **Mobile-aware UI** — off-canvas sidebar, bottom-sheet task panel, vertically stacked calendar on phones.

## Tech stack

- React 18 + TypeScript
- Vite (dev server and build)
- Tailwind CSS
- TanStack Query (server state)
- Supabase (Postgres + Auth) via `@supabase/supabase-js`
- `rrule` for recurrence rules
- GitHub Pages for hosting

## Local setup

Requirements: Node 20+ and npm.

```bash
npm install
cp .env.example .env      # then fill in your Supabase URL + anon key
npm run dev               # http://localhost:5173
```

Other scripts:

- `npm run build` — type-check (`tsc -b`) and build to `dist/`.
- `npm run preview` — serve the production build locally.
- `npm run typecheck` — type-check only.

## Supabase setup

1. Create a Supabase project (free tier is fine). Copy the project URL and the **anon** key into `.env` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The anon key is safe to ship to the browser; the service-role key must never be committed or used in client code.
2. Apply the migrations under `supabase/migrations/` in order via the Supabase SQL editor (paste & run) or the Supabase CLI. They create the schema, enable RLS, and add the recurrence tables.
3. Create the single owner account: Supabase dashboard → Authentication → Users → "Add user" → enter your email. The app uses magic-link sign-in with `shouldCreateUser: false`, so only pre-existing users can sign in.
4. Add your local and deployed origins to the Supabase **Redirect URLs** allowlist (e.g. `http://localhost:5173` and your GitHub Pages URL) so magic links land back on the app.

## GitHub Pages deployment

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages on every push to `main`. Two repository secrets are required:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

`vite.config.ts` sets `base` to `/NextDays/` when `GITHUB_ACTIONS` is set, and `/` locally. The workflow also copies `index.html` to `404.html` so the SPA handles client-side routes after a hard refresh.

## Deeper documentation

- [`CLAUDE.md`](CLAUDE.md) — working agreements, repo layout, schema notes, milestone status, and Supabase/auth specifics.
- [`nextdays-project-plan.md`](nextdays-project-plan.md) — the product spec and source of truth for behaviour.
- [`WISHLIST.md`](WISHLIST.md) — post-M7.5 feature backlog with sizes and full specs.
- [`VERSIONS.md`](VERSIONS.md) — running changelog, one line per change.
