-- Soon tasks: tasks with no scheduled date, shown in a dedicated "Soon" column.
-- When soon = true, scheduled_date / start_date / due_date are all NULL.

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS soon boolean NOT NULL DEFAULT false;

-- Allow scheduled_date to be NULL for soon tasks.
ALTER TABLE public.tasks ALTER COLUMN scheduled_date DROP NOT NULL;

-- Index for efficient soon-task queries.
CREATE INDEX IF NOT EXISTS tasks_soon_idx ON public.tasks (soon) WHERE soon = true;
