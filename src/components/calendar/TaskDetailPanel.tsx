import { useEffect, useState } from "react";
import type { Task } from "../../types";
import { useTask } from "../../hooks/useTasks";
import { useProjects } from "../../hooks/useProjects";
import { useDeleteTask, useUpdateTask } from "../../hooks/useTaskMutations";
import { useSelection } from "../../state/selection";
import { todayLocal, toISODate } from "../../lib/dates";
import RecurrenceEditor from "./RecurrenceEditor";

function parseTags(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function formatTags(tags: string[] | null | undefined): string {
  return (tags ?? []).join(", ");
}

export default function TaskDetailPanel() {
  const { selectedTaskId, setSelectedTaskId } = useSelection();
  const taskQuery = useTask(selectedTaskId);
  const projectsQuery = useProjects();
  const update = useUpdateTask();
  const del = useDeleteTask();

  const isOpen = selectedTaskId !== null;

  function deleteCurrent() {
    const task = taskQuery.data;
    if (!task) return;
    const label = task.title.trim() || "this task";
    if (!window.confirm(`Delete "${label}"?`)) return;
    del.mutate(task.id, { onSuccess: () => setSelectedTaskId(null) });
  }

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedTaskId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, setSelectedTaskId]);

  return (
    <>
      <div
        onClick={() => setSelectedTaskId(null)}
        className={`fixed inset-0 z-30 bg-slate-900/10 transition-opacity duration-200 ${
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!isOpen}
      />
      <aside
        role="dialog"
        aria-label="Task details"
        className={`fixed inset-x-0 bottom-0 top-12 z-40 flex flex-col overflow-hidden rounded-t-2xl border border-slate-200/80 bg-white shadow-panel transition-transform duration-200 ease-out-soft sm:inset-y-3 sm:inset-x-auto sm:right-3 sm:left-auto sm:w-[min(28rem,calc(100vw-1.5rem))] sm:rounded-2xl ${
          isOpen ? "translate-y-0 sm:translate-x-0 sm:translate-y-0" : "translate-y-[110%] sm:translate-y-0 sm:translate-x-[120%]"
        }`}
      >
        {isOpen && taskQuery.data && (
          <PanelBody
            task={taskQuery.data}
            projects={projectsQuery.data ?? []}
            onClose={() => setSelectedTaskId(null)}
            onPatch={(patch) => update.mutate({ id: taskQuery.data!.id, patch })}
            onDelete={deleteCurrent}
            isSaving={update.isPending}
            isDeleting={del.isPending}
          />
        )}
        {isOpen && taskQuery.isLoading && (
          <div className="flex h-full items-center justify-center text-sm text-stone-400">
            Loading…
          </div>
        )}
      </aside>
    </>
  );
}

interface PanelBodyProps {
  task: Task;
  projects: { id: string; name: string; colour: string }[];
  onClose: () => void;
  onPatch: (patch: Partial<Task>) => void;
  onDelete: () => void;
  isSaving: boolean;
  isDeleting: boolean;
}

function PanelBody({ task, projects, onClose, onPatch, onDelete, isSaving, isDeleting }: PanelBodyProps) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [startDate, setStartDate] = useState(task.start_date ?? "");
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [tags, setTags] = useState(formatTags(task.tags));
  const [projectId, setProjectId] = useState(task.project_id ?? "");
  const [soon, setSoon] = useState(task.soon);

  useEffect(() => {
    setTitle(task.title);
    setNotes(task.notes ?? "");
    setStartDate(task.start_date ?? "");
    setDueDate(task.due_date ?? "");
    setTags(formatTags(task.tags));
    setProjectId(task.project_id ?? "");
    setSoon(task.soon);
  }, [task.id]);

  function saveIfChanged<K extends keyof Task>(field: K, next: Task[K]) {
    if (task[field] === next) return;
    onPatch({ [field]: next } as Partial<Task>);
  }

  function toggleSoon(checked: boolean) {
    setSoon(checked);
    if (checked) {
      setStartDate("");
      setDueDate("");
      onPatch({
        soon: true,
        scheduled_date: null,
        start_date: null,
        due_date: null,
      });
    } else {
      const today = toISODate(todayLocal());
      onPatch({
        soon: false,
        scheduled_date: today,
      });
    }
  }

  const inputClass =
    "focus-ring w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-[13px] text-stone-800 placeholder:text-stone-300 transition-colors duration-150 hover:border-slate-300 focus:border-accent/60 focus:outline-none";
  const disabledInputClass =
    "w-full rounded-lg border border-slate-200/60 bg-slate-50 px-3 py-2 text-[13px] text-stone-400 cursor-not-allowed";

  return (
    <>
      <header className="flex flex-none items-center justify-between border-b border-slate-200/80 bg-white px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">
          <span>Task</span>
          {isSaving && (
            <span className="inline-flex items-center gap-1 text-accent">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              Saving
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="focus-ring rounded-md p-1.5 text-stone-400 transition-colors hover:bg-slate-100 hover:text-stone-700"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => saveIfChanged("title", title.trim() || task.title)}
          className="focus-ring mb-5 w-full bg-transparent text-[22px] font-semibold leading-tight tracking-tight text-stone-900 placeholder:text-stone-300 focus:outline-none"
          placeholder="Untitled task"
        />

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => saveIfChanged("notes", notes === "" ? null : notes)}
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
            onClick={() => toggleSoon(!soon)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleSoon(!soon);
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

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <input
              type="date"
              value={soon ? "" : startDate}
              onChange={(e) => setStartDate(e.target.value)}
              onBlur={() => saveIfChanged("start_date", startDate === "" ? null : startDate)}
              disabled={soon}
              className={soon ? disabledInputClass : inputClass}
            />
          </Field>
          <Field label="Due date">
            <input
              type="date"
              value={soon ? "" : dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              onBlur={() => saveIfChanged("due_date", dueDate === "" ? null : dueDate)}
              disabled={soon}
              className={soon ? disabledInputClass : inputClass}
            />
          </Field>
        </div>

        <Field label="Project">
          <select
            value={projectId}
            onChange={(e) => {
              const next = e.target.value;
              setProjectId(next);
              saveIfChanged("project_id", next === "" ? null : next);
            }}
            className={inputClass + " cursor-pointer"}
          >
            <option value="">— No project —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        {!soon && <RecurrenceEditor task={task} />}

        <Field label="Tags">
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            onBlur={() => {
              const next = parseTags(tags);
              const prev = task.tags ?? [];
              if (next.length === prev.length && next.every((t, i) => t === prev[i])) return;
              onPatch({ tags: next });
              setTags(formatTags(next));
            }}
            placeholder="comma, separated, tags"
            className={inputClass}
          />
        </Field>

        <div className="mt-6 space-y-0.5 border-t border-slate-200/70 pt-4 text-[11px] text-stone-400">
          <div>
            <span className="text-stone-500">Scheduled</span> ·{" "}
            {task.soon ? "Soon" : task.scheduled_date}
          </div>
          {task.completed && task.completed_at && (
            <div>
              <span className="text-stone-500">Completed</span> ·{" "}
              {new Date(task.completed_at).toLocaleString()}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-red-200/70 bg-white px-2.5 py-1.5 text-[12px] font-medium text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
          >
            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 4.5h10M6 4.5V3a1 1 0 011-1h2a1 1 0 011 1v1.5M4.5 4.5l.75 8.5a1 1 0 001 .92h3.5a1 1 0 001-.92l.75-8.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {isDeleting ? "Deleting…" : "Delete task"}
          </button>
        </div>
      </div>
    </>
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
