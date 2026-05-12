import type { ISODate, Task } from "../../types";
import { diffInDays } from "../../lib/dates";
import { useToggleTaskCompleted } from "../../hooks/useTaskMutations";

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
    <li className="group flex items-start gap-2 py-1.5">
      <button
        type="button"
        aria-label={task.completed ? "Mark task incomplete" : "Mark task complete"}
        onClick={() => toggle.mutate(task)}
        disabled={toggle.isPending}
        className={`mt-1 inline-flex h-3.5 w-3.5 flex-none items-center justify-center rounded-[3px] border transition-colors ${
          task.completed
            ? "border-stone-300 bg-stone-200 text-stone-500"
            : "border-stone-400 hover:border-stone-700"
        } disabled:opacity-50`}
      >
        {task.completed && (
          <svg
            viewBox="0 0 12 12"
            aria-hidden
            className="h-2.5 w-2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="2.5,6.5 5,9 9.5,3.5" />
          </svg>
        )}
      </button>
      <span className={`text-sm leading-snug ${titleClass}`}>
        {showBell && <span className={`mr-1 ${bellClass}`}>🔔</span>}
        {task.title}
      </span>
    </li>
  );
}
