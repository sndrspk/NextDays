-- NextDays — ics_calendars table (account-scoped calendar subscriptions).
-- Apply via Supabase SQL editor (paste & run).
--
-- Up until this point the subscribed .ics URLs lived in localStorage, which
-- meant adding a calendar on one device didn't propagate to another. Moving
-- them into a per-user Postgres table makes the list follow the account.
-- The per-calendar parsed-events cache stays in localStorage — it's just
-- network output and can be re-derived from the URL on first paint.

begin;

create table public.ics_calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  url text not null,
  name text not null,
  colour text not null,
  created_at timestamptz not null default now()
);

create index ics_calendars_user_id_idx on public.ics_calendars (user_id);

alter table public.ics_calendars enable row level security;

create policy "ics_calendars: select own"
  on public.ics_calendars for select
  using (auth.uid() = user_id);
create policy "ics_calendars: insert own"
  on public.ics_calendars for insert
  with check (auth.uid() = user_id);
create policy "ics_calendars: update own"
  on public.ics_calendars for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "ics_calendars: delete own"
  on public.ics_calendars for delete
  using (auth.uid() = user_id);

grant select on public.ics_calendars to anon;
grant select, insert, update, delete on public.ics_calendars to authenticated;
grant select, insert, update, delete on public.ics_calendars to service_role;

commit;
