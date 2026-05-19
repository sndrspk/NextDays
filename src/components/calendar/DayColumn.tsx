import { useDroppable } from "@dnd-kit/core";
import type { ISODate, Task } from "../../types";
import { diffInDays, formatColumnHeader } from "../../lib/dates";
import type { IcsCalendar, IcsEvent } from "../../lib/ics";
import { isPastEvent } from "../../lib/ics";
import TaskCard from "./TaskCard";
import EventCard from "./EventCard";
import QuickAdd from "./QuickAdd";

interface DayColumnProps {
  date: Date;
  isoDate: ISODate;
  isToday: boolean;
  today: ISODate;
  tasks: Task[];
  events?: IcsEvent[];
  calendars?: IcsCalendar[];
  showCompleted?: boolean;
}

// Sort: completed tasks sink to the bottom. Active tasks are ordered by
// (a) earliest due_date first (tasks with no due_date go last), then
// (b) latest scheduled_date first, then by sort_order as a tiebreaker.
export function compareActiveTasks(a: Task, b: Task): number {
  if (a.due_date !== b.due_date) {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date < b.due_date ? -1 : 1;
  }
  if (a.scheduled_date !== b.scheduled_date) {
    return a.scheduled_date < b.scheduled_date ? 1 : -1;
  }
  return a.sort_order - b.sort_order;
}

function sortTasks(tasks: Task[]): Task[] {
  const active: Task[] = [];
  const completed: Task[] = [];
  for (const t of tasks) (t.completed ? completed : active).push(t);
  active.sort(compareActiveTasks);
  completed.sort(
    (a, b) => (a.completed_at ?? "").localeCompare(b.completed_at ?? ""),
  );
  return [...active, ...completed];
}

function dayLabel(isoDate: ISODate, today: ISODate, weekday: string): string {
  const offset = diffInDays(isoDate, today);
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  return weekday;
}

export default function DayColumn({
  date,
  isoDate,
  isToday,
  today,
  tasks,
  events = [],
  calendars = [],
  showCompleted = true,
}: DayColumnProps) {
  const { weekday, dayMonth } = formatColumnHeader(date);
  const label = dayLabel(isoDate, today, weekday);
  const filtered = showCompleted ? tasks : tasks.filter((t) => !t.completed);
  const sorted = sortTasks(filtered);
  const visibleEvents = events.filter((ev) => !isPastEvent(ev));
  const colourByCalendar = new Map(calendars.map((c) => [c.id, c.colour]));

  const { setNodeRef, isOver } = useDroppable({ id: `day:${isoDate}` });

  return (
    <section
      ref={setNodeRef}
      className={`relative flex min-w-0 flex-1 flex-col border-b border-slate-200/70 px-4 pt-4 pb-6 last:border-b-0 sm:border-b-0 sm:border-r sm:px-5 sm:pt-5 sm:pb-7 sm:last:border-r-0 transition-colors duration-100 ${
        isOver
          ? "bg-accent-100/60"
          : isToday
          ? "bg-accent-50/40"
          : "bg-transparent"
      }`}
      data-date={isoDate}
    >
      <header className="mb-4">
        <div
          className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${
            isToday ? "text-accent" : "text-stone-400"
          }`}
        >
          {dayMonth}
        </div>
        <div
          className={`mt-1 text-[17px] tracking-tight ${
            isToday ? "font-semibold text-stone-900" : "font-medium text-stone-700"
          }`}
        >
          {label}
        </div>
      </header>

      {visibleEvents.length > 0 && (
        <ul className="mb-2 space-y-1">
          {visibleEvents.map((ev) => (
            <EventCard
              key={ev.id}
              event={ev}
              colour={colourByCalendar.get(ev.calendarId) ?? "#64748b"}
            />
          ))}
        </ul>
      )}

      <ul className="flex-1 space-y-0.5">
        {sorted.map((t) => (
          <TaskCard key={t.id} task={t} today={today} />
        ))}
      </ul>

      <QuickAdd scheduledDate={isoDate} />
    </section>
  );
}
