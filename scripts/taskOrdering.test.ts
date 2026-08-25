import { compareActiveTasks, orderTasksForDisplay } from "../src/lib/taskOrdering.ts";
import type { Project, Task } from "../src/types/index.ts";

let pass = 0;
let fail = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass += 1;
  } else {
    fail += 1;
    console.log(
      `FAIL ${name}\n  expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}`,
    );
  }
}

function project(id: string, name: string): Project {
  return { id, name, colour: "#000000", is_personal: false, created_at: "2026-01-01T00:00:00Z" };
}

let seq = 0;
function task(t: Partial<Task> & { id: string }): Task {
  seq += 1;
  return {
    title: t.id,
    notes: null,
    scheduled_date: "2026-08-25",
    start_date: null,
    due_date: null,
    completed: false,
    completed_at: null,
    project_id: null,
    tags: [],
    sort_order: seq,
    created_at: "2026-01-01T00:00:00Z",
    template_id: null,
    soon: false,
    ...t,
  };
}

function ids(tasks: Task[]): string[] {
  return tasks.map((t) => t.id);
}

// `useProjects` returns projects name-ascending; groups follow that order.
const projects = [project("p-admin", "Admin"), project("p-build", "Build")];

// --- grouping ---

check(
  "groups by project, no-project group last",
  ids(
    orderTasksForDisplay(
      [
        task({ id: "loose-1" }),
        task({ id: "build-1", project_id: "p-build" }),
        task({ id: "admin-1", project_id: "p-admin" }),
        task({ id: "build-2", project_id: "p-build" }),
        task({ id: "loose-2" }),
        task({ id: "admin-2", project_id: "p-admin" }),
      ],
      projects,
    ),
  ),
  ["admin-1", "admin-2", "build-1", "build-2", "loose-1", "loose-2"],
);

check(
  "no no-project group when every task has one",
  ids(
    orderTasksForDisplay(
      [task({ id: "build-1", project_id: "p-build" }), task({ id: "admin-1", project_id: "p-admin" })],
      projects,
    ),
  ),
  ["admin-1", "build-1"],
);

check(
  "unknown project sits after known ones but before the no-project group",
  ids(
    orderTasksForDisplay(
      [
        task({ id: "loose", project_id: null }),
        task({ id: "ghost", project_id: "p-deleted" }),
        task({ id: "admin", project_id: "p-admin" }),
      ],
      projects,
    ),
  ),
  ["admin", "ghost", "loose"],
);

check(
  "projects still unloaded: one group, no crash",
  ids(
    orderTasksForDisplay(
      [task({ id: "loose" }), task({ id: "build", project_id: "p-build" })],
      [],
    ),
  ),
  ["build", "loose"],
);

// --- urgency inside a group ---

check(
  "overdue and due-soon float to the top of their group",
  ids(
    orderTasksForDisplay(
      [
        task({ id: "admin-undated", project_id: "p-admin" }),
        task({ id: "build-overdue", project_id: "p-build", due_date: "2026-08-20" }),
        task({ id: "admin-due-later", project_id: "p-admin", due_date: "2026-09-01" }),
        task({ id: "build-undated", project_id: "p-build" }),
        task({ id: "admin-overdue", project_id: "p-admin", due_date: "2026-08-24" }),
      ],
      projects,
    ),
  ),
  ["admin-overdue", "admin-due-later", "admin-undated", "build-overdue", "build-undated"],
);

check(
  "an overdue task does not jump ahead of an earlier project group",
  ids(
    orderTasksForDisplay(
      [
        task({ id: "build-overdue", project_id: "p-build", due_date: "2026-08-01" }),
        task({ id: "admin-undated", project_id: "p-admin" }),
      ],
      projects,
    ),
  ),
  ["admin-undated", "build-overdue"],
);

check(
  "dateless (Soon) tasks fall back to sort_order inside a group",
  ids(
    orderTasksForDisplay(
      [
        task({ id: "b", project_id: "p-admin", scheduled_date: null, soon: true, sort_order: 2 }),
        task({ id: "a", project_id: "p-admin", scheduled_date: null, soon: true, sort_order: 1 }),
      ],
      projects,
    ),
  ),
  ["a", "b"],
);

// --- completed tasks ---

check(
  "completed tasks sink below every group, oldest completion first",
  ids(
    orderTasksForDisplay(
      [
        task({
          id: "admin-done",
          project_id: "p-admin",
          completed: true,
          completed_at: "2026-08-25T12:00:00Z",
        }),
        task({ id: "loose-active" }),
        task({
          id: "build-done",
          project_id: "p-build",
          completed: true,
          completed_at: "2026-08-25T09:00:00Z",
        }),
        task({ id: "admin-active", project_id: "p-admin" }),
      ],
      projects,
    ),
  ),
  ["admin-active", "loose-active", "build-done", "admin-done"],
);

// --- the bare comparator (still used by the search view) ---

check(
  "compareActiveTasks: earliest due first, undated last",
  ids(
    [
      task({ id: "undated" }),
      task({ id: "late", due_date: "2026-09-01" }),
      task({ id: "early", due_date: "2026-08-20" }),
    ].sort(compareActiveTasks),
  ),
  ["early", "late", "undated"],
);

check(
  "compareActiveTasks: same due date, later scheduled_date first",
  ids(
    [
      task({ id: "earlier-column", due_date: "2026-09-01", scheduled_date: "2026-08-25" }),
      task({ id: "later-column", due_date: "2026-09-01", scheduled_date: "2026-08-27" }),
    ].sort(compareActiveTasks),
  ),
  ["later-column", "earlier-column"],
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
