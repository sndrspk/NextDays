# Supabase

## Applying the schema

1. Open your Supabase project → **SQL editor** → **New query**.
2. Paste the contents of `migrations/0001_init.sql`.
3. Click **Run**.

That creates the four tables in plan §4 (`projects`, `tasks`, `custom_lists`, `custom_list_items`) and the indexes needed for the Milestone-2 queries.

## RLS

RLS is **off** for Milestone 1 (see plan §6 and CLAUDE.md). The anon key can read and write everything. Before any non-local deploy:

- enable RLS on every table
- add a `user_id uuid references auth.users(id)` column
- write per-table policies scoped to `auth.uid()`
