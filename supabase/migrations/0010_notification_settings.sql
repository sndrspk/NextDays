-- NextDays — notification_settings table (daily Discord notification config).
-- Apply via Supabase SQL editor (paste & run).
--
-- Each user can enable a daily Discord DM summary of their Focus view
-- (overdue + due today + scheduled today) at a configurable local time.
-- The `send-daily-notification` Edge Function is called hourly by a
-- GitHub Actions cron; it checks notification_hour against the current
-- hour in the user's stored timezone before sending.

begin;

create table public.notification_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  discord_enabled boolean not null default false,
  discord_user_id text,
  -- Hour of day (0–23) in the user's timezone to send the notification.
  notification_hour smallint not null default 8
    check (notification_hour >= 0 and notification_hour <= 23),
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create index notification_settings_user_id_idx on public.notification_settings (user_id);

alter table public.notification_settings enable row level security;

create policy "notification_settings: select own"
  on public.notification_settings for select
  using (auth.uid() = user_id);
create policy "notification_settings: insert own"
  on public.notification_settings for insert
  with check (auth.uid() = user_id);
create policy "notification_settings: update own"
  on public.notification_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "notification_settings: delete own"
  on public.notification_settings for delete
  using (auth.uid() = user_id);

-- No anon access; service_role needed for the server-side cron function.
grant select, insert, update, delete on public.notification_settings to authenticated;
grant select, insert, update, delete on public.notification_settings to service_role;

commit;
