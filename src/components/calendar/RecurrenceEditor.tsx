import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateTaskTemplate,
  useDeleteTaskTemplate,
  useTaskTemplates,
  useUpdateTaskTemplate,
} from "../../hooks/useTaskTemplates";
import { useUpdateTask } from "../../hooks/useTaskMutations";
import { runRecurrenceGenerator } from "../../hooks/useRecurrenceGenerator";
import {
  buildRRule,
  daysBetween,
  NO_RECURRENCE,
  parseRRule,
  type RecurrenceEnds,
  type RecurrenceForm,
  type RecurrencePreset,
  type RecurrenceUnit,
} from "../../lib/recurrence";
import type { Task } from "../../types";

const WEEKDAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function isoWeekday(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return WEEKDAYS_LONG[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function isoMonthDay(iso: string): number {
  return Number(iso.split("-")[2]);
}

function formsEqual(a: RecurrenceForm, b: RecurrenceForm): boolean {
  if (a.preset !== b.preset) return false;
  if (a.preset === "custom") {
    if (a.interval !== b.interval || a.unit !== b.unit) return false;
  }
  if (a.ends.kind !== b.ends.kind) return false;
  if (a.ends.kind === "after" && b.ends.kind === "after" && a.ends.count !== b.ends.count) return false;
  if (a.ends.kind === "on" && b.ends.kind === "on" && a.ends.date !== b.ends.date) return false;
  return true;
}

interface RecurrenceEditorProps {
  task: Task;
}

export default function RecurrenceEditor({ task }: RecurrenceEditorProps) {
  const qc = useQueryClient();
  const templatesQuery = useTaskTemplates();
  const createTemplate = useCreateTaskTemplate();
  const updateTemplate = useUpdateTaskTemplate();
  const deleteTemplate = useDeleteTaskTemplate();
  const updateTask = useUpdateTask();

  const template = useMemo(
    () => templatesQuery.data?.find((t) => t.id === task.template_id) ?? null,
    [templatesQuery.data, task.template_id],
  );

  const initialForm: RecurrenceForm = useMemo(() => {
    if (!template) return NO_RECURRENCE;
    return parseRRule(template.rrule, template.dtstart);
  }, [template]);

  const [form, setForm] = useState<RecurrenceForm>(initialForm);
  // Reset when the task changes (panel reopens with a different task).
  useEffect(() => setForm(initialForm), [initialForm]);

  const dirty = !formsEqual(form, initialForm);
  const busy =
    createTemplate.isPending ||
    updateTemplate.isPending ||
    deleteTemplate.isPending ||
    updateTask.isPending;

  async function save() {
    if (form.preset === "none") {
      if (template) {
        await deleteTemplate.mutateAsync(template.id);
      }
      return;
    }

    const dtstart = task.scheduled_date;
    const rrule = buildRRule(form, dtstart);
    const start_offset_days = daysBetween(task.start_date, dtstart);
    const due_offset_days = daysBetween(task.due_date, dtstart);

    if (template) {
      await updateTemplate.mutateAsync({
        id: template.id,
        patch: { rrule, dtstart, start_offset_days, due_offset_days },
      });
    } else {
      const created = await createTemplate.mutateAsync({
        title: task.title,
        notes: task.notes,
        project_id: task.project_id,
        tags: task.tags,
        rrule,
        dtstart,
        start_offset_days,
        due_offset_days,
      });
      await updateTask.mutateAsync({ id: task.id, patch: { template_id: created.id } });
    }
    await runRecurrenceGenerator(qc);
  }

  const selectClass =
    "focus-ring rounded-lg border border-black/[0.07] bg-white/80 px-2.5 py-1.5 text-[12px] text-stone-800 transition-colors duration-150 hover:border-black/[0.12] focus:border-accent/50 focus:outline-none";

  const weekdayLabel = isoWeekday(task.scheduled_date);
  const monthDayLabel = isoMonthDay(task.scheduled_date);

  return (
    <div className="mb-4">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
        Repeats
      </span>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={form.preset}
          onChange={(e) => setForm({ ...form, preset: e.target.value as RecurrencePreset })}
          className={selectClass + " cursor-pointer"}
        >
          <option value="none">Does not repeat</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly on {weekdayLabel}</option>
          <option value="monthly">Monthly on day {monthDayLabel}</option>
          <option value="custom">Custom…</option>
        </select>

        {form.preset === "custom" && (
          <>
            <span className="text-[12px] text-stone-500">every</span>
            <input
              type="number"
              min={1}
              value={form.interval}
              onChange={(e) =>
                setForm({ ...form, interval: Math.max(1, Number(e.target.value) || 1) })
              }
              className={selectClass + " w-16"}
            />
            <select
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value as RecurrenceUnit })}
              className={selectClass + " cursor-pointer"}
            >
              <option value="day">day(s)</option>
              <option value="week">week(s)</option>
              <option value="month">month(s)</option>
            </select>
          </>
        )}
      </div>

      {form.preset !== "none" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.14em] text-stone-400">Ends</span>
          <select
            value={form.ends.kind}
            onChange={(e) => {
              const kind = e.target.value as RecurrenceEnds["kind"];
              if (kind === "never") setForm({ ...form, ends: { kind: "never" } });
              else if (kind === "after")
                setForm({ ...form, ends: { kind: "after", count: 10 } });
              else setForm({ ...form, ends: { kind: "on", date: task.scheduled_date } });
            }}
            className={selectClass + " cursor-pointer"}
          >
            <option value="never">Never</option>
            <option value="after">After…</option>
            <option value="on">On date</option>
          </select>

          {form.ends.kind === "after" && (
            <>
              <input
                type="number"
                min={1}
                value={form.ends.count}
                onChange={(e) => {
                  const next = Math.max(1, Number(e.target.value) || 1);
                  setForm({ ...form, ends: { kind: "after", count: next } });
                }}
                className={selectClass + " w-16"}
              />
              <span className="text-[12px] text-stone-500">occurrences</span>
            </>
          )}
          {form.ends.kind === "on" && (
            <input
              type="date"
              value={form.ends.date}
              onChange={(e) =>
                setForm({ ...form, ends: { kind: "on", date: e.target.value } })
              }
              className={selectClass}
            />
          )}
        </div>
      )}

      {(dirty || (template && form.preset === "none")) && (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="focus-ring rounded-md bg-accent px-3 py-1 text-[12px] font-medium text-white shadow-card transition hover:bg-accent/90 disabled:opacity-50"
          >
            {form.preset === "none" && template ? "Stop repeating" : "Save recurrence"}
          </button>
          <button
            type="button"
            onClick={() => setForm(initialForm)}
            disabled={busy}
            className="focus-ring rounded-md px-2 py-1 text-[12px] text-stone-500 transition hover:text-stone-800 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
