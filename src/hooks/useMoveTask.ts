import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { ISODate, Task, UUID } from "../types";

interface MoveTaskInput {
  task: Task;
  targetDate: ISODate | "soon";
  windowStart: ISODate;
  windowEndExclusive: ISODate;
}

export function useMoveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ task, targetDate }: MoveTaskInput): Promise<Task> => {
      if (targetDate === "soon") {
        const { data, error } = await supabase
          .from("tasks")
          .update({
            soon: true,
            scheduled_date: null,
            start_date: null,
            due_date: null,
          })
          .eq("id", task.id)
          .select()
          .single();
        if (error) throw error;
        return data as Task;
      }

      const patch: { scheduled_date: ISODate; start_date?: ISODate; soon: boolean } = {
        scheduled_date: targetDate,
        soon: false,
      };
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
      const calendarKey = ["tasks", windowStart, windowEndExclusive];
      const soonKey = ["tasks", "soon"];
      await qc.cancelQueries({ queryKey: calendarKey });
      await qc.cancelQueries({ queryKey: soonKey });
      const prevCalendar = qc.getQueryData<Task[]>(calendarKey);
      const prevSoon = qc.getQueryData<Task[]>(soonKey);

      if (targetDate === "soon") {
        qc.setQueryData<Task[]>(calendarKey, (old = []) =>
          old.filter((t) => t.id !== task.id),
        );
        qc.setQueryData<Task[]>(soonKey, (old = []) => [
          ...old,
          { ...task, soon: true, scheduled_date: null, start_date: null, due_date: null },
        ]);
      } else {
        qc.setQueryData<Task[]>(soonKey, (old = []) =>
          old.filter((t) => t.id !== task.id),
        );
        qc.setQueryData<Task[]>(calendarKey, (old = []) => {
          const without = old.filter((t) => t.id !== task.id);
          return [
            ...without,
            {
              ...task,
              soon: false,
              scheduled_date: targetDate,
              start_date:
                task.start_date && task.start_date > targetDate
                  ? targetDate
                  : task.start_date,
            },
          ];
        });
      }

      return { prevCalendar, prevSoon, calendarKey, soonKey };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prevCalendar !== undefined) {
        qc.setQueryData<Task[]>(ctx.calendarKey as [string, UUID, UUID], ctx.prevCalendar);
      }
      if (ctx?.prevSoon !== undefined) {
        qc.setQueryData<Task[]>(ctx.soonKey, ctx.prevSoon);
      }
    },

    onSettled: (_data, _err, { windowStart, windowEndExclusive }) => {
      qc.invalidateQueries({ queryKey: ["tasks", windowStart, windowEndExclusive] });
      qc.invalidateQueries({ queryKey: ["tasks", "soon"] });
    },
  });
}
