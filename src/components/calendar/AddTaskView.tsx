import { useEffect, useRef, useState } from "react";
import { useProjects } from "../../hooks/useProjects";
import { useCreateTask } from "../../hooks/useTaskMutations";
import { toISODate, todayLocal } from "../../lib/dates";
import { useView } from "../../state/view";
import type { ISODate, UUID } from "../../types";

interface CarryFields {
  scheduledDate: ISODate;
  startDate: string;
  dueDate: string;
  projectId: UUID | "";
  tags: string;
  notes: string;
  soon: boolean;
}

function parseTagsInput(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export default function AddTaskView() {
  const { setView } = useView();
  const projectsQuery = useProjects();
  const create = useCreateTask();
  const titleRef = useRef<HTMLInputElement>(null);

  const today = toISODate(todayLocal());

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [scheduledDate, setScheduledDate] = useState<ISODate>(today);
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [projectId, setProjectId] = useState<UUID | "">("");
  const [tags, setTags] = useState("");
  const [soon, setSoon] = useState(false);
  const [carryFields, setCarryFields] = useState(false);
  const [carry, setCarry] = useState<CarryFields | null>(null);

  useEffect(() => {
    if (!carry) return;
    setScheduledDate(carry.scheduledDate);
    setStartDate(carry.startDate);
    setDueDate(carry.dueDate);
    setProjectId(carry.projectId);
    setTags(carry.tags);
    setNotes(carry.notes);
    setSoon(carry.soon);
  }, [carry]);

  useEffect(() => {
    titleRef.current?.focus();
  }, [carry]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setView({ kind: "calendar" });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setView]);

  function reset(keepCarry: boolean) {
    setTitle("");
    if (!keepCarry) {
      setNotes("");
      setScheduledDate(today);
      setStartDate("");
      setDueDate("");
      setProjectId("");
      setTags("");
      setSoon(false);
    }
  }

  function submit() {
    const trimmed = title.trim();
    if (!trimmed || create.isPending) return;
    if (!soon && !scheduledDate) return;

    const parsedTags = parseTagsInput(tags);

    create.mutate(
      {
        title: trimmed,
        scheduled_date: soon ? null : scheduledDate,
        project_id: projectId === "" ? null : projectId,
        tags: parsedTags,
        notes: notes.trim() === "" ? null : notes,
        start_date: soon ? null : (startDate === "" ? null : startDate),
        due_date: soon ? null : (dueDate === "" ? null : dueDate),
        soon,
      },
      {
        onSuccess: () => {
          if (carryFields) {
            setCarry({
              scheduledDate,
              startDate,
              dueDate,
              projectId,
              tags,
              notes,
              soon,
            });
            reset(true);
          } else {
            setView({ kind: "calendar" });
          }
        },
      },
    );
  }

  const inputClass =
    "focus-ring w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-[13px] text-stone-800 placeholder:text-stone-300 transition-colors duration-150 hover:border-slate-300 focus:border-accent/60 focus:outline-none";
  const disabledInputClass =
    "w-full rounded-lg border border-slate-200/60 bg-slate-50 px-3 py-2 text-[13px] text-stone-400 cursor-not-allowed";

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex h-full max-w-3xl flex-col px-4 py-5 sm:px-8 sm:py-8 lg:px-10">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-stone-900 sm:text-[26px]">
              Add task
            </h1>
            <p className="mt-0.5 text-[12px] text-stone-500">
              Fill the fields and save. Tick the carry box to keep them for the next one.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setView({ kind: "calendar" })}
            aria-label="Close"
            className="focus-ring rounded-md p-1.5 text-stone-400 transition-colors hover:bg-slate-100 hover:text-stone-700"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex flex-1 flex-col"
        >
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled task"
            className="focus-ring mb-5 w-full bg-transparent text-[22px] font-semibold leading-tight tracking-tight text-stone-900 placeholder:text-stone-300 focus:outline-none"
          />

          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Add notes…"
              className={inputClass + " resize-y leading-relaxed"}
            />
          </Field>

          <label className="mb-5 flex cursor-pointer items-center gap-2.5">
            <span
              role="switch"
              aria-checked={soon}
              tabIndex={0}
              onClick={() => setSoon(!soon)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSoon(!soon);
                }
              }}
              className={`relative inline-flex h-5 w-9 flex-none items-center rounded-full transition-colors duration-150 ${
                soon ? "bg-accent" : "bg-slate-200"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                  soon ? "translate-x-[18px]" : "translate-x-[3px]"
                }`}
              />
            </span>
            <span className="text-[13px] font-medium text-stone-700">Soon</span>
            <span className="text-[11px] text-stone-400">No dates — just on the radar</span>
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Scheduled date">
              <input
                type="date"
                value={soon ? "" : scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                required={!soon}
                disabled={soon}
                className={soon ? disabledInputClass : inputClass}
              />
            </Field>
            <Field label="Start date">
              <input
                type="date"
                value={soon ? "" : startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={soon}
                className={soon ? disabledInputClass : inputClass}
              />
            </Field>
            <Field label="Due date">
              <input
                type="date"
                value={soon ? "" : dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={soon}
                className={soon ? disabledInputClass : inputClass}
              />
            </Field>
          </div>

          <Field label="Project">
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value as UUID | "")}
              className={inputClass + " cursor-pointer"}
            >
              <option value="">— No project —</option>
              {projectsQuery.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Tags">
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="comma, separated, tags"
              className={inputClass}
            />
          </Field>

          <label className="mt-2 mb-6 inline-flex cursor-pointer items-center gap-2 text-[13px] text-stone-700">
            <input
              type="checkbox"
              checked={carryFields}
              onChange={(e) => setCarryFields(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-slate-300 text-accent focus:ring-accent"
            />
            Save fields for next task
          </label>

          {create.error && (
            <p className="mb-3 text-[12px] text-red-600">
              Failed: {create.error instanceof Error ? create.error.message : String(create.error)}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200/70 pt-4">
            <button
              type="button"
              onClick={() => setView({ kind: "calendar" })}
              className="focus-ring rounded-md px-3 py-1.5 text-[13px] text-stone-600 transition-colors hover:bg-slate-100 hover:text-stone-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending || !title.trim()}
              className="focus-ring rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-accent-600 disabled:opacity-50"
            >
              {create.isPending ? "Saving…" : carryFields ? "Save and add another" : "Save task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
        {label}
      </span>
      {children}
    </label>
  );
}
