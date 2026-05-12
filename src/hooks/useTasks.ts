import { useQuery } from "@tanstack/react-query";
import { supabase, supabaseConfigured } from "../lib/supabase";
import type { ISODate, Task, UUID } from "../types";

export function useTasks(windowStart: ISODate, windowEndExclusive: ISODate) {
  return useQuery({
    enabled: supabaseConfigured,
    queryKey: ["tasks", windowStart, windowEndExclusive],
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .gte("scheduled_date", windowStart)
        .lt("scheduled_date", windowEndExclusive)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      // Hide tasks whose start_date is still in the future *relative to their
      // own scheduled_date* — i.e. the user's "delayed start" one-off case.
      // A row where start_date <= scheduled_date (always true for recurring
      // instances) belongs in its scheduled column even when that column is
      // a future day in the calendar window. PostgREST can't compare two
      // columns in a URL filter, so we filter here.
      return ((data ?? []) as Task[]).filter(
        (t) => !t.start_date || t.start_date <= t.scheduled_date,
      );
    },
  });
}

export function useTask(id: UUID | null) {
  return useQuery({
    enabled: supabaseConfigured && id !== null,
    queryKey: ["task", id],
    queryFn: async (): Promise<Task | null> => {
      if (!id) return null;
      const { data, error } = await supabase.from("tasks").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Task;
    },
  });
}
