-- NextDays — auth + RLS (Milestone 7.5).
-- Source of truth: nextdays-project-plan.md §6.
-- Apply via Supabase SQL editor (paste & run).
--
-- This migration finishes what 0001_init.sql intentionally deferred:
-- attaches every row to a Supabase auth user and enables per-user RLS.
-- Per the M7.5 decision (recorded in CLAUDE.md / VERSIONS.md): existing
-- rows are wiped and the app starts fresh after the owner signs in.

begin;

-- ---------------------------------------------------------------------------
-- Wipe existing data. custom_list_items cascades from custom_lists.
-- ---------------------------------------------------------------------------
truncate table public.tasks,
              public.projects,
              public.custom_lists,
              public.custom_list_items
  restart identity;

-- ---------------------------------------------------------------------------
-- Add user_id to every owned table. default auth.uid() lets the client
-- insert without setting user_id explicitly; RLS still enforces ownership.
-- ---------------------------------------------------------------------------
alter table public.projects
  add column user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade;

alter table public.tasks
  add column user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade;

alter table public.custom_lists
  add column user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade;

alter table public.custom_list_items
  add column user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade;

create index if not exists projects_user_id_idx          on public.projects (user_id);
create index if not exists tasks_user_id_idx             on public.tasks (user_id);
create index if not exists custom_lists_user_id_idx      on public.custom_lists (user_id);
create index if not exists custom_list_items_user_id_idx on public.custom_list_items (user_id);

-- ---------------------------------------------------------------------------
-- Enable RLS and add per-user policies.
-- One policy per command keeps the intent explicit and easy to audit.
-- ---------------------------------------------------------------------------
alter table public.projects          enable row level security;
alter table public.tasks             enable row level security;
alter table public.custom_lists      enable row level security;
alter table public.custom_list_items enable row level security;

-- projects
create policy "projects: select own"
  on public.projects for select
  using (auth.uid() = user_id);
create policy "projects: insert own"
  on public.projects for insert
  with check (auth.uid() = user_id);
create policy "projects: update own"
  on public.projects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "projects: delete own"
  on public.projects for delete
  using (auth.uid() = user_id);

-- tasks
create policy "tasks: select own"
  on public.tasks for select
  using (auth.uid() = user_id);
create policy "tasks: insert own"
  on public.tasks for insert
  with check (auth.uid() = user_id);
create policy "tasks: update own"
  on public.tasks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "tasks: delete own"
  on public.tasks for delete
  using (auth.uid() = user_id);

-- custom_lists
create policy "custom_lists: select own"
  on public.custom_lists for select
  using (auth.uid() = user_id);
create policy "custom_lists: insert own"
  on public.custom_lists for insert
  with check (auth.uid() = user_id);
create policy "custom_lists: update own"
  on public.custom_lists for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "custom_lists: delete own"
  on public.custom_lists for delete
  using (auth.uid() = user_id);

-- custom_list_items
create policy "custom_list_items: select own"
  on public.custom_list_items for select
  using (auth.uid() = user_id);
create policy "custom_list_items: insert own"
  on public.custom_list_items for insert
  with check (auth.uid() = user_id);
create policy "custom_list_items: update own"
  on public.custom_list_items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "custom_list_items: delete own"
  on public.custom_list_items for delete
  using (auth.uid() = user_id);

commit;
