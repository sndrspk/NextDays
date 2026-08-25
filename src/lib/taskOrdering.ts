import type { Project, Task } from "../types";

// Earliest due_date first; tasks with no due_date go last. This walks the
// urgency ladder in `lib/dates.ts` — overdue, due today, tomorrow, the day
// after, then the rest — so a task's badge and its position in its project
// group agree. `scripts/taskOrdering.test.ts` pins that correspondence.
function compareDueDate(a: Task, b: Task): number {
  if (a.due_date === b.due_date) return 0;
  if (!a.due_date) return 1;
  if (!b.due_date) return -1;
  return a.due_date < b.due_date ? -1 : 1;
}

// Active tasks are ordered by (a) earliest due_date first (undated last), then
// (b) latest scheduled_date first, then by sort_order as a tiebreaker.
export function compareActiveTasks(a: Task, b: Task): number {
  const byDue = compareDueDate(a, b);
  if (byDue !== 0) return byDue;
  if (a.scheduled_date !== b.scheduled_date) {
    if (!a.scheduled_date) return 1;
    if (!b.scheduled_date) return -1;
    return a.scheduled_date < b.scheduled_date ? 1 : -1;
  }
  return a.sort_order - b.sort_order;
}

// Sort key that brings tasks carrying the same tag next to each other. Tags
// are lowercased so "Travel" and "travel" cluster, and sorted so the key
// starts with the task's alphabetically-first tag — which makes a two-tag task
// sit with the run for that tag rather than starting a run of its own. The
// separator is a NUL so ["travel"] sorts immediately before
// ["travel", "urgent"] and nowhere near ["traveller"]. Untagged tasks get ""
// and are sent to the back of their bucket by `compareTagRun`.
function tagKey(task: Task): string {
  if (!task.tags || task.tags.length === 0) return "";
  return task.tags
    .map((t) => t.toLowerCase())
    .sort()
    .join("\u0000");
}

// Plain `<` / `>` rather than localeCompare: collation rules may ignore the
// NUL separator entirely, which would undo the prefix ordering above.
function compareTagRun(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? -1 : 1;
}

function compareCompletedTasks(a: Task, b: Task): number {
  return (a.completed_at ?? "").localeCompare(b.completed_at ?? "");
}

// Rank each project by its position in the list `useProjects` returns (name
// ascending), so groups appear in the same order as the sidebar.
function buildProjectRank(projects: Project[]): Map<string, number> {
  return new Map(projects.map((p, i) => [p.id, i]));
}

function projectRank(
  task: Task,
  rank: Map<string, number>,
  unknownRank: number,
): number {
  // Tasks with no project form the optional trailing group.
  if (!task.project_id) return Number.POSITIVE_INFINITY;
  // A project we don't know about (deleted, or not loaded yet) sits after the
  // known ones but still ahead of the no-project group.
  return rank.get(task.project_id) ?? unknownRank;
}

/**
 * Display order for a day column / focus section: active tasks grouped by
 * project (no-project group last), most urgent first inside each group, and
 * tasks sharing a tag run together inside each due-date bucket; completed
 * tasks sink to the bottom in completion order.
 *
 * Tag runs come *after* due date on purpose — the urgency ladder outranks
 * them, so clustering can never lift a task above a more urgent one. It only
 * decides the order of tasks that were already tied.
 */
export function orderTasksForDisplay(tasks: Task[], projects: Project[]): Task[] {
  const rank = buildProjectRank(projects);
  const unknownRank = projects.length;

  const active: Task[] = [];
  const completed: Task[] = [];
  for (const t of tasks) (t.completed ? completed : active).push(t);

  // Computed once per task rather than per comparison.
  const tags = new Map(active.map((t) => [t.id, tagKey(t)]));

  active.sort((a, b) => {
    const ra = projectRank(a, rank, unknownRank);
    const rb = projectRank(b, rank, unknownRank);
    if (ra !== rb) return ra < rb ? -1 : 1;
    // Same rank but different projects: only possible for unknown projects.
    // Keep them apart deterministically so each still reads as one group.
    if (a.project_id !== b.project_id) {
      return (a.project_id ?? "").localeCompare(b.project_id ?? "");
    }
    const byDue = compareDueDate(a, b);
    if (byDue !== 0) return byDue;
    const byTag = compareTagRun(tags.get(a.id) ?? "", tags.get(b.id) ?? "");
    if (byTag !== 0) return byTag;
    // Due dates are equal by now, so this settles scheduled_date / sort_order.
    return compareActiveTasks(a, b);
  });
  completed.sort(compareCompletedTasks);

  return [...active, ...completed];
}
