import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { ISODate, Task } from "../../types";
import { dueUrgency, isDueOrOverdue } from "../../lib/dates";
import { PILL_BASE, TAG_PILL, TAG_PILL_COMPLETED, dueBadgeFor } from "../../lib/dueBadge";
import { useToggleTaskCompleted } from "../../hooks/useTaskMutations";
import { useProjects } from "../../hooks/useProjects";
import { useSelection } from "../../state/selection";
import { useToast } from "../../state/toast";

interface TaskCardProps {
  task: Task;
  today: ISODate;
}

export default function TaskCard({ task, today }: TaskCardProps) {
  const toggle = useToggleTaskCompleted();
  const { setSelectedTaskId } = useSelection();
  const { push } = useToast();
  const projectsQuery = useProjects();
  const project = task.project_id
    ? projectsQuery.data?.find((p) => p.id === task.project_id)
    : undefined;
  const u = dueUrgency(task.due_date, today, task.completed);
  const badge = dueBadgeFor(u);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const urgent = isDueOrOverdue(task.due_date, today, task.completed);
  const titleClass = task.completed
    ? "text-stone-400 line-through"
    : u === "overdue"
    ? "text-red-600"
    : u === "today"
    ? "text-orange-600"
    : "text-stone-800";
  const weightClass = urgent ? "font-semibold" : "";

  const tint = project?.colour ?? null;
  const checkboxStyle = tint
    ? task.completed
      ? { backgroundColor: tint, borderColor: tint }
      : { borderColor: tint }
    : undefined;
  const checkboxClass = task.completed
    ? tint
      ? "text-white"
      : "border-accent bg-accent text-white"
    : tint
    ? "bg-white hover:shadow-sm"
    : "border-stone-300 bg-white hover:border-accent/60 hover:shadow-sm";

  const dragStyle = transform
    ? { transform: CSS.Transform.toString(transform), zIndex: 50 }
    : undefined;

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    const wasCompleted = task.completed;
    toggle.mutate(task, {
      onSuccess: () => {
        push({
          message: wasCompleted ? "Task marked active" : "Task completed",
          actionLabel: "Undo",
          onAction: () => {
            toggle.mutate({ ...task, completed: !wasCompleted });
          },
        });
      },
    });
  }

  return (
    <li
      ref={setNodeRef}
      style={dragStyle}
      className={`group flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors duration-150 ease-out-soft hover:bg-slate-50 ${
        isDragging ? "opacity-40" : ""
      }`}
      onClick={() => !isDragging && setSelectedTaskId(task.id)}
    >
      <button
        type="button"
        aria-label="Drag task"
        className="focus-ring mt-[3px] inline-flex h-6 w-6 flex-none cursor-grab items-center justify-center rounded text-stone-400 transition-colors hover:bg-slate-100 hover:text-stone-600 active:cursor-grabbing"
        {...listeners}
        {...attributes}
      >
        <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" fill="currentColor">
          <circle cx="3" cy="3" r="1.2" />
          <circle cx="9" cy="3" r="1.2" />
          <circle cx="3" cy="6" r="1.2" />
          <circle cx="9" cy="6" r="1.2" />
          <circle cx="3" cy="9" r="1.2" />
          <circle cx="9" cy="9" r="1.2" />
        </svg>
      </button>
      <button
        type="button"
        aria-label={task.completed ? "Mark task incomplete" : "Mark task complete"}
        title={project?.name}
        onClick={handleToggle}
        disabled={toggle.isPending}
        style={checkboxStyle}
        className={`focus-ring mt-[3px] inline-flex h-4 w-4 flex-none items-center justify-center rounded-full border-[1.5px] transition-all duration-150 ease-out-soft ${checkboxClass} disabled:opacity-50`}
      >
        {task.completed && (
          <svg
            viewBox="0 0 12 12"
            aria-hidden
            className="h-2.5 w-2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="2.5,6.5 5,9 9.5,3.5" />
          </svg>
        )}
      </button>
      <span className={`flex-1 text-[13px] leading-snug ${titleClass} ${weightClass}`}>
        {task.title}
        {task.template_id && (
          <span aria-label="Recurring" title="Recurring" className="ml-1 text-stone-400">
            ↻
          </span>
        )}
        {badge && <span className={`${PILL_BASE} ${badge.className}`}>{badge.label}</span>}
        {task.tags?.map((tag) => (
          <span
            key={tag}
            className={`${PILL_BASE} ${task.completed ? TAG_PILL_COMPLETED : TAG_PILL}`}
          >
            {tag}
          </span>
        ))}
      </span>
    </li>
  );
}
