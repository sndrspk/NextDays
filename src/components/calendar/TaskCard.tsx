import type { ISODate, Task } from "../../types";
import { diffInDays } from "../../lib/dates";
import { useToggleTaskCompleted } from "../../hooks/useTaskMutations";
import { useProjects } from "../../hooks/useProjects";
import { useSelection } from "../../state/selection";

type DueUrgency = "overdue" | "today" | "tomorrow" | "later" | "none";

function urgency(dueDate: ISODate | null, today: ISODate, completed: boolean): DueUrgency {
  if (!dueDate || completed) return "none";
  const d = diffInDays(dueDate, today);
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  return "later";
}

interface TaskCardProps {
  task: Task;
  today: ISODate;
}

export default function TaskCard({ task, today }: TaskCardProps) {
  const toggle = useToggleTaskCompleted();
  const { setSelectedTaskId } = useSelection();
  const projectsQuery = useProjects();
  const project = task.project_id
    ? projectsQuery.data?.find((p) => p.id === task.project_id)
    : undefined;
  const u = urgency(task.due_date, today, task.completed);

  const titleClass = task.completed
    ? "text-stone-400 line-through"
    : u === "overdue"
    ? "text-red-600"
    : u === "today"
    ? "text-orange-600"
    : "text-stone-800";

  const bellClass =
    u === "overdue" ? "text-red-500" : u === "today" || u === "tomorrow" ? "text-orange-500" : "";

  const showBell = !task.completed && (u === "overdue" || u === "today" || u === "tomorrow");

  return (
    <li
      className="group flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors duration-150 ease-out-soft hover:bg-stone-50"
      onClick={() => setSelectedTaskId(task.id)}
    >
      <button
        type="button"
        aria-label={task.completed ? "Mark task incomplete" : "Mark task complete"}
        onClick={(e) => {
          e.stopPropagation();
          toggle.mutate(task);
        }}
        disabled={toggle.isPending}
        className={`focus-ring mt-[3px] inline-flex h-4 w-4 flex-none items-center justify-center rounded-full border transition-all duration-150 ease-out-soft ${
          task.completed
            ? "border-accent bg-accent text-white"
            : "border-stone-300 bg-white hover:border-accent/60 hover:shadow-sm"
        } disabled:opacity-50`}
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
      <span className={`flex flex-1 items-start gap-1.5 text-[13px] leading-snug ${titleClass}`}>
        {project && (
          <span
            aria-hidden
            title={project.name}
            className="mt-[7px] inline-block h-1.5 w-1.5 flex-none rounded-full ring-1 ring-inset ring-black/5"
            style={{ backgroundColor: project.colour }}
          />
        )}
        <span>
          {showBell && <span className={`mr-1 ${bellClass}`}>🔔</span>}
          {task.title}
        </span>
      </span>
    </li>
  );
}
