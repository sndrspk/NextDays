import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { ISODate, Task, UUID } from "../types";

interface MoveTaskInput {
  task: Task;
  targetDate: ISODate;
  windowStart: ISODate;
  windowEndExclusive: ISODate;
}

export function useMoveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ task, targetDate }: MoveTaskInput): Promise<Task> => {
      const patch: { scheduled_date: ISODate; start_date?: ISODate } = {
        scheduled_date: targetDate,
      };
      // If moving to an earlier date would hide the task (start_date > target),
      // pull start_date forward so it remains visible.
      if (task.start_date && task.start_date > targetDate) {
        patch.start_date = targetDate;
      }
      const { data, error } = await supabase
        .from("tasks")
        .update(patch)
        .eq("id", task.id)
        .select()
        .single();
      if (error) throw error;
      return data as Task;
    },

    onMutate: async ({ task, targetDate, windowStart, windowEndExclusive }) => {
      const queryKey = ["tasks", windowStart, windowEndExclusive];
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<Task[]>(queryKey);

      qc.setQueryData<Task[]>(queryKey, (old = []) =>
        old.map((t): Task => {
          if (t.id !== task.id) return t;
          return {
            ...t,
            scheduled_date: targetDate,
            start_date:
              t.start_date && t.start_date > targetDate ? targetDate : t.start_date,
          };
        }),
      );

      return { prev, queryKey };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData<Task[]>(ctx.queryKey as [string, UUID, UUID], ctx.prev);
      }
    },

    onSettled: (_data, _err, { windowStart, windowEndExclusive }) => {
      qc.invalidateQueries({ queryKey: ["tasks", windowStart, windowEndExclusive] });
    },
  });
}
