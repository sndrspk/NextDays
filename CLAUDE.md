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
- `tasks.start_date` is user-set; rollover never touches it. A task is hidden from the calendar until `start_date <= today`.
- `projects.is_personal` flips weekend-rollover behaviour for tasks in that project (see plan §5.3).
- `custom_lists` / `custom_list_items` are intentionally separate from tasks — do not merge or share types.

## How to run (will be true once Milestone 1 lands)

```
npm install
cp .env.example .env   # then fill in Supabase URL + anon key
npm run dev            # http://localhost:5173
```

The dev build includes a temporary "Smoke" panel that creates, lists, and deletes a task to prove the Supabase client works. Removed/hidden once Milestone 2 starts.

## Milestone status

- [x] M1 — Skeleton & DB (scaffold landed, schema applied to Supabase, smoke screen verified end-to-end)
- [x] M2 — Calendar Strip (read-only): responsive 4/7-day window, today highlight, sort per §5.2, due-date 🔔 indicators per §5.4, future-`start_date` gating
- [x] M3 — Task Interactions: per-column quick-add, checkbox toggle (`completed`/`completed_at`), client-side rollover on app load with work-project weekend exception
- [x] M4 — Task Detail Panel: click-to-open slide-in panel with auto-save-on-blur for title, notes, start/due dates, project (dropdown), and tags. Escape/backdrop/× to close.
- [x] M5 — Projects: sidebar list with create/edit/delete (`ProjectForm`), Personal/Work toggle that activates the rollover exception, `ProjectView` with active/completed/all filter, coloured project dot on task cards. Inter set as the interface font.
- [x] M6 — Custom Lists: sidebar "Lists" section with create/rename/delete (inline `ListNameForm`), `CustomListView` page with active/completed/all filter, inline item add, checkbox toggle, per-item notes (expand-on-demand), title editing on blur, and delete. View state extended with `{ kind: "list" }`.
- [x] M7 — Polish & Deploy: GitHub Pages deploy workflow (`.github/workflows/deploy.yml`) with Vite `base` set to `/NextDays/` under Actions. Visual overhaul to a macOS-app feel — Apple-gray canvas with soft radial accents, glass sidebar with `backdrop-blur`, floating calendar card with `shadow-elevated`, today column with gradient + accent stripe, circular accent-coloured checkboxes, segmented filter control, glass task-detail panel with larger title input, refined empty states, custom thin scrollbars, accent focus rings. Tailwind theme extended (`shadow-card`/`elevated`/`panel`, `accent`, `ease-out-soft`, `animate-fade-up`).
- [x] M7.5 — Auth + RLS (prerequisite for public deploy): Supabase magic-link sign-in (single owner), session gating, sign-out in sidebar footer. Migration `0002_auth.sql` wipes existing rows, adds `user_id uuid not null default auth.uid()` to all four tables, enables RLS, and adds per-command policies (select/insert/update/delete) scoped to `auth.uid() = user_id`.
