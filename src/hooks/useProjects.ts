import { useQuery } from "@tanstack/react-query";
import { supabase, supabaseConfigured } from "../lib/supabase";
import type { Project } from "../types";

export function useProjects() {
  return useQuery({
    enabled: supabaseConfigured,
    queryKey: ["projects"],
    queryFn: async (): Promise<Project[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Project[];
    },
  });
}
