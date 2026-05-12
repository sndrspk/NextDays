import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, supabaseConfigured } from "../lib/supabase";
import type { CustomListItem, UUID } from "../types";

const itemsKey = (listId: UUID) => ["custom_list_items", listId] as const;

export function useCustomListItems(listId: UUID | null) {
  return useQuery({
    enabled: supabaseConfigured && !!listId,
    queryKey: listId ? itemsKey(listId) : ["custom_list_items", "none"],
    queryFn: async (): Promise<CustomListItem[]> => {
      if (!listId) return [];
      const { data, error } = await supabase
        .from("custom_list_items")
        .select("*")
        .eq("list_id", listId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CustomListItem[];
    },
  });
}

interface CreateItemInput {
  list_id: UUID;
  title: string;
}

export function useCreateCustomListItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ list_id, title }: CreateItemInput): Promise<CustomListItem> => {
      const { data, error } = await supabase
        .from("custom_list_items")
        .insert({ list_id, title, sort_order: Math.floor(Date.now() / 1000) })
        .select()
        .single();
      if (error) throw error;
      return data as CustomListItem;
    },
    onSuccess: (data) =>
      qc.invalidateQueries({ queryKey: itemsKey(data.list_id) }),
  });
}

type ItemPatch = Partial<Pick<CustomListItem, "title" | "notes">>;

export function useUpdateCustomListItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: UUID;
      patch: ItemPatch;
    }): Promise<CustomListItem> => {
      const { data, error } = await supabase
        .from("custom_list_items")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as CustomListItem;
    },
    onSuccess: (data) =>
      qc.invalidateQueries({ queryKey: itemsKey(data.list_id) }),
  });
}

export function useToggleCustomListItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: CustomListItem): Promise<CustomListItem> => {
      const { data, error } = await supabase
        .from("custom_list_items")
        .update({ completed: !item.completed })
        .eq("id", item.id)
        .select()
        .single();
      if (error) throw error;
      return data as CustomListItem;
    },
    onSuccess: (data) =>
      qc.invalidateQueries({ queryKey: itemsKey(data.list_id) }),
  });
}

export function useDeleteCustomListItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: CustomListItem): Promise<CustomListItem> => {
      const { error } = await supabase
        .from("custom_list_items")
        .delete()
        .eq("id", item.id);
      if (error) throw error;
      return item;
    },
    onSuccess: (data) =>
      qc.invalidateQueries({ queryKey: itemsKey(data.list_id) }),
  });
}
