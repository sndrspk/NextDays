import { useQuery } from "@tanstack/react-query";
import { supabase, supabaseConfigured } from "../lib/supabase";
import type { Task, UUID } from "../types";

export function useProjectTasks(projectId: UUID | null) {
  return useQuery({
    enabled: supabaseConfigured && projectId !== null,
    queryKey: ["tasks", "by-project", projectId],
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("completed", { ascending: true })
        .order("scheduled_date", { ascending: true })
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });
}
