import type { Task } from "../types";

// Completed tasks stay on the Calendar and Focus screens for a week after they
// were ticked off, then drop out of the day / Soon columns even when the
// "show completed" toggle is on. They are never deleted — Projects, tags, and
// the task detail panel still surface them.
export const COMPLETED_VISIBLE_DAYS = 7;

const DAY_MS = 86_400_000;

/**
 * True when a completed task is still young enough to show on the rolling
 * views. Active tasks always pass. A completed row with a missing or
 * unparseable `completed_at` also passes — we'd rather show a stray row than
 * silently hide one.
 */
export function isCompletedRecently(
  task: Pick<Task, "completed" | "completed_at">,
  now: Date = new Date(),
): boolean {
  if (!task.completed) return true;
  if (!task.completed_at) return true;
  const ts = new Date(task.completed_at).getTime();
  if (Number.isNaN(ts)) return true;
  return now.getTime() - ts <= COMPLETED_VISIBLE_DAYS * DAY_MS;
}

/**
 * Applies both completed-task rules used by the Calendar and Focus screens:
 * with `showCompleted` off every completed task is dropped; with it on only
 * those completed within the last {@link COMPLETED_VISIBLE_DAYS} days survive.
 */
export function filterCompletedForDisplay(
  tasks: Task[],
  showCompleted: boolean,
  now: Date = new Date(),
): Task[] {
  if (!showCompleted) return tasks.filter((t) => !t.completed);
  return tasks.filter((t) => isCompletedRecently(t, now));
}
