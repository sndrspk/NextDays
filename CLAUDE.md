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

- **Branch:** all work goes on `claude/setup-vite-react-supabase-vNMSj`. Do not push to `main`.
- **Spec discipline:** if a task seems to conflict with `nextdays-project-plan.md`, ask before deviating. Section §10 ("Key Design Decisions to Preserve") is especially important.
- **Bookkeeping:** after each meaningful edit, update `CLAUDE.md` (this file) and add a one-line entry to `VERSIONS.md`.
- **Secrets:** never commit `.env`. Only `.env.example` goes in git. The Supabase **anon** key is fine to ship to the browser; the **service-role** key must never end up in client code or the repo.

## Supabase

- Project is hosted on Supabase cloud (free tier). The user owns the project; Claude does not provision it.
- Client lives in `src/lib/supabase.ts` and is constructed from `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
- Schema is checked into `supabase/migrations/` so anyone can re-apply it. Run it via the Supabase SQL editor (paste & run) or the Supabase CLI if/when added.
- **Milestone 1 decision (recorded):** RLS is OFF for now, no auth. Tables are world-readable/writable through the anon key. Auth + RLS are deferred — see plan §6. Re-enable RLS before any non-local deploy.

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

- [x] M1 — Skeleton & DB (scaffold landed; awaiting live read/write verification once user supplies Supabase creds)
- [ ] M2 — Calendar Strip (read-only)
- [ ] M3 — Task Interactions
- [ ] M4 — Task Detail Panel
- [ ] M5 — Projects
- [ ] M6 — Custom Lists
- [ ] M7 — Polish & Deploy
