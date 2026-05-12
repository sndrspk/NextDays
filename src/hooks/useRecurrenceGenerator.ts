import { useEffect, useRef } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { todayLocal, toISODate } from "../lib/dates";
import {
  applyOffset,
  horizonEnd,
  occurrencesBetween,
} from "../lib/recurrence";
import type { Task, TaskTemplate } from "../types";

// Walks every template, materialises any missing instances in [today, today+horizon].
// We never re-create instances for dates < today: if the user deleted yesterday's
// recurring task, it stays deleted. Edits to a template only affect instances
// generated from now on (existing rows are not touched).
export async function runRecurrenceGenerator(qc: QueryClient): Promise<void> {
  if (!supabaseConfigured) return;

  const today = toISODate(todayLocal());
  const horizon = horizonEnd(today);

  const { data: templates, error: tErr } = await supabase
    .from("task_templates")
    .select("*");
  if (tErr) {
    console.error("Recurrence templates fetch failed:", tErr);
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
    console.error("Recurrence existing-instances fetch failed:", eErr);
    return;
  }

  const existingByTemplate = new Map<string, Set<string>>();
  for (const row of (existing ?? []) as Pick<Task, "template_id" | "scheduled_date">[]) {
    if (!row.template_id) continue;
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
    let occurrences: string[];
    try {
      occurrences = occurrencesBetween(tpl.rrule, tpl.dtstart, today, horizon);
    } catch (err) {
      console.error(`Recurrence parse failed for template ${tpl.id}:`, err);
      continue;
    }
    const have = existingByTemplate.get(tpl.id) ?? new Set();
    for (const date of occurrences) {
      if (have.has(date)) continue;
      toInsert.push({
        title: tpl.title,
        notes: tpl.notes,
        project_id: tpl.project_id,
        tags: tpl.tags,
        scheduled_date: date,
        start_date: applyOffset(date, tpl.start_offset_days),
        due_date: applyOffset(date, tpl.due_offset_days),
        template_id: tpl.id,
        sort_order: baseSortOrder,
      });
    }
  }

  if (toInsert.length === 0) return;

  const { error: insErr } = await supabase.from("tasks").insert(toInsert);
  if (insErr) {
    console.error("Recurrence insert failed:", insErr);
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
