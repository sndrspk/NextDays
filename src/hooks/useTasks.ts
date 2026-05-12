import { useQuery } from "@tanstack/react-query";
import { supabase, supabaseConfigured } from "../lib/supabase";
import type { ISODate, Task } from "../types";

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
        .or(`start_date.is.null,start_date.lte.${windowStart}`)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });
}
