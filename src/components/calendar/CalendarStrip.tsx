import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDayCount } from "../../hooks/useDayCount";
import { useTasks } from "../../hooks/useTasks";
import { useMoveTask } from "../../hooks/useMoveTask";
import { addDays, buildDayWindow, todayLocal, toISODate } from "../../lib/dates";
import {
  DESKTOP_DAY_COUNT_OPTIONS,
  useSettings,
  type DesktopDayCount,
} from "../../state/settings";
import type { Task } from "../../types";
import DayColumn from "./DayColumn";
import TaskCard from "./TaskCard";

export default function CalendarStrip() {
  const dayCount = useDayCount();
  const moveTask = useMoveTask();
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const { today, windowDates, windowStart, windowEndExclusive } = useMemo(() => {
    const start = todayLocal();
    const dates = buildDayWindow(start, dayCount);
    return {
      today: toISODate(start),
      windowDates: dates,
      windowStart: toISODate(start),
      windowEndExclusive: toISODate(addDays(start, dayCount)),
    };
  }, [dayCount]);

  const tasksQuery = useTasks(windowStart, windowEndExclusive);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasksQuery.data ?? []) {
      const list = map.get(t.scheduled_date) ?? [];
      list.push(t);
      map.set(t.scheduled_date, list);
    }
    return map;
  }, [tasksQuery.data]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragStart(event: DragStartEvent) {
    const task = event.active.data.current?.task as Task | undefined;
    setActiveTask(task ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const task = active.data.current?.task as Task | undefined;
    if (!task) return;

    const overId = over.id as string;
    if (!overId.startsWith("day:")) return;
    const targetDate = overId.slice(4); // strip "day:" prefix

    if (targetDate === task.scheduled_date) return; // same column — no-op

    moveTask.mutate({ task, targetDate, windowStart, windowEndExclusive });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col">
        <div className="mb-3 hidden justify-end xl:flex">
          <DayCountToggle />
        </div>

        {tasksQuery.error && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
            Failed to load tasks:{" "}
            {tasksQuery.error instanceof Error
              ? tasksQuery.error.message
              : String(tasksQuery.error)}
          </div>
        )}

        <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 sm:min-h-[70vh] sm:flex-row xl:[&>section]:min-w-[180px] 2xl:[&>section]:min-w-[220px]">
          {windowDates.map((date) => {
            const iso = toISODate(date);
            return (
              <DayColumn
                key={iso}
                date={date}
                isoDate={iso}
                isToday={iso === today}
                today={today}
                tasks={tasksByDate.get(iso) ?? []}
              />
            );
          })}
        </div>

        {tasksQuery.isLoading && (
          <p className="mt-3 text-xs text-stone-400">Loading tasks…</p>
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="rotate-1 scale-105 rounded-lg border border-slate-200 bg-white px-2 py-1.5 shadow-panel opacity-95">
            <TaskCard task={activeTask} today={today} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function DayCountToggle() {
  const { desktopDayCount, setDesktopDayCount } = useSettings();
  return (
    <div
      role="radiogroup"
      aria-label="Number of days"
      className="inline-flex w-fit gap-0.5 rounded-lg border border-slate-200/80 bg-white/60 p-0.5 text-[12px]"
    >
      {DESKTOP_DAY_COUNT_OPTIONS.map((n: DesktopDayCount) => {
        const selected = desktopDayCount === n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setDesktopDayCount(n)}
            className={`focus-ring rounded-md px-3 py-1 font-medium transition-all duration-150 ease-out-soft ${
              selected
                ? "bg-accent-50 text-accent-700"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            {n} days
          </button>
        );
      })}
    </div>
  );
}
