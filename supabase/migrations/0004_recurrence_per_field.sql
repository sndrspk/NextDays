-- NextDays — per-field recurrence (revision of Wishlist item 3).
-- Source of truth: WISHLIST.md item 3 (revised).
-- Apply via Supabase SQL editor (paste & run).
--
-- 0003 modelled recurrence as a single rule on scheduled_date with
-- start_offset_days / due_offset_days. The revised model gives start_date
-- and due_date independent recurrence rules:
--   * start_rrule / start_dtstart  — optional rule driving the start_date.
--   * due_rrule   / due_dtstart    — optional rule driving the due_date.
-- At least one of the two must be set. When both are set, start drives
-- instance generation and the due_date for each instance is the next
-- occurrence of the due rule on or after that instance's start_date.
-- When only due is set, the due rule drives generation; scheduled_date and
-- due_date both equal that occurrence.
--
-- Because 0003 only just shipped, we wipe existing templates outright
-- rather than mapping the old offset-based shape into the new columns.

begin;

-- Detach existing instances; the FK is on-delete-set-null, but be explicit
-- so any rows that survived a manual create still keep going as one-offs.
update public.tasks set template_id = null where template_id is not null;
delete from public.task_templates;

alter table public.task_templates
  drop column rrule,
  drop column dtstart,
  drop column start_offset_days,
  drop column due_offset_days;

alter table public.task_templates
  add column start_rrule   text,
  add column start_dtstart date,
  add column due_rrule     text,
  add column due_dtstart   date;

alter table public.task_templates
  add constraint task_templates_at_least_one_rule
    check (
      (start_rrule is not null and start_dtstart is not null)
      or (due_rrule is not null and due_dtstart is not null)
    );

commit;
