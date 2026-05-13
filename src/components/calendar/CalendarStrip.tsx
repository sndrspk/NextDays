import { useMemo } from "react";
import { useDayCount } from "../../hooks/useDayCount";
import { useTasks } from "../../hooks/useTasks";
import { addDays, buildDayWindow, todayLocal, toISODate } from "../../lib/dates";
import {
  DESKTOP_DAY_COUNT_OPTIONS,
  useSettings,
  type DesktopDayCount,
} from "../../state/settings";
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
