import { useMemo } from "react";
import { useTaggedTasks } from "../../hooks/useTaggedTasks";
import { useView } from "../../state/view";
import { todayLocal, toISODate } from "../../lib/dates";
import type { Task } from "../../types";
import TaskCard from "../calendar/TaskCard";

function compareActiveTasks(a: Task, b: Task): number {
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

function sortTasks(tasks: Task[]): Task[] {
  const active: Task[] = [];
  const completed: Task[] = [];
  for (const t of tasks) (t.completed ? completed : active).push(t);
  active.sort(compareActiveTasks);
  completed.sort(
    (a, b) => (a.completed_at ?? "").localeCompare(b.completed_at ?? ""),
  );
  return [...active, ...completed];
}

export default function TagView({ tag }: { tag: string }) {
  const query = useTaggedTasks(tag);
  const tasks = query.data ?? [];
  const { setView } = useView();
  const today = toISODate(todayLocal());

  const sorted = useMemo(() => sortTasks(tasks), [tasks]);
  const activeCount = useMemo(() => tasks.filter((t) => !t.completed).length, [tasks]);

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col px-4 py-5 sm:px-8 sm:py-8 lg:px-10">
      <header className="mb-5 flex items-start justify-between gap-3 sm:mb-6">
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight text-stone-900 sm:text-[26px]">
            #{tag}
          </h2>
          <p className="text-[12px] text-stone-500">
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
            {activeCount > 0 && `, ${activeCount} active`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setView({ kind: "calendar" })}
          className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 text-[12px] font-medium text-stone-600 transition-colors hover:bg-slate-50"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10.5 3.5L5.5 8l5 4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
      </header>

      <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white/95 px-2 py-1.5">
        {query.isLoading ? (
          <p className="p-8 text-sm text-stone-400">Loading...</p>
        ) : sorted.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-0.5">
            {sorted.map((t) => (
              <TaskCard key={t.id} task={t} today={today} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-20 text-center">
      <p className="text-sm font-medium text-stone-600">No tasks with this tag.</p>
      <p className="text-xs text-stone-400">Add #tag to a task title to see it here.</p>
    </div>
  );
}
