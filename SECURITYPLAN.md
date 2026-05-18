# SECURITYPLAN.md — NextDays

Plan of record for working through the security audit. Each finding has a concrete
file-level plan, the order it should be done in, and what "done" looks like.
Tick items off as they ship; update `VERSIONS.md` with a one-liner per landed step.

The audit prioritised findings into High / Medium / Low. The execution order
below is the **quick-win order** from the audit (cheap & high-leverage first),
followed by the remaining Medium / Low items.

---

## Execution order

1. Revoke anon grants on private tables (High)
2. CSP + referrer + clickjacking meta tags (Medium)
3. Harden `fetch-ics` Edge Function against SSRF (High)
4. Dependabot + `npm audit` in CI (Low)
5. FK ownership checks in RLS (Medium)
6. Fix `task_templates` grants / RLS migration ordering (High)
7. Account-deletion safety: export-before-cascade (Medium)
8. ICS parsing DoS hardening (Medium)
9. Console-leak gating (Low)
10. Magic-link redirect lock-down (Low)
11. Verify Vite / plugin major versions (Low)

Each block below describes scope, files to touch, and acceptance criteria.

---

## 1. Revoke anon grants on private tables — HIGH

**Why:** `0005_data_api_grants.sql` and `0006_ics_calendars.sql` `GRANT SELECT … TO anon`.
RLS blocks anon reads today, but the grant kills defense-in-depth: any future
policy mistake immediately becomes data exfiltration. Anon must only see what
PostgREST itself needs (introspection); it must not see app tables.

**Plan**
- New migration `supabase/migrations/0007_revoke_anon_grants.sql`.
- For each of `projects`, `tasks`, `task_templates`, `custom_lists`,
  `custom_list_items`, `ics_calendars`:
  - `REVOKE ALL ON TABLE public.<t> FROM anon;`
  - Re-assert `GRANT SELECT, INSERT, UPDATE, DELETE ON public.<t> TO authenticated, service_role;`
- Do **not** revoke `usage` on the schema from anon — PostgREST still needs schema
  visibility for error messages. Only table-level rights are revoked.
- Verify with: `select grantee, privilege_type from information_schema.role_table_grants where table_schema='public';`
  — expect zero rows for `anon`.

**Done when**
- Migration applies cleanly on a fresh DB and on a DB that already has 0001–0006.
- `curl` with the anon key against `/rest/v1/tasks` returns 401/empty (not "denied
  by policy"; the table simply has no read right).
- App sign-in flow still works end-to-end (auth role retains full CRUD).

---

## 2. CSP, frame-ancestors, referrer-policy — MEDIUM

**Why:** No clickjacking or XSS-mitigation headers ship today. GitHub Pages
doesn't let us set HTTP response headers, so we have to use `<meta http-equiv>`
in `index.html` for what's supported there (CSP, referrer), and accept that
`frame-ancestors` only works as a real header — for that we either (a) accept
the gap on Pages or (b) move hosting behind a header-capable host later. Use
`Cloudflare Pages` / `Netlify _headers` if/when we migrate; until then the
meta-tag CSP is the floor.

**Plan**
- Edit `index.html` `<head>`:
  - `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none';">`
  - `<meta name="referrer" content="strict-origin-when-cross-origin">`
- Audit Tailwind / `fontsource-variable` to confirm no remote font/CSS fetches sneak in.
  All fonts are self-hosted via `@fontsource-variable/*`, so `font-src 'self'` is enough.
- `connect-src` must include the Supabase project URL host AND its `wss://` for
  realtime/auth. If we don't currently use Supabase realtime, keep `wss://*.supabase.co`
  anyway — it's cheap and futureproof.
- Smoke-test: open the app, hit every view, check DevTools console for CSP
  violations. Fix `unsafe-inline` only if literally impossible to remove (Tailwind's
  injected styles need `style-src 'unsafe-inline'`; documented above).

**Done when**
- `Report-Only` mode tested first (`Content-Security-Policy-Report-Only` for one PR),
  confirms no violations, then we flip to enforcing.
- All app surfaces (calendar, focus, settings, sign-in, task panel) load with zero
  CSP-violation console errors.

---

## 3. Harden `fetch-ics` against SSRF — HIGH

**Why:** `supabase/functions/fetch-ics/index.ts` currently takes an arbitrary URL
from a signed-in user and fetches it server-side from inside Supabase's network.
JWT-gating limits the blast radius to "logged-in owners," but the function is
still a confused-deputy that can reach metadata endpoints, internal services,
or unbounded body sizes.

**Plan**
- Refactor `index.ts` into a small helper module + handler.
- Input validation:
  - Parse with `new URL(input)`; reject if `protocol !== 'http:' && !== 'https:'`.
  - Reject if port is set and not 80/443.
- DNS pre-resolution:
  - Use `Deno.resolveDns(hostname, "A")` and `"AAAA"`.
  - For each returned address, reject if it falls in: `10.0.0.0/8`, `172.16.0.0/12`,
    `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16` (link-local, includes
    `169.254.169.254` cloud-metadata), `::1`, `fc00::/7`, `fe80::/10`,
    `::ffff:0:0/96` (IPv4-mapped — re-check the v4 address).
- Manual redirect handling:
  - Call `fetch(url, { redirect: "manual" })`.
  - On 3xx, read `Location`, resolve relative URLs, run the same allow-list checks,
    cap at 5 hops total.
- Timeout & size:
  - `AbortController` with 10s timeout wrapping the fetch.
  - Stream the body, accumulate bytes, abort if > 5 MiB (configurable const).
- Content-type allow-list:
  - Accept `text/calendar`, `text/plain`, `application/octet-stream` only
    (some hosts mislabel `.ics` as the last two; sniff first bytes for `BEGIN:VCALENDAR`).
- Response shape unchanged: `{ text }` on success, `{ error }` with a clean
  message and a 4xx/5xx status on failure. No raw upstream body/headers leaked.

**Done when**
- Unit-testable: extract `assertSafeUrl(url)` and `safeFetch(url)` as pure helpers,
  add a small Deno test that the metadata IPs / private ranges / wrong ports / >5 MiB
  bodies all reject.
- Manually verified against a known-good public calendar (Google `webcal://` over https).

---

## 4. Dependabot + npm audit in CI — LOW

**Why:** Today nothing flags vulnerable transitive deps. This is free hygiene.

**Plan**
- Add `.github/dependabot.yml`:
  - `package-ecosystem: npm`, weekly, target `main`, group minor+patch.
  - `package-ecosystem: github-actions`, monthly.
- Edit `.github/workflows/deploy.yml` (or a new `audit.yml` running on pull_request):
  - `- run: npm audit --audit-level=high` — non-blocking initially via
    `continue-on-error: true`, then flip to blocking once the baseline is clean.
- Document expected triage cadence in this file once landed.

**Done when**
- Dependabot opens its first PR.
- `npm audit --audit-level=high` exits clean (or known-good with a documented waiver).

---

## 5. FK ownership checks in RLS — MEDIUM

**Why:** Today RLS asserts `auth.uid() = user_id` on the row being written, but a
signed-in user can supply someone *else's* `project_id` / `list_id` /
`template_id` in an INSERT/UPDATE — the FK target isn't checked for ownership.
This is a horizontal-privilege gap if a second account ever exists.

**Plan**
- New migration `supabase/migrations/0008_fk_ownership.sql`.
- Tighten policies — examples:
  ```sql
  drop policy if exists tasks_insert on public.tasks;
  create policy tasks_insert on public.tasks
    for insert with check (
      auth.uid() = user_id
      and (project_id is null or exists (
        select 1 from public.projects p
        where p.id = project_id and p.user_id = auth.uid()
      ))
      and (template_id is null or exists (
        select 1 from public.task_templates t
        where t.id = template_id and t.user_id = auth.uid()
      ))
    );
  ```
- Repeat for `tasks` UPDATE (use `USING` + `WITH CHECK`).
- Repeat for `custom_list_items` (check `list_id`).
- Repeat for `task_templates` (no FK to owned tables today; revisit if added).
- Confirm policies compose with the existing `auth.uid() = user_id` predicate.

**Done when**
- Migration applies cleanly.
- Manual test: attempt to insert a `tasks` row referencing another user's
  `project_id` via direct PostgREST call → 403 / new-row-violates-RLS.

---

## 6. `task_templates` grants & RLS ordering — HIGH

**Why:** Audit calls out that `task_templates` policies live in a later migration
than the base auth migration, and the Data API grant migration may be missing
`authenticated`/`service_role` grants for it. Order risk + missing grants = future
breakage.

**Plan**
- Read `0002_auth.sql`, `0003_recurrence.sql`, `0004_recurrence_per_field.sql`,
  `0005_data_api_grants.sql` end-to-end and tabulate, for `task_templates`:
  - Is RLS enabled?
  - Are per-command policies defined (select/insert/update/delete)?
  - Are grants present for `authenticated` and `service_role`?
- New migration `supabase/migrations/0009_task_templates_grants.sql` that is
  idempotent and authoritative:
  - `alter table public.task_templates enable row level security;`
  - `grant select, insert, update, delete on public.task_templates to authenticated, service_role;`
  - Recreate any missing per-command policies (drop-if-exists then create).
- Add a `do $$ … $$` block at the end that asserts RLS is enabled on every
  `public.*` table in the project, raising if not. This becomes our smoke test
  for future migrations.

**Done when**
- Fresh DB built from 0001 → 0009 ends in a known-good state.
- Existing DB (with 0001–0006 already applied) accepts 0007–0009 without error.
- The assert block at the end is green.

---

## 7. Account-deletion safety — MEDIUM ✅

**Why:** All tables `ON DELETE CASCADE` from `auth.users`. A wrong click in
Supabase dashboard / a future "Delete account" button / a Supabase support op
nukes everything irrecoverably.

**Plan (lowest-cost option first)**
- Phase A — user-visible safety:
  - Surface a "Download backup" CTA in Settings before sign-out / account-delete
    flows; the backup feature already exists (`exportAll` in `src/lib/backup.ts`).
  - If/when we add an in-app "Delete account" button, force an export first and
    require typed confirmation of the account email.
- Phase B — server-side safety net (optional, deferred):
  - Add a scheduled Supabase Edge Function (`backup-nightly`) that writes JSON
    snapshots into a private Supabase Storage bucket, retained N days, with a
    bucket policy that only `service_role` can read.
  - Document restore procedure in this file.
- Phase C — soft delete:
  - Change cascades to `ON DELETE RESTRICT` and add an `archived_at` column, so
    "delete" becomes "archive." Pricey; only do if usage justifies.

**Done when (Phase A)**
- Confirmation gate exists wherever destructive auth flows live.
- README documents that the JSON backup is the user's responsibility.

---

## 8. ICS parsing DoS hardening — MEDIUM ✅

**Why:** `src/lib/ics.ts` caps recurrence expansion per event but has no global
cap, and parses on the main thread — a hostile (or just unusually large)
calendar blocks the UI.

**Plan**
- Add a global per-feed cap in `src/lib/ics.ts`: max N total expanded
  instances across all events (e.g. 5000). Bail with a friendly per-feed error
  surfaced in Settings.
- Move parsing into a Web Worker:
  - New `src/workers/ics.worker.ts` that imports `ical.js`, exposes a
    `parse(text) -> events[]` message API.
  - `useExternalEvents` posts the fetched text into the worker via
    `Comlink`-style wrapper or hand-rolled `postMessage`.
- Worker-side `setTimeout`-driven parse timeout (e.g. 5s) → reject with error.
- Combine with server-side body-size cap from #3 so we never hand a 100 MB
  blob to the worker.

**Done when**
- A 1 MB synthetic ICS with 10k RRULEs doesn't freeze the calendar view.
- Parse timeout surfaces as a per-row error in Settings.

---

## 9. Console-leak gating — LOW

**Why:** Hooks log raw Supabase error objects, which can include row IDs and
internal messages.

**Plan**
- Audit `src/hooks/**` for `console.error(error)` patterns.
- Wrap each in `if (import.meta.env.DEV) { console.error(...) }`.
- Keep user-facing toast / inline error untouched.

**Done when**
- Production build has no `console.*` output from happy or error paths.

---

## 10. Magic-link redirect lock-down — LOW

**Why:** `emailRedirectTo` currently uses `window.location.origin` + path, which
means anywhere the app is hosted (or a misconfigured Supabase redirect allow-list)
could become a redirect target.

**Plan**
- Add `VITE_APP_URL` to `.env.example` and to the build environment.
- Change `signInWithOtp(...)` callsite to use `${import.meta.env.VITE_APP_URL}/`
  as `emailRedirectTo`.
- In Supabase dashboard → Auth → URL Configuration, tighten the redirect allow-list
  to exactly `http://localhost:5173` + production URL (this is already partly
  configured per CLAUDE.md; verify it).

**Done when**
- A magic link issued from `https://sndrspk.github.io/NextDays/` never resolves
  back to anything else, regardless of what `window.location` says.

---

## 11. Verify Vite / plugin major versions — LOW

**Why:** Audit flagged `vite` and `@vitejs/plugin-react` majors as unusually high.

**Plan**
- `npm view vite version` and `npm view @vitejs/plugin-react version` to confirm
  the current stable line.
- If the lockfile pins a pre-release / RC, pin to the last stable major.
- After Dependabot (#4) is live, this becomes self-maintaining.

**Done when**
- `package.json` versions match a published stable release.
- `npm ci` from a clean clone succeeds and `npm run build` produces the same
  output as today.

---

## Process notes

- Each numbered block above should ship as its own PR off the milestone
  branch — small, reviewable, individually revertable.
- Migrations are append-only: never edit a migration that has been applied to
  the cloud Supabase project. Add a new one.
- After each PR merges to main, add a one-liner to `VERSIONS.md`
  ("Security: revoked anon grants on private tables") and tick the box at the
  top of this file.
- Re-read this plan before starting a new block — earlier blocks may have
  changed the file layout the later block assumed.
