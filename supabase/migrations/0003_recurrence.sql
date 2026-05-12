-- NextDays — recurring tasks (Wishlist item 3).
-- Source of truth: WISHLIST.md item 3 (Approach A — template + instances).
-- Apply via Supabase SQL editor (paste & run).
--
-- Model:
--   * task_templates owns the recurrence rule (RRULE string per RFC 5545) plus
--     the immutable "shape" of each instance: title, notes, project, tags,
--     and the offsets that produce each instance's start_date / due_date
--     relative to its scheduled_date.
--   * tasks gets a nullable template_id. Materialised instances point back to
--     their template; standalone tasks leave it null. On template delete we
--     set null on existing instances so they survive as one-off tasks.

begin;

create table if not exists public.task_templates (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid()
                      references auth.users(id) on delete cascade,
  title             text not null,
  notes             text,
  project_id        uuid references public.projects(id) on delete set null,
  tags              text[] not null default '{}',
  rrule             text not null,           -- e.g. "FREQ=WEEKLY;BYDAY=MO"
  dtstart           date not null,           -- anchor for the rrule (first occurrence)
  start_offset_days integer,                 -- null = no start_date on instances
  due_offset_days   integer,                 -- null = no due_date on instances
  created_at        timestamptz not null default now()
);

create index if not exists task_templates_user_id_idx on public.task_templates (user_id);

alter table public.tasks
  add column if not exists template_id uuid
    references public.task_templates(id) on delete set null;

create index if not exists tasks_template_id_idx on public.tasks (template_id);

-- Enable RLS + scope to the owner. Same shape as the 0002_auth.sql policies.
alter table public.task_templates enable row level security;

create policy "task_templates: select own"
  on public.task_templates for select
  using (auth.uid() = user_id);
create policy "task_templates: insert own"
  on public.task_templates for insert
  with check (auth.uid() = user_id);
create policy "task_templates: update own"
  on public.task_templates for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "task_templates: delete own"
  on public.task_templates for delete
  using (auth.uid() = user_id);

commit;
