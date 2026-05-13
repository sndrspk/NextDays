-- NextDays — explicit Data API grants (required Oct 30, 2026).
-- Source: Supabase email about PostgREST default changes.
-- https://supabase.com/docs/guides/database/data-api
--
-- Supabase is removing implicit table access via the Data API.
-- Explicit GRANTs are now required for each role.
-- RLS policies still enforce row-level access control.

-- projects table
grant select on public.projects to anon;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.projects to service_role;

-- tasks table
grant select on public.tasks to anon;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.tasks to service_role;

-- custom_lists table
grant select on public.custom_lists to anon;
grant select, insert, update, delete on public.custom_lists to authenticated;
grant select, insert, update, delete on public.custom_lists to service_role;

-- custom_list_items table
grant select on public.custom_list_items to anon;
grant select, insert, update, delete on public.custom_list_items to authenticated;
grant select, insert, update, delete on public.custom_list_items to service_role;
