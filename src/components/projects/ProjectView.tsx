import { useMemo, useState } from "react";
import { useProjects } from "../../hooks/useProjects";
import { useProjectTasks } from "../../hooks/useProjectTasks";
import { useCreateTask, useToggleTaskCompleted } from "../../hooks/useTaskMutations";
import { isDueOrOverdue, todayLocal, toISODate } from "../../lib/dates";
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
    <div className="flex h-full flex-col px-10 py-8">
      <header className="mb-6 flex items-center gap-3">
        <span
          aria-hidden
          className="inline-block h-3.5 w-3.5 rounded-full ring-2 ring-inset ring-black/[0.05]"
          style={{ backgroundColor: project.colour }}
        />
        <h2 className="text-[26px] font-semibold tracking-tight text-stone-900">{project.name}</h2>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500 shadow-card">
          {project.is_personal ? "Personal" : "Work"}
        </span>
      </header>

      <div className="mb-4 flex items-center justify-between gap-3">
        <SegmentedFilter value={filter} onChange={setFilter} />
        <ProjectQuickAdd projectId={projectId} today={today} />
      </div>

      <div className="flex-1 overflow-y-auto rounded-2xl border border-black/[0.06] bg-white shadow-elevated">
        {tasksQuery.isLoading ? (
          <p className="p-8 text-sm text-stone-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Nothing here yet"
            subtitle={
              filter === "active"
                ? "Use the input above to add your first task."
                : filter === "completed"
                ? "Completed tasks will appear here."
                : "No tasks in this project."
            }
          />
        ) : (
          <ul className="divide-y divide-stone-100/80">
            {filtered.map((t) => (
              <ProjectTaskRow key={t.id} task={t} today={today} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SegmentedFilter({
  value,
  onChange,
}: {
  value: Filter;
  onChange: (next: Filter) => void;
}) {
  const items: Filter[] = ["active", "completed", "all"];
  return (
    <div className="inline-flex w-fit gap-0.5 rounded-lg bg-stone-200/60 p-0.5 text-[12px]">
      {items.map((f) => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className={`focus-ring rounded-md px-3 py-1 font-medium capitalize transition-all duration-150 ease-out-soft ${
            value === f
              ? "bg-white text-stone-900 shadow-card"
              : "text-stone-500 hover:text-stone-900"
          }`}
        >
          {f}
        </button>
      ))}
    </div>
  );
}

function ProjectQuickAdd({ projectId, today }: { projectId: UUID; today: string }) {
  const [title, setTitle] = useState("");
  const create = useCreateTask();

  function submit() {
    const trimmed = title.trim();
    if (!trimmed || create.isPending) return;
    create.mutate(
      { title: trimmed, scheduled_date: today, project_id: projectId },
      { onSuccess: () => setTitle("") },
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex w-72 items-center rounded-lg border border-stone-200 bg-white px-3 py-1.5 shadow-card focus-within:border-accent/40 focus-within:ring-2 focus-within:ring-accent/20"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="+ Add task to project"
        disabled={create.isPending}
        className="w-full bg-transparent text-[13px] text-stone-800 placeholder:text-stone-400 focus:outline-none disabled:opacity-50"
      />
    </form>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 px-6 py-16 text-center">
      <p className="text-sm font-medium text-stone-600">{title}</p>
      <p className="text-xs text-stone-400">{subtitle}</p>
    </div>
  );
}

function ProjectTaskRow({ task, today }: { task: Task; today: string }) {
  const toggle = useToggleTaskCompleted();
  const { setSelectedTaskId } = useSelection();

  const overdue = task.due_date && !task.completed && task.due_date < today;
  const urgent = isDueOrOverdue(task.due_date, today, task.completed);

  return (
    <li
      onClick={() => setSelectedTaskId(task.id)}
      className="group flex cursor-pointer items-center gap-3 px-5 py-2.5 transition-colors duration-150 ease-out-soft hover:bg-stone-50/80"
    >
      <button
        type="button"
        aria-label={task.completed ? "Mark task incomplete" : "Mark task complete"}
        onClick={(e) => {
          e.stopPropagation();
          toggle.mutate(task);
        }}
        disabled={toggle.isPending}
        className={`focus-ring inline-flex h-4 w-4 flex-none items-center justify-center rounded-full border transition-all duration-150 ease-out-soft ${
          task.completed
            ? "border-accent bg-accent text-white"
            : "border-stone-300 bg-white hover:border-accent/60 hover:shadow-sm"
        } disabled:opacity-50`}
      >
        {task.completed && (
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2.5,6.5 5,9 9.5,3.5" />
          </svg>
        )}
      </button>
      <span
        className={`flex-1 text-[13px] ${
          task.completed ? "text-stone-400 line-through" : "text-stone-800"
        } ${urgent ? "font-semibold" : ""}`}
      >
        {task.title}
      </span>
      <span className={`text-[11px] ${overdue ? "font-medium text-red-600" : "text-stone-400"}`}>
        {task.scheduled_date}
      </span>
    </li>
  );
}
