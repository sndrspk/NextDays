import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { ISODate, Task, UUID } from "../types";

type TaskUpdate = Partial<
  Pick<Task, "title" | "notes" | "scheduled_date" | "start_date" | "due_date" | "project_id" | "tags">
>;

interface CreateTaskInput {
  title: string;
  scheduled_date: ISODate;
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ title, scheduled_date }: CreateTaskInput): Promise<Task> => {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title,
          scheduled_date,
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
