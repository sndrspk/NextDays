import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { ISODate, Task } from "../types";

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
          sort_order: Date.now(),
        })
        .select()
        .single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
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
