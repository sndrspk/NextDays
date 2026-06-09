import { useMemo, useState } from "react";
import { useFocusTasks } from "../../hooks/useFocusTasks";
import { useSoonTasks } from "../../hooks/useSoonTasks";
import { useCreateTask } from "../../hooks/useTaskMutations";
import { useProjects } from "../../hooks/useProjects";
import { useExternalEvents } from "../../hooks/useExternalEvents";
import { useIcsCalendars } from "../../hooks/useIcsCalendars";
import { parseTaskTitle } from "../../lib/parseTaskTitle";
import TaskCard from "../calendar/TaskCard";
import EventCard from "../calendar/EventCard";
import { compareActiveTasks } from "../calendar/DayColumn";
import CompletedToggle from "../common/CompletedToggle";
import type { ISODate, Task } from "../../types";
import type { IcsEvent } from "../../lib/ics";
import { isPastEvent } from "../../lib/ics";

function partitionAndSort(tasks: Task[]): Task[] {
  const active: Task[] = [];
  const completed: Task[] = [];
  for (const t of tasks) (t.completed ? completed : active).push(t);
  active.sort(compareActiveTasks);
  completed.sort(
    (a, b) => (a.completed_at ?? "").localeCompare(b.completed_at ?? ""),
  );
  return [...active, ...completed];
}

function sortBySortOrder(tasks: Task[]): Task[] {
  const active: Task[] = [];
  const completed: Task[] = [];
  for (const t of tasks) (t.completed ? completed : active).push(t);
  active.sort((a, b) => a.sort_order - b.sort_order);
  completed.sort(
    (a, b) => (a.completed_at ?? "").localeCompare(b.completed_at ?? ""),
  );
  return [...active, ...completed];
}

export default function FocusView() {
  const query = useFocusTasks();
  const soonQuery = useSoonTasks();
  const today = query.data?.today ?? "";
  const tasks = query.data?.tasks ?? [];
  const soonTasks = soonQuery.data ?? [];
  const [showCompleted, setShowCompleted] = useState(false);
  const calendarsQuery = useIcsCalendars();
  const icsCalendars = calendarsQuery.data ?? [];
  const { byDate: eventsByDate } = useExternalEvents();
  const todaysEvents = (today ? eventsByDate.get(today as ISODate) ?? [] : []).filter(
    (ev) => !isPastEvent(ev),
  );

  const { overdue, dueToday, otherToday, soonFiltered } = useMemo(() => {
    const overdue: Task[] = [];
    const dueToday: Task[] = [];
    const otherToday: Task[] = [];
    const source = showCompleted ? tasks : tasks.filter((t) => !t.completed);
    for (const t of source) {
      if (t.due_date && t.due_date < today) overdue.push(t);
      else if (t.due_date && t.due_date === today) dueToday.push(t);
      else if (t.scheduled_date === today) otherToday.push(t);
    }
    const soonSource = showCompleted ? soonTasks : soonTasks.filter((t) => !t.completed);
    return {
      overdue: partitionAndSort(overdue),
      dueToday: partitionAndSort(dueToday),
      otherToday: partitionAndSort(otherToday),
      soonFiltered: sortBySortOrder(soonSource),
    };
  }, [tasks, soonTasks, today, showCompleted]);

  const total = overdue.length + dueToday.length + otherToday.length + soonFiltered.length;

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col px-4 py-5 sm:px-8 sm:py-8 lg:px-10">
      <header className="mb-5 flex items-start justify-between gap-3 sm:mb-6">
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight text-stone-900 sm:text-[26px]">
            Focus
          </h2>
          <p className="text-[12px] text-stone-500">What needs your attention today.</p>
        </div>
        <CompletedToggle showCompleted={showCompleted} onChange={setShowCompleted} />
      </header>

      <EventsSection events={todaysEvents} calendars={icsCalendars} />

      {today && <FocusQuickAdd today={today} />}

      <div className="mt-5 flex-1 space-y-6 overflow-y-auto">
        {query.isLoading ? (
          <p className="text-sm text-stone-400">Loading…</p>
        ) : total === 0 ? (
          <EmptyState />
        ) : (
          <>
            <Section label="Overdue" tone="overdue" tasks={overdue} today={today} />
            <Section label="Due today" tone="today" tasks={dueToday} today={today} />
            <Section label="Scheduled for today" tone="default" tasks={otherToday} today={today} />
            <Section label="Soon" tone="soon" tasks={soonFiltered} today={today} />
          </>
        )}
      </div>
    </div>
  );
}

function Section({
  label,
  tone,
  tasks,
  today,
}: {
  label: string;
  tone: "overdue" | "today" | "default" | "soon";
  tasks: Task[];
  today: ISODate;
}) {
  if (tasks.length === 0) return null;
  const labelClass =
    tone === "overdue"
      ? "text-red-600"
      : tone === "today"
      ? "text-orange-600"
      : tone === "soon"
      ? "text-accent-600"
      : "text-stone-500";
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${labelClass}`}>
          {label}
        </span>
        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-500">
          {tasks.length}
        </span>
      </div>
      <ul className="rounded-2xl border border-slate-200/80 bg-white/95 px-2 py-1.5">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} today={today} />
        ))}
      </ul>
    </section>
  );
}

function EventsSection({
  events,
  calendars,
}: {
  events: IcsEvent[];
  calendars: { id: string; colour: string }[];
}) {
  if (events.length === 0) return null;
  const colourByCalendar = new Map(calendars.map((c) => [c.id, c.colour]));
  return (
    <section className="mb-4">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
          Calendar events today
        </span>
        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-500">
          {events.length}
        </span>
      </div>
      <ul className="space-y-1 rounded-2xl border border-slate-200/80 bg-white/95 px-2 py-1.5">
        {events.map((ev) => (
          <EventCard
            key={ev.id}
            event={ev}
            colour={colourByCalendar.get(ev.calendarId) ?? "#64748b"}
          />
        ))}
      </ul>
    </section>
  );
}

function FocusQuickAdd({ today }: { today: ISODate }) {
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
        scheduled_date: today,
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
      className="flex w-full items-center rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 transition-colors focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/20"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="+ Add task for today"
        disabled={create.isPending}
        className="w-full bg-transparent text-[13px] text-stone-800 placeholder:text-stone-400 focus:outline-none disabled:opacity-50"
      />
    </form>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-20 text-center">
      <p className="text-sm font-medium text-stone-600">Inbox zero.</p>
      <p className="text-xs text-stone-400">Nothing overdue or scheduled. Enjoy the day.</p>
    </div>
  );
}
