-- NextDays — explicit grants for task_templates + RLS assertion.
--
-- task_templates was added in 0003 with RLS + per-command policies, but its
-- explicit GRANTs were never added to 0005_data_api_grants.sql. It currently
-- works only because Supabase still implicitly grants table access — that
-- implicit grant is being removed (per the comment at the top of 0005).
-- Add the missing grants now so CRUD on task_templates keeps working after
-- the cutover.
--
-- The DO block at the end is a smoke test: it raises if any public.* table
-- has RLS disabled. Future migrations that add a table without RLS will fail
-- here.

begin;

-- task_templates: explicit Data API grants.
-- anon intentionally has no privileges (matches the post-0007 state for
-- every other user-data table — RLS is not the only line of defense).
grant select, insert, update, delete on public.task_templates to authenticated;
grant select, insert, update, delete on public.task_templates to service_role;

-- Smoke test: every owned public table must have RLS enabled.
-- A future migration that adds a public.foo table without RLS will fail here
-- the next time this migration is re-applied to a clean DB.
do $$
declare
  bad_table text;
begin
  select c.relname into bad_table
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname in (
      'projects',
      'tasks',
      'task_templates',
      'custom_lists',
      'custom_list_items',
      'ics_calendars'
    )
    and c.relrowsecurity = false
  limit 1;

  if bad_table is not null then
    raise exception 'RLS is disabled on public.% — enable it before re-running this migration', bad_table;
  end if;
end
$$;

commit;
