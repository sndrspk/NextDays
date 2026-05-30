import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { ISODate, Task, UUID } from "../types";

type TaskUpdate = Partial<
  Pick<
    Task,
    | "title"
    | "notes"
    | "scheduled_date"
    | "start_date"
    | "due_date"
    | "project_id"
    | "tags"
    | "template_id"
  >
>;

interface CreateTaskInput {
  title: string;
  scheduled_date: ISODate;
  project_id?: UUID | null;
  tags?: string[];
  notes?: string | null;
  start_date?: ISODate | null;
  due_date?: ISODate | null;
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      title,
      scheduled_date,
      project_id,
      tags,
      notes,
      start_date,
      due_date,
    }: CreateTaskInput): Promise<Task> => {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title,
          scheduled_date,
          project_id: project_id ?? null,
          tags: tags && tags.length > 0 ? tags : [],
          notes: notes ?? null,
          start_date: start_date ?? null,
          due_date: due_date ?? null,
          sort_order: Math.floor(Date.now() / 1000),
        })
        .select()
        .single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: UUID; patch: TaskUpdate }): Promise<Task> => {
      const { data, error } = await supabase
        .from("tasks")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["task", data.id] });
    },
  });
}

export function useToggleTaskCompleted() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: Task): Promise<Task> => {
      const nextCompleted = !task.completed;
      const { data, error } = await supabase
        .from("tasks")
        .update({
          completed: nextCompleted,
          completed_at: nextCompleted ? new Date().toISOString() : null,
        })
        .eq("id", task.id)
        .select()
        .single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: UUID) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useBulkCompleteTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, completed }: { ids: UUID[]; completed: boolean }) => {
      if (ids.length === 0) return;
      const { error } = await supabase
        .from("tasks")
        .update({
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useBulkDeleteTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: UUID[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase.from("tasks").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}
