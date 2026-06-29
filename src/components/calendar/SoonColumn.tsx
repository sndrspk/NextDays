import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { Task } from "../../types";
import { useCreateTask } from "../../hooks/useTaskMutations";
import { useProjects } from "../../hooks/useProjects";
import { parseTaskTitle } from "../../lib/parseTaskTitle";
import TaskCard from "./TaskCard";

interface SoonColumnProps {
  tasks: Task[];
  today: string;
  showCompleted?: boolean;
  variant?: "strip" | "card";
  className?: string;
  // Overrides the resting (non-drag) background classes. Drag-hover always wins.
  restingBg?: string;
}

function sortSoonTasks(tasks: Task[]): Task[] {
  const active: Task[] = [];
  const completed: Task[] = [];
  for (const t of tasks) (t.completed ? completed : active).push(t);
  active.sort((a, b) => a.sort_order - b.sort_order);
  completed.sort(
    (a, b) => (a.completed_at ?? "").localeCompare(b.completed_at ?? ""),
  );
  return [...active, ...completed];
}

export default function SoonColumn({
  tasks,
  today,
  showCompleted = true,
  variant = "strip",
  className = "",
  restingBg,
}: SoonColumnProps) {
  const filtered = showCompleted ? tasks : tasks.filter((t) => !t.completed);
  const sorted = sortSoonTasks(filtered);

  const { setNodeRef, isOver } = useDroppable({ id: "soon" });

  const shape =
    variant === "card"
      ? "rounded-2xl border border-slate-200/80 px-4 pt-4 pb-6 sm:px-5 sm:pt-5 sm:pb-7"
      : "flex-1 border-b border-slate-200/70 px-4 pt-4 pb-6 last:border-b-0 sm:border-b-0 sm:border-r sm:px-5 sm:pt-5 sm:pb-7 sm:last:border-r-0";
  const background = isOver
    ? "bg-accent-100/60"
    : restingBg
    ? restingBg
    : variant === "card"
    ? "bg-white/95"
    : "bg-transparent";

  return (
    <section
      ref={setNodeRef}
      className={`relative flex min-w-0 flex-col transition-colors duration-100 ${shape} ${background} ${className}`}
    >
      <header className="mb-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">
          No date
        </div>
        <div className="mt-1 text-[17px] font-medium tracking-tight text-stone-700">
          Soon
        </div>
      </header>

      <ul className="flex-1 space-y-0.5">
        {sorted.map((t) => (
          <TaskCard key={t.id} task={t} today={today} />
        ))}
      </ul>

      <SoonQuickAdd />
    </section>
  );
}

function SoonQuickAdd() {
  const [title, setTitle] = useState("");
  const create = useCreateTask();
  const projectsQuery = useProjects();

  function submit() {
    const trimmed = title.trim();
    if (!trimmed || create.isPending) return;
    const parsed = parseTaskTitle(trimmed, projectsQuery.data ?? []);
    if (!parsed.title) return;
    create.mutate(
      {
        title: parsed.title,
        soon: true,
        project_id: parsed.project_id,
        tags: parsed.tags,
      },
      { onSuccess: () => setTitle("") },
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="group/quick mt-4 -mx-1 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-slate-50 focus-within:bg-slate-50"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="+ Add task"
        disabled={create.isPending}
        className="w-full bg-transparent text-[13px] text-stone-800 placeholder:text-stone-400 focus:outline-none focus:placeholder:text-stone-300 disabled:opacity-50"
      />
    </form>
  );
}
