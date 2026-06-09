import { useEffect, useRef } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { devError } from "../lib/log";
import { todayLocal, toISODate } from "../lib/dates";
import {
  horizonEnd,
  nextOccurrenceOnOrAfter,
  occurrencesBetween,
} from "../lib/recurrence";
import type { ISODate, Task, TaskTemplate } from "../types";

// Pairing model (chosen with the user):
//   * If start_rrule is set, every start_rrule occurrence in [today, horizon]
//     spawns one instance. scheduled_date = start_date = the occurrence.
//     due_date = next occurrence of due_rrule on or after start_date (or null
//     if due_rrule is unset).
//   * Otherwise due_rrule drives. scheduled_date = due_date = the occurrence;
//     start_date stays null.
//
// Instances are deduped by (template_id, scheduled_date) — same key as the
// previous version, so rolled-forward instances aren't re-created.
export async function runRecurrenceGenerator(qc: QueryClient): Promise<void> {
  if (!supabaseConfigured) return;

  const today = toISODate(todayLocal());
  const horizon = horizonEnd(today);

  const { data: templates, error: tErr } = await supabase
    .from("task_templates")
    .select("*");
  if (tErr) {
    devError("Recurrence templates fetch failed:", tErr);
    return;
  }
  if (!templates || templates.length === 0) return;

  const templateIds = templates.map((t) => t.id);
  const { data: existing, error: eErr } = await supabase
    .from("tasks")
    .select("template_id, scheduled_date")
    .in("template_id", templateIds)
    .gte("scheduled_date", today)
    .lte("scheduled_date", horizon);
  if (eErr) {
    devError("Recurrence existing-instances fetch failed:", eErr);
    return;
  }

  const existingByTemplate = new Map<string, Set<string>>();
  for (const row of (existing ?? []) as Pick<Task, "template_id" | "scheduled_date">[]) {
    if (!row.template_id || !row.scheduled_date) continue;
    const set = existingByTemplate.get(row.template_id) ?? new Set();
    set.add(row.scheduled_date);
    existingByTemplate.set(row.template_id, set);
  }

  const toInsert: Array<{
    title: string;
    notes: string | null;
    project_id: string | null;
    tags: string[];
    scheduled_date: string;
    start_date: string | null;
    due_date: string | null;
    template_id: string;
    sort_order: number;
  }> = [];

  const baseSortOrder = Math.floor(Date.now() / 1000);

  for (const tpl of templates as TaskTemplate[]) {
    let occurrences: ISODate[] = [];
    let driverIsStart = false;
    try {
      if (tpl.start_rrule && tpl.start_dtstart) {
        occurrences = occurrencesBetween(tpl.start_rrule, tpl.start_dtstart, today, horizon);
        driverIsStart = true;
      } else if (tpl.due_rrule && tpl.due_dtstart) {
        occurrences = occurrencesBetween(tpl.due_rrule, tpl.due_dtstart, today, horizon);
      } else {
        // Malformed template (CHECK constraint should prevent this) — skip.
        continue;
      }
    } catch (err) {
      devError(`Recurrence parse failed for template ${tpl.id}:`, err);
      continue;
    }

    const have = existingByTemplate.get(tpl.id) ?? new Set();
    for (const date of occurrences) {
      if (have.has(date)) continue;

      let start_date: ISODate | null = null;
      let due_date: ISODate | null = null;
      const scheduled_date = date;

      if (driverIsStart) {
        start_date = date;
        if (tpl.due_rrule && tpl.due_dtstart) {
          due_date = nextOccurrenceOnOrAfter(tpl.due_rrule, tpl.due_dtstart, date);
        }
      } else {
        due_date = date;
      }

      toInsert.push({
        title: tpl.title,
        notes: tpl.notes,
        project_id: tpl.project_id,
        tags: tpl.tags,
        scheduled_date,
        start_date,
        due_date,
        template_id: tpl.id,
        sort_order: baseSortOrder,
      });
    }
  }

  if (toInsert.length === 0) return;

  const { error: insErr } = await supabase.from("tasks").insert(toInsert);
  if (insErr) {
    devError("Recurrence insert failed:", insErr);
    return;
  }

  qc.invalidateQueries({ queryKey: ["tasks"] });
}

// Once-per-mount runner. The TaskDetailPanel triggers an additional run after
// the user changes a recurrence so new instances appear immediately.
export function useRecurrenceGenerator() {
  const qc = useQueryClient();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    void runRecurrenceGenerator(qc);
  }, [qc]);
}
