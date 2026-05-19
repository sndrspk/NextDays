import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { todayLocal, toISODate, addDays } from "../lib/dates";
import type { Project, Task } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the ISO date a task should roll to.
 *  - Personal tasks (no project, or project.is_personal) → today
 *  - Work tasks on a weekend → next Monday
 *  - Work tasks on a weekday → today
 */
function targetDate(
  task: Task,
  projectById: Map<string, Project>,
  today: Date,
  todayDow: number,
): string {
  const isWeekend = todayDow === 0 || todayDow === 6;

  if (!task.project_id) return toISODate(today);
  const project = projectById.get(task.project_id);
  if (!project || project.is_personal) return toISODate(today);

  // Work task on a weekend → roll to next Monday
  if (isWeekend) {
    const daysUntilMonday = todayDow === 6 ? 2 : 1; // Sat → +2, Sun → +1
    return toISODate(addDays(today, daysUntilMonday));
  }

  return toISODate(today);
}

// ---------------------------------------------------------------------------
// Core rollover logic — exported so SettingsView can call it manually
// ---------------------------------------------------------------------------

export async function runRollover(qc: ReturnType<typeof import("@tanstack/react-query").useQueryClient>): Promise<{ rolled: number; error: string | null }> {
  if (!supabaseConfigured) return { rolled: 0, error: "Supabase not configured" };

  const today = todayLocal();
  const todayISO = toISODate(today);

  // Fetch all uncompleted tasks with a scheduled_date in the past
  const {  stale, error: fetchErr } = await supabase
    .from("tasks")
    .select("*")
    .eq("completed", false)
    .lt("scheduled_date", todayISO);

  if (fetchErr) {
    console.error("Rollover fetch failed:", fetchErr);
    return { rolled: 0, error: fetchErr.message };
  }
  if (!stale || stale.length === 0) return { rolled: 0, error: null };

  // Fetch relevant projects
  const projectIds = Array.from(
    new Set(stale.map((t) => t.project_id).filter((id): id is string => Boolean(id))),
  );
  const projectById = new Map<string, Project>();
  if (projectIds.length > 0) {
    const {  projects, error: projErr } = await supabase
      .from("projects")
      .select("*")
      .in("id", projectIds);
    if (projErr) {
      console.error("Rollover projects fetch failed:", projErr);
      return { rolled: 0, error: projErr.message };
    }
    for (const p of projects ?? []) projectById.set(p.id, p as Project);
  }

  const todayDow = today.getDay();

  // Build a map of id → target date (only tasks that actually need to move)
  const updates: { id: string; scheduled_date: string }[] = (stale as Task[])
    .map((t) => ({
      id: t.id,
      scheduled_date: targetDate(t, projectById, today, todayDow),
    }))
    // Only include tasks whose target date differs from their current scheduled_date
    .filter((u) => u.scheduled_date !== (stale as Task[]).find((t) => t.id === u.id)!.scheduled_date);

  if (updates.length === 0) return { rolled: 0, error: null };

  // Group by target date for efficient batch updates
  const byTarget = updates.reduce<Record<string, string[]>>((acc, u) => {
    (acc[u.scheduled_date] ??= []).push(u.id);
    return acc;
  }, {});

  for (const [targetISO, ids] of Object.entries(byTarget)) {
    const { error: updateErr } = await supabase
      .from("tasks")
      .update({ scheduled_date: targetISO })
      .in("id", ids);
    if (updateErr) {
      console.error("Rollover update failed:", updateErr);
      return { rolled: 0, error: updateErr.message };
    }
  }

  qc.invalidateQueries({ queryKey: ["tasks"] });
  return { rolled: updates.length, error: null };
}

// ---------------------------------------------------------------------------
// Hook — runs automatically on mount and whenever midnight ticks over
// ---------------------------------------------------------------------------

export function useRollover() {
  const qc = useQueryClient();
  // Track the last date we ran rollover (in-memory; resets on full page load)
  const lastRanDateRef = useRef<string | null>(null);

  const maybeRun = useCallback(async () => {
    const todayISO = toISODate(todayLocal());
    if (lastRanDateRef.current === todayISO) return; // already ran today
    lastRanDateRef.current = todayISO;
    await runRollover(qc);
  }, [qc]);

  // Run once on mount (handles the initial load and day-already-changed case)
  useEffect(() => {
    maybeRun();
  }, [maybeRun]);

  // Set up a timer to fire just after the next midnight so long-running
  // sessions automatically roll over without requiring a page refresh.
  useEffect(() => {
    function scheduleNextMidnight() {
      const now = new Date();
      const tomorrow = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0, 0, 5, // 5 seconds after midnight to be safe
      );
      const msUntilMidnight = tomorrow.getTime() - now.getTime();

      const id = setTimeout(async () => {
        await maybeRun();
        scheduleNextMidnight(); // reschedule for the following midnight
      }, msUntilMidnight);

      return id;
    }

    const timerId = scheduleNextMidnight();
    return () => clearTimeout(timerId);
  }, [maybeRun]);
}

// ---------------------------------------------------------------------------
// Convenience hook for the manual button in Settings
// ---------------------------------------------------------------------------

export function useManualRollover() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [count, setCount] = useState(0);

  const trigger = useCallback(async () => {
    setStatus("running");
    const { rolled, error } = await runRollover(qc);
    if (error) {
      setStatus("error");
    } else {
      setCount(rolled);
      setStatus("done");
    }
    // Reset back to idle after 4 seconds
    setTimeout(() => setStatus("idle"), 4000);
  }, [qc]);

  return { trigger, status, count };
}
