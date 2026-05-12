import type { ISODate, Task } from "../../types";
import { diffInDays, formatColumnHeader } from "../../lib/dates";
import TaskCard from "./TaskCard";
import QuickAdd from "./QuickAdd";

interface DayColumnProps {
  date: Date;
  isoDate: ISODate;
  isToday: boolean;
  today: ISODate;
  tasks: Task[];
}

function sortTasks(tasks: Task[], today: ISODate): Task[] {
  const pinned: Task[] = [];
  const regular: Task[] = [];
  const completed: Task[] = [];

  for (const t of tasks) {
    if (t.completed) {
      completed.push(t);
      continue;
    }
    if (t.due_date) {
      const d = diffInDays(t.due_date, today);
      if (d <= 1) {
        pinned.push(t);
        continue;
      }
    }
    regular.push(t);
  }

  pinned.sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  regular.sort((a, b) => a.sort_order - b.sort_order);
  completed.sort(
    (a, b) => (a.completed_at ?? "").localeCompare(b.completed_at ?? ""),
  );

  return [...pinned, ...regular, ...completed];
}

export default function DayColumn({ date, isoDate, isToday, today, tasks }: DayColumnProps) {
  const { weekday, dayMonth } = formatColumnHeader(date);
  const sorted = sortTasks(tasks, today);

  return (
    <section
      className={`flex min-w-0 flex-1 flex-col border-r border-stone-200 px-5 pt-5 pb-8 last:border-r-0 ${
        isToday ? "bg-stone-50" : "bg-white"
      }`}
      data-date={isoDate}
    >
      <header className="mb-4">
        <div
          className={`text-[11px] uppercase tracking-[0.12em] ${
            isToday ? "text-stone-900" : "text-stone-400"
          }`}
        >
          {weekday}
        </div>
        <div
          className={`mt-0.5 text-base ${
            isToday ? "font-semibold text-stone-900" : "font-medium text-stone-600"
          }`}
        >
          {dayMonth}
        </div>
      </header>

      <ul className="flex-1">
        {sorted.map((t) => (
          <TaskCard key={t.id} task={t} today={today} />
        ))}
      </ul>

      <QuickAdd scheduledDate={isoDate} />
    </section>
  );
}
