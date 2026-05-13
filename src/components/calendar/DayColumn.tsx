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
      className={`relative flex min-w-0 flex-1 flex-col border-b border-slate-200/70 px-4 pt-4 pb-6 last:border-b-0 sm:border-b-0 sm:border-r sm:px-5 sm:pt-5 sm:pb-7 sm:last:border-r-0 ${
        isToday ? "bg-accent-50/40" : "bg-transparent"
      }`}
      data-date={isoDate}
    >
      <header className="mb-4">
        <div
          className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${
            isToday ? "text-accent" : "text-stone-400"
          }`}
        >
          {isToday ? "Today" : weekday}
        </div>
        <div
          className={`mt-1 text-[17px] tracking-tight ${
            isToday ? "font-semibold text-stone-900" : "font-medium text-stone-700"
          }`}
        >
          {dayMonth}
        </div>
      </header>

      <ul className="flex-1 space-y-0.5">
        {sorted.map((t) => (
          <TaskCard key={t.id} task={t} today={today} />
        ))}
      </ul>

      <QuickAdd scheduledDate={isoDate} />
    </section>
  );
}
