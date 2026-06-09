import { useQuery } from "@tanstack/react-query";
import { supabase, supabaseConfigured } from "../lib/supabase";
import type { Task } from "../types";

export function useSoonTasks() {
  return useQuery({
    enabled: supabaseConfigured,
    queryKey: ["tasks", "soon"],
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("soon", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });
}
