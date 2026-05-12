import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, supabaseConfigured } from "../lib/supabase";
import type { CustomList, UUID } from "../types";

const LISTS_KEY = ["custom_lists"] as const;

export function useCustomLists() {
  return useQuery({
    enabled: supabaseConfigured,
    queryKey: LISTS_KEY,
    queryFn: async (): Promise<CustomList[]> => {
      const { data, error } = await supabase
        .from("custom_lists")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CustomList[];
    },
  });
}

export function useCreateCustomList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string): Promise<CustomList> => {
      const { data, error } = await supabase
        .from("custom_lists")
        .insert({ name, sort_order: Math.floor(Date.now() / 1000) })
        .select()
        .single();
      if (error) throw error;
      return data as CustomList;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: LISTS_KEY }),
  });
}

export function useUpdateCustomList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: UUID; name: string }): Promise<CustomList> => {
      const { data, error } = await supabase
        .from("custom_lists")
        .update({ name })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as CustomList;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: LISTS_KEY }),
  });
}

export function useDeleteCustomList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: UUID): Promise<UUID> => {
      const { error } = await supabase.from("custom_lists").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: LISTS_KEY }),
  });
}
