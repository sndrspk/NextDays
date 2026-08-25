import type { Project, Task } from "../types";

// Active tasks are ordered by (a) earliest due_date first (tasks with no
// due_date go last), then (b) latest scheduled_date first, then by sort_order
// as a tiebreaker. Sorting on due_date walks the urgency ladder in
// `lib/dueUrgency.ts` — overdue, due today, tomorrow, the day after, then the
// rest — so a task's badge and its position in its project group agree.
// `scripts/taskOrdering.test.ts` pins that correspondence.
export function compareActiveTasks(a: Task, b: Task): number {
  if (a.due_date !== b.due_date) {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date < b.due_date ? -1 : 1;
  }
  if (a.scheduled_date !== b.scheduled_date) {
    if (!a.scheduled_date) return 1;
    if (!b.scheduled_date) return -1;
    return a.scheduled_date < b.scheduled_date ? 1 : -1;
  }
  return a.sort_order - b.sort_order;
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
 * project (no-project group last), most urgent first inside each group;
 * completed tasks sink to the bottom in completion order.
 */
export function orderTasksForDisplay(tasks: Task[], projects: Project[]): Task[] {
  const rank = buildProjectRank(projects);
  const unknownRank = projects.length;

  const active: Task[] = [];
  const completed: Task[] = [];
  for (const t of tasks) (t.completed ? completed : active).push(t);

  active.sort((a, b) => {
    const ra = projectRank(a, rank, unknownRank);
    const rb = projectRank(b, rank, unknownRank);
    if (ra !== rb) return ra < rb ? -1 : 1;
    // Same rank but different projects: only possible for unknown projects.
    // Keep them apart deterministically so each still reads as one group.
    if (a.project_id !== b.project_id) {
      return (a.project_id ?? "").localeCompare(b.project_id ?? "");
    }
    return compareActiveTasks(a, b);
  });
  completed.sort(compareCompletedTasks);

  return [...active, ...completed];
}
