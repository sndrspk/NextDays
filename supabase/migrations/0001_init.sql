-- NextDays — initial schema (Milestone 1).
-- Source of truth: nextdays-project-plan.md §4.
-- Apply via Supabase SQL editor (paste & run) or the Supabase CLI.
--
-- NOTE: RLS is intentionally DISABLED in this migration. Plan §6 calls for
-- magic-link auth + RLS, but those are deferred. Re-enable before any
-- non-local deploy.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  colour      text not null default '#64748b',
  is_personal boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  notes          text,
  scheduled_date date not null,
  start_date     date,
  due_date       date,
  completed      boolean not null default false,
  completed_at   timestamptz,
  project_id     uuid references public.projects(id) on delete set null,
  tags           text[] not null default '{}',
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists tasks_scheduled_date_idx on public.tasks (scheduled_date);
create index if not exists tasks_project_id_idx     on public.tasks (project_id);
create index if not exists tasks_completed_idx      on public.tasks (completed);

-- ---------------------------------------------------------------------------
-- custom_lists
-- ---------------------------------------------------------------------------
create table if not exists public.custom_lists (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- custom_list_items
-- ---------------------------------------------------------------------------
create table if not exists public.custom_list_items (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references public.custom_lists(id) on delete cascade,
  title      text not null,
  notes      text,
  completed  boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists custom_list_items_list_id_idx on public.custom_list_items (list_id);
