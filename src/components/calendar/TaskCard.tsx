import type { ISODate, Task } from "../../types";
import { diffInDays } from "../../lib/dates";

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
      <span
        aria-hidden
        className={`mt-1 inline-block h-3.5 w-3.5 flex-none rounded-[3px] border ${
          task.completed ? "border-stone-300 bg-stone-200" : "border-stone-400"
        }`}
      />
      <span className={`text-sm leading-snug ${titleClass}`}>
        {showBell && <span className={`mr-1 ${bellClass}`}>🔔</span>}
        {task.title}
      </span>
    </li>
  );
}
