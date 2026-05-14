import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, supabaseConfigured } from "../lib/supabase";
import type { IcsCalendarRow, UUID } from "../types";
import { clearCachedEvents } from "../lib/ics";

export function useIcsCalendars() {
  return useQuery({
    enabled: supabaseConfigured,
    queryKey: ["icsCalendars"],
    queryFn: async (): Promise<IcsCalendarRow[]> => {
      const { data, error } = await supabase
        .from("ics_calendars")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as IcsCalendarRow[];
    },
  });
}

interface CreateInput {
  url: string;
  name: string;
  colour: string;
}

export function useCreateIcsCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateInput): Promise<IcsCalendarRow> => {
      const { data, error } = await supabase
        .from("ics_calendars")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as IcsCalendarRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["icsCalendars"] }),
  });
}

export function useUpdateIcsCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: UUID;
      patch: Partial<Omit<IcsCalendarRow, "id" | "created_at">>;
    }): Promise<IcsCalendarRow> => {
      const { data, error } = await supabase
        .from("ics_calendars")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as IcsCalendarRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["icsCalendars"] }),
  });
}

export function useDeleteIcsCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: UUID): Promise<UUID> => {
      const { error } = await supabase.from("ics_calendars").delete().eq("id", id);
      if (error) throw error;
      clearCachedEvents(id);
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["icsCalendars"] }),
  });
}
