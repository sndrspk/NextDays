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
      className={`relative flex min-w-0 flex-1 flex-col border-r border-black/[0.05] px-5 pt-5 pb-7 last:border-r-0 ${
        isToday ? "bg-gradient-to-b from-accent-50/40 via-white to-white" : "bg-white"
      }`}
      data-date={isoDate}
    >
      {isToday && (
        <span
          aria-hidden
          className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent"
        />
      )}
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
