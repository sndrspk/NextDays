-- NextDays — revoke anon SELECT on private user-data tables.
-- Defense-in-depth: RLS already blocks anonymous reads, but the explicit
-- `grant select … to anon` in 0005 / 0006 means a future policy mistake
-- (a missing or mis-scoped policy) would immediately become anonymous
-- data exfiltration. Strip the grant so RLS isn't the only line.
--
-- Roles affected:
--   anon          — loses SELECT on every owned table here.
--   authenticated — keeps full CRUD (re-asserted below for idempotence).
--   service_role  — keeps full CRUD (re-asserted below for idempotence).
--
-- Schema-level USAGE on `public` is intentionally left in place; PostgREST
-- still needs it for introspection.

begin;

-- projects
revoke all on table public.projects from anon;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.projects to service_role;

-- tasks
revoke all on table public.tasks from anon;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.tasks to service_role;

-- custom_lists
revoke all on table public.custom_lists from anon;
grant select, insert, update, delete on public.custom_lists to authenticated;
grant select, insert, update, delete on public.custom_lists to service_role;

-- custom_list_items
revoke all on table public.custom_list_items from anon;
grant select, insert, update, delete on public.custom_list_items to authenticated;
grant select, insert, update, delete on public.custom_list_items to service_role;

-- ics_calendars
revoke all on table public.ics_calendars from anon;
grant select, insert, update, delete on public.ics_calendars to authenticated;
grant select, insert, update, delete on public.ics_calendars to service_role;

commit;

-- Verification (run manually in Supabase SQL editor after applying):
--   select grantee, table_name, privilege_type
--   from information_schema.role_table_grants
--   where table_schema = 'public'
--     and grantee = 'anon';
-- Expect zero rows for the five tables above.
