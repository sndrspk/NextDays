import { useQuery } from "@tanstack/react-query";
import { supabase, supabaseConfigured } from "../lib/supabase";
import type { Task } from "../types";

// PostgREST caps a single response (Supabase's default "Max rows" is 1000), so
// the whole table is walked in pages. Search has to see every task — silently
// stopping at the cap would make old tasks unfindable.
const PAGE_SIZE = 1000;

/**
 * Every task the user owns, for client-side search. RLS scopes the read.
 * Shares the ["tasks"] key prefix, so existing mutations invalidate it.
 */
export function useAllTasks(enabled = true) {
  return useQuery({
    enabled: supabaseConfigured && enabled,
    queryKey: ["tasks", "all"],
    queryFn: async (): Promise<Task[]> => {
      const all: Task[] = [];
      for (let page = 0; ; page += 1) {
        const from = page * PAGE_SIZE;
        const { data, error } = await supabase
          .from("tasks")
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        const rows = (data ?? []) as Task[];
        all.push(...rows);
        if (rows.length < PAGE_SIZE) break;
      }
      return all;
    },
  });
}
