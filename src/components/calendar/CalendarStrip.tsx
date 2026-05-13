import { useMemo } from "react";
import { useDayCount } from "../../hooks/useDayCount";
import { useTasks } from "../../hooks/useTasks";
import { addDays, buildDayWindow, todayLocal, toISODate } from "../../lib/dates";
import type { Task } from "../../types";
import DayColumn from "./DayColumn";

export default function CalendarStrip() {
  const dayCount = useDayCount();

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

  return (
    <div className="flex flex-col">
      {tasksQuery.error && (
        <div className="mb-3 rounded-xl border border-red-200/70 bg-red-50/80 px-4 py-2.5 text-xs text-red-700 shadow-card backdrop-blur">
          Failed to load tasks:{" "}
          {tasksQuery.error instanceof Error
            ? tasksQuery.error.message
            : String(tasksQuery.error)}
        </div>
      )}

      <div className="flex flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-elevated sm:min-h-[70vh] sm:flex-row">
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
  );
}
