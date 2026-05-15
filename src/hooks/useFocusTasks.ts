import { useQuery } from "@tanstack/react-query";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { todayLocal, toISODate } from "../lib/dates";
import type { ISODate, Task } from "../types";

// Everything that should land in the Focus view: tasks scheduled for today
// plus anything overdue (in case rollover hasn't caught up yet). Completed
// tasks are included so the view can toggle them on/off client-side; the
// FocusView hides them by default. Excludes "delayed start" rows — same rule
// as the calendar.
export function useFocusTasks() {
  const today = toISODate(todayLocal());
  return useQuery({
    enabled: supabaseConfigured,
    queryKey: ["tasks", "focus", today],
    queryFn: async (): Promise<{ today: ISODate; tasks: Task[] }> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .or(`scheduled_date.eq.${today},due_date.lte.${today}`)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const filtered = ((data ?? []) as Task[]).filter(
        (t) => !t.start_date || t.start_date <= t.scheduled_date,
      );
      return { today, tasks: filtered };
    },
  });
}
