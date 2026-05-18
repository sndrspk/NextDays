import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { devError } from "../lib/log";
import { todayLocal, toISODate } from "../lib/dates";
import type { Project, Task } from "../types";

function shouldRollToday(task: Task, projectById: Map<string, Project>, todayDow: number): boolean {
  if (task.completed) return false;
  if (!task.project_id) return true;
  const project = projectById.get(task.project_id);
  if (!project || project.is_personal) return true;
  const isWeekend = todayDow === 0 || todayDow === 6;
  return !isWeekend;
}

export function useRollover() {
  const qc = useQueryClient();
  const ranRef = useRef(false);

  useEffect(() => {
    if (!supabaseConfigured || ranRef.current) return;
    ranRef.current = true;

    (async () => {
      const today = todayLocal();
      const todayISO = toISODate(today);

      const { data: stale, error: fetchErr } = await supabase
        .from("tasks")
        .select("*")
        .eq("completed", false)
        .lt("scheduled_date", todayISO);
      if (fetchErr) {
        devError("Rollover fetch failed:", fetchErr);
        return;
      }
      if (!stale || stale.length === 0) return;

      const projectIds = Array.from(
        new Set(stale.map((t) => t.project_id).filter((id): id is string => Boolean(id))),
      );

      const projectById = new Map<string, Project>();
      if (projectIds.length > 0) {
        const { data: projects, error: projErr } = await supabase
          .from("projects")
          .select("*")
          .in("id", projectIds);
        if (projErr) {
          devError("Rollover projects fetch failed:", projErr);
          return;
        }
        for (const p of projects ?? []) projectById.set(p.id, p as Project);
      }

      const todayDow = today.getDay();
      const idsToRoll = (stale as Task[])
        .filter((t) => shouldRollToday(t, projectById, todayDow))
        .map((t) => t.id);

      if (idsToRoll.length === 0) return;

      const { error: updateErr } = await supabase
        .from("tasks")
        .update({ scheduled_date: todayISO })
        .in("id", idsToRoll);
      if (updateErr) {
        devError("Rollover update failed:", updateErr);
        return;
      }

      qc.invalidateQueries({ queryKey: ["tasks"] });
    })();
  }, [qc]);
}
