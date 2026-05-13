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
  NO_RECURRENCE,
  parseRRule,
  type RecurrenceEnds,
  type RecurrenceForm,
  type RecurrencePreset,
  type RecurrenceUnit,
} from "../../lib/recurrence";
import type { ISODate, Task } from "../../types";

const WEEKDAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function isoWeekday(iso: ISODate): string {
  const [y, m, d] = iso.split("-").map(Number);
  return WEEKDAYS_LONG[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function isoMonthDay(iso: ISODate): number {
  return Number(iso.split("-")[2]);
}

function formsEqual(a: RecurrenceForm, b: RecurrenceForm): boolean {
  if (a.preset !== b.preset) return false;
  if (a.preset === "custom") {
    if (a.interval !== b.interval || a.unit !== b.unit) return false;
  }
  if (a.ends.kind !== b.ends.kind) return false;
  if (a.ends.kind === "after" && b.ends.kind === "after" && a.ends.count !== b.ends.count)
    return false;
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

  // Initial forms, derived from the template (if any). Each side is "none"
  // when its rule is unset on the template.
  const { initialStart, initialDue } = useMemo(() => {
    return {
      initialStart:
        template?.start_rrule && template.start_dtstart
          ? parseRRule(template.start_rrule, template.start_dtstart)
          : NO_RECURRENCE,
      initialDue:
        template?.due_rrule && template.due_dtstart
          ? parseRRule(template.due_rrule, template.due_dtstart)
          : NO_RECURRENCE,
    };
  }, [template]);

  const [startForm, setStartForm] = useState<RecurrenceForm>(initialStart);
  const [dueForm, setDueForm] = useState<RecurrenceForm>(initialDue);

  // Reset on task change.
  useEffect(() => {
    setStartForm(initialStart);
    setDueForm(initialDue);
  }, [initialStart, initialDue]);

  const dirty =
    !formsEqual(startForm, initialStart) || !formsEqual(dueForm, initialDue);
  const startEnabled = startForm.preset !== "none";
  const dueEnabled = dueForm.preset !== "none";
  const startNeedsDate = startEnabled && !task.start_date;
  const dueNeedsDate = dueEnabled && !task.due_date;
  const canSave =
    (startEnabled || dueEnabled || (template !== null && !startEnabled && !dueEnabled)) &&
    !startNeedsDate &&
    !dueNeedsDate;

  const busy =
    createTemplate.isPending ||
    updateTemplate.isPending ||
    deleteTemplate.isPending ||
    updateTask.isPending;

  async function save() {
    // Both rules off → stop repeating.
    if (!startEnabled && !dueEnabled) {
      if (template) await deleteTemplate.mutateAsync(template.id);
      return;
    }

    const startRule = startEnabled && task.start_date
      ? buildRRule(startForm, task.start_date)
      : null;
    const dueRule = dueEnabled && task.due_date
      ? buildRRule(dueForm, task.due_date)
      : null;

    const patch = {
      start_rrule: startRule,
      start_dtstart: startEnabled ? task.start_date : null,
      due_rrule: dueRule,
      due_dtstart: dueEnabled ? task.due_date : null,
    };

    if (template) {
      await updateTemplate.mutateAsync({ id: template.id, patch });
    } else {
      const created = await createTemplate.mutateAsync({
        title: task.title,
        notes: task.notes,
        project_id: task.project_id,
        tags: task.tags,
        ...patch,
      });
      await updateTask.mutateAsync({ id: task.id, patch: { template_id: created.id } });
    }
    await runRecurrenceGenerator(qc);
  }

  return (
    <div className="mb-4">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
        Repeats
      </span>

      <RuleSection
        label="Start date"
        anchor={task.start_date}
        form={startForm}
        onChange={setStartForm}
        missingDateHint="Set a start date above to make it recur."
      />

      <div className="my-2.5 border-t border-slate-200/60" />

      <RuleSection
        label="Due date"
        anchor={task.due_date}
        form={dueForm}
        onChange={setDueForm}
        missingDateHint="Set a due date above to make it recur."
      />

      {(dirty || (template && !startEnabled && !dueEnabled)) && (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={busy || !canSave}
            className="focus-ring rounded-md bg-accent px-3 py-1 text-[12px] font-medium text-white transition hover:bg-accent-600 disabled:opacity-50"
          >
            {!startEnabled && !dueEnabled && template ? "Stop repeating" : "Save recurrence"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStartForm(initialStart);
              setDueForm(initialDue);
            }}
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

const selectClass =
  "focus-ring rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 text-[12px] text-stone-800 transition-colors duration-150 hover:border-slate-300 focus:border-accent/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";

interface RuleSectionProps {
  label: string;
  anchor: ISODate | null;
  form: RecurrenceForm;
  onChange: (next: RecurrenceForm) => void;
  missingDateHint: string;
}

function RuleSection({ label, anchor, form, onChange, missingDateHint }: RuleSectionProps) {
  const disabled = !anchor;
  const weekdayLabel = anchor ? isoWeekday(anchor) : "weekday";
  const monthDayLabel = anchor ? isoMonthDay(anchor) : 0;

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">
          {label}
        </span>
        {disabled && form.preset !== "none" && (
          <span className="text-[10px] text-red-500">{missingDateHint}</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={form.preset}
          disabled={disabled}
          onChange={(e) => onChange({ ...form, preset: e.target.value as RecurrencePreset })}
          className={selectClass + " cursor-pointer"}
        >
          <option value="none">Does not repeat</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly on {weekdayLabel}</option>
          <option value="monthly">Monthly on day {monthDayLabel || "—"}</option>
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
                onChange({ ...form, interval: Math.max(1, Number(e.target.value) || 1) })
              }
              className={selectClass + " w-16"}
            />
            <select
              value={form.unit}
              onChange={(e) => onChange({ ...form, unit: e.target.value as RecurrenceUnit })}
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
            disabled={disabled}
            onChange={(e) => {
              const kind = e.target.value as RecurrenceEnds["kind"];
              if (kind === "never") onChange({ ...form, ends: { kind: "never" } });
              else if (kind === "after") onChange({ ...form, ends: { kind: "after", count: 10 } });
              else onChange({ ...form, ends: { kind: "on", date: anchor ?? "" } });
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
                  onChange({ ...form, ends: { kind: "after", count: next } });
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
              onChange={(e) => onChange({ ...form, ends: { kind: "on", date: e.target.value } })}
              className={selectClass}
            />
          )}
        </div>
      )}
    </div>
  );
}
