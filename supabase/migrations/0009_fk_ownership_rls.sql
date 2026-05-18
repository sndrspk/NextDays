-- NextDays — tighten RLS so foreign-key targets must also be owned by the
-- caller, not just the row being written.
--
-- Today's INSERT/UPDATE policies only check `auth.uid() = user_id` on the
-- new row. They do not stop a signed-in user from supplying someone else's
-- project_id / list_id / template_id in the payload. In a single-owner
-- deployment this is harmless, but the moment a second user exists it
-- becomes a horizontal-privilege gap. Fix it pre-emptively so the policies
-- match intent.
--
-- The subselects below also pass through the target table's own RLS, so
-- they already filter to rows the caller can see. Re-asserting
-- `user_id = auth.uid()` inside the subselect makes the intent explicit
-- and survives any future RLS misconfiguration on the parent table.

begin;

-- ---------------------------------------------------------------------------
-- tasks: project_id (-> projects) and template_id (-> task_templates) must
-- both belong to the caller when present.
-- ---------------------------------------------------------------------------
drop policy if exists "tasks: insert own" on public.tasks;
create policy "tasks: insert own"
  on public.tasks for insert
  with check (
    auth.uid() = user_id
    and (
      project_id is null
      or exists (
        select 1 from public.projects p
        where p.id = project_id and p.user_id = auth.uid()
      )
    )
    and (
      template_id is null
      or exists (
        select 1 from public.task_templates t
        where t.id = template_id and t.user_id = auth.uid()
      )
    )
  );

drop policy if exists "tasks: update own" on public.tasks;
create policy "tasks: update own"
  on public.tasks for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      project_id is null
      or exists (
        select 1 from public.projects p
        where p.id = project_id and p.user_id = auth.uid()
      )
    )
    and (
      template_id is null
      or exists (
        select 1 from public.task_templates t
        where t.id = template_id and t.user_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- custom_list_items: list_id (-> custom_lists) is NOT NULL, so the check is
-- unconditional.
-- ---------------------------------------------------------------------------
drop policy if exists "custom_list_items: insert own" on public.custom_list_items;
create policy "custom_list_items: insert own"
  on public.custom_list_items for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.custom_lists l
      where l.id = list_id and l.user_id = auth.uid()
    )
  );

drop policy if exists "custom_list_items: update own" on public.custom_list_items;
create policy "custom_list_items: update own"
  on public.custom_list_items for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.custom_lists l
      where l.id = list_id and l.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- task_templates: project_id (-> projects) is nullable.
-- ---------------------------------------------------------------------------
drop policy if exists "task_templates: insert own" on public.task_templates;
create policy "task_templates: insert own"
  on public.task_templates for insert
  with check (
    auth.uid() = user_id
    and (
      project_id is null
      or exists (
        select 1 from public.projects p
        where p.id = project_id and p.user_id = auth.uid()
      )
    )
  );

drop policy if exists "task_templates: update own" on public.task_templates;
create policy "task_templates: update own"
  on public.task_templates for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      project_id is null
      or exists (
        select 1 from public.projects p
        where p.id = project_id and p.user_id = auth.uid()
      )
    )
  );

commit;
