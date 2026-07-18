import { useQuery } from "@tanstack/react-query";
import { supabase, supabaseConfigured } from "../lib/supabase";
import type { Task } from "../types";

export function useTaggedTasks(tag: string) {
  return useQuery({
    enabled: supabaseConfigured && tag.length > 0,
    queryKey: ["tasks", "tag", tag],
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .contains("tags", [tag])
        .order("completed", { ascending: true })
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });
}
