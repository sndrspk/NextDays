import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, supabaseConfigured } from "../lib/supabase";
import type { ISODate, TaskTemplate, UUID } from "../types";

export function useTaskTemplates() {
  return useQuery({
    enabled: supabaseConfigured,
    queryKey: ["task_templates"],
    queryFn: async (): Promise<TaskTemplate[]> => {
      const { data, error } = await supabase.from("task_templates").select("*");
      if (error) throw error;
      return (data ?? []) as TaskTemplate[];
    },
  });
}

export interface NewTemplate {
  title: string;
  notes: string | null;
  project_id: UUID | null;
  tags: string[];
  start_rrule: string | null;
  start_dtstart: ISODate | null;
  due_rrule: string | null;
  due_dtstart: ISODate | null;
}

export function useCreateTaskTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewTemplate): Promise<TaskTemplate> => {
      const { data, error } = await supabase
        .from("task_templates")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as TaskTemplate;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task_templates"] }),
  });
}

export function useUpdateTaskTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: UUID;
      patch: Partial<NewTemplate>;
    }): Promise<TaskTemplate> => {
      const { data, error } = await supabase
        .from("task_templates")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as TaskTemplate;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task_templates"] }),
  });
}

interface DeleteTemplateInput {
  id: UUID;
  // When set, delete every uncompleted task tied to this template whose
  // scheduled_date is strictly after this cutoff (today's ISO date in
  // practice). The caller's current instance — scheduled today or earlier —
  // is preserved; only future materialised occurrences are removed.
  deleteFutureAfter?: ISODate;
}

export function useDeleteTaskTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, deleteFutureAfter }: DeleteTemplateInput) => {
      if (deleteFutureAfter) {
        const { error: delErr } = await supabase
          .from("tasks")
          .delete()
          .eq("template_id", id)
          .eq("completed", false)
          .gt("scheduled_date", deleteFutureAfter);
        if (delErr) throw delErr;
      }
      const { error } = await supabase.from("task_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task_templates"] });
      // Existing past/today instances had template_id null'd by the FK;
      // future ones may have been deleted. Refresh task views either way.
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
