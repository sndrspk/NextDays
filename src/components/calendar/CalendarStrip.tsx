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
import { useSoonTasks } from "../../hooks/useSoonTasks";
import { useMoveTask } from "../../hooks/useMoveTask";
import { useExternalEvents } from "../../hooks/useExternalEvents";
import { useIcsCalendars } from "../../hooks/useIcsCalendars";
import { addDays, buildDayWindow, todayLocal, toISODate } from "../../lib/dates";
import type { Task } from "../../types";
import DayColumn from "./DayColumn";
import SoonColumn from "./SoonColumn";
import TaskCard from "./TaskCard";
import LayoutToggle from "./LayoutToggle";
import CompletedToggle from "../common/CompletedToggle";
import { useSettings } from "../../state/settings";

export default function CalendarStrip() {
  const dayCount = useDayCount();
  const moveTask = useMoveTask();
  const { calendarLayout, setCalendarLayout } = useSettings();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [showCompleted, setShowCompleted] = useState(true);
  const calendarsQuery = useIcsCalendars();
  const icsCalendars = calendarsQuery.data ?? [];
  const { byDate: eventsByDate } = useExternalEvents();

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
  const soonQuery = useSoonTasks();

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasksQuery.data ?? []) {
      if (!t.scheduled_date) continue;
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

    if (overId === "soon") {
      if (task.soon) return;
      moveTask.mutate({ task, targetDate: "soon", windowStart, windowEndExclusive });
      return;
    }

    if (!overId.startsWith("day:")) return;
    const targetDate = overId.slice(4);

    if (targetDate === task.scheduled_date && !task.soon) return;

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
        <div className="mb-3 flex items-center justify-end gap-2">
          <LayoutToggle layout={calendarLayout} onChange={setCalendarLayout} />
          <CompletedToggle showCompleted={showCompleted} onChange={setShowCompleted} />
        </div>

        {tasksQuery.error && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
            Failed to load tasks:{" "}
            {tasksQuery.error instanceof Error
              ? tasksQuery.error.message
              : String(tasksQuery.error)}
          </div>
        )}

        {calendarLayout === "grid" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DayColumn
              variant="card"
              className="min-h-[180px] sm:col-span-2"
              date={windowDates[0]}
              isoDate={toISODate(windowDates[0])}
              isToday
              today={today}
              tasks={tasksByDate.get(toISODate(windowDates[0])) ?? []}
              events={eventsByDate.get(toISODate(windowDates[0])) ?? []}
              calendars={icsCalendars}
              showCompleted={showCompleted}
            />
            <DayColumn
              variant="card"
              className="min-h-[240px]"
              date={windowDates[1]}
              isoDate={toISODate(windowDates[1])}
              isToday={false}
              today={today}
              tasks={tasksByDate.get(toISODate(windowDates[1])) ?? []}
              events={eventsByDate.get(toISODate(windowDates[1])) ?? []}
              calendars={icsCalendars}
              showCompleted={showCompleted}
            />
            <SoonColumn
              variant="card"
              className="min-h-[240px]"
              tasks={soonQuery.data ?? []}
              today={today}
              showCompleted={showCompleted}
            />
          </div>
        ) : (
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
                  events={eventsByDate.get(iso) ?? []}
                  calendars={icsCalendars}
                  showCompleted={showCompleted}
                />
              );
            })}
            <SoonColumn
              tasks={soonQuery.data ?? []}
              today={today}
              showCompleted={showCompleted}
            />
          </div>
        )}

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
