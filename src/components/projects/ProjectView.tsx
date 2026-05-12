import { useMemo, useState } from "react";
import { useProjects } from "../../hooks/useProjects";
import { useProjectTasks } from "../../hooks/useProjectTasks";
import { useToggleTaskCompleted } from "../../hooks/useTaskMutations";
import { todayLocal, toISODate } from "../../lib/dates";
import { useSelection } from "../../state/selection";
import type { Task, UUID } from "../../types";

type Filter = "active" | "completed" | "all";

interface ProjectViewProps {
  projectId: UUID;
}

export default function ProjectView({ projectId }: ProjectViewProps) {
  const projectsQuery = useProjects();
  const tasksQuery = useProjectTasks(projectId);
  const [filter, setFilter] = useState<Filter>("active");

  const project = projectsQuery.data?.find((p) => p.id === projectId);
  const today = toISODate(todayLocal());

  const filtered = useMemo(() => {
    const all = tasksQuery.data ?? [];
    if (filter === "active") return all.filter((t) => !t.completed);
    if (filter === "completed") return all.filter((t) => t.completed);
    return all;
  }, [tasksQuery.data, filter]);

  if (!project) {
    return (
      <div className="p-8 text-sm text-stone-500">
        {projectsQuery.isLoading ? "Loading…" : "Project not found."}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col px-8 py-6">
      <header className="mb-6 flex items-center gap-3">
        <span
          aria-hidden
          className="inline-block h-3.5 w-3.5 rounded-full"
          style={{ backgroundColor: project.colour }}
        />
        <h2 className="text-2xl font-semibold tracking-tight text-stone-900">{project.name}</h2>
        <span className="text-[11px] uppercase tracking-[0.12em] text-stone-400">
          {project.is_personal ? "Personal" : "Work"}
        </span>
      </header>

      <div className="mb-4 flex gap-1 text-xs">
        {(["active", "completed", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1 capitalize ${
              filter === f
                ? "bg-stone-900 text-white"
                : "bg-transparent text-stone-500 hover:text-stone-900"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto rounded-lg border border-stone-200 bg-white">
        {tasksQuery.isLoading ? (
          <p className="p-6 text-sm text-stone-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-stone-400">No tasks.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {filtered.map((t) => (
              <ProjectTaskRow key={t.id} task={t} today={today} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ProjectTaskRow({ task, today }: { task: Task; today: string }) {
  const toggle = useToggleTaskCompleted();
  const { setSelectedTaskId } = useSelection();

  const overdue = task.due_date && !task.completed && task.due_date < today;

  return (
    <li
      onClick={() => setSelectedTaskId(task.id)}
      className="group flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-stone-50"
    >
      <button
        type="button"
        aria-label={task.completed ? "Mark task incomplete" : "Mark task complete"}
        onClick={(e) => {
          e.stopPropagation();
          toggle.mutate(task);
        }}
        disabled={toggle.isPending}
        className={`inline-flex h-3.5 w-3.5 flex-none items-center justify-center rounded-[3px] border ${
          task.completed
            ? "border-stone-300 bg-stone-200 text-stone-500"
            : "border-stone-400 hover:border-stone-700"
        } disabled:opacity-50`}
      >
        {task.completed && (
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2.5,6.5 5,9 9.5,3.5" />
          </svg>
        )}
      </button>
      <span
        className={`flex-1 text-sm ${
          task.completed ? "text-stone-400 line-through" : "text-stone-800"
        }`}
      >
        {task.title}
      </span>
      <span className={`text-xs ${overdue ? "text-red-600" : "text-stone-400"}`}>
        {task.scheduled_date}
      </span>
    </li>
  );
}
