import { useCallback, useEffect, useRef, useState } from "react";
import type { Task } from "../../types";
import { useTask } from "../../hooks/useTasks";
import { useProjects } from "../../hooks/useProjects";
import { useDeleteTask, useDelayedDeleteTask, useUpdateTask } from "../../hooks/useTaskMutations";
import { useSelection } from "../../state/selection";
import { useToast } from "../../state/toast";
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

function sameTags(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((t, i) => t === b[i]);
}

export default function TaskDetailPanel() {
  const { selectedTaskId, setSelectedTaskId } = useSelection();
  const taskQuery = useTask(selectedTaskId);
  const projectsQuery = useProjects();
  const update = useUpdateTask();
  const del = useDeleteTask();
  const delayed = useDelayedDeleteTask();
  const { push } = useToast();

  const isOpen = selectedTaskId !== null;
  // Mirrors PanelBody's unsaved-changes state so Escape / backdrop clicks can
  // warn before throwing edits away.
  const dirtyRef = useRef(false);

  const setDirty = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);

  const requestClose = useCallback(() => {
    if (dirtyRef.current && !window.confirm("Discard unsaved changes to this task?")) return;
    dirtyRef.current = false;
    setSelectedTaskId(null);
  }, [setSelectedTaskId]);

  function deleteCurrent() {
    const task = taskQuery.data;
    if (!task) return;
    const label = task.title.trim() || "this task";
    if (!window.confirm(`Delete "${label}"?`)) return;

    // Close panel immediately; the task is optimistically gone from UI.
    dirtyRef.current = false;
    setSelectedTaskId(null);
    const timerId = delayed.commit(task.id);

    push({
      message: "Task deleted",
      actionLabel: "Undo",
      onAction: () => {
        delayed.cancel(timerId);
      },
    });
  }

  async function save(patch: Partial<Task>) {
    const task = taskQuery.data;
    if (!task) return;
    if (Object.keys(patch).length > 0) {
      await update.mutateAsync({ id: task.id, patch });
    }
    dirtyRef.current = false;
    setSelectedTaskId(null);
  }

  // Opening a different task starts from a clean slate: no carried-over dirty
  // flag, no stale "failed to save" message.
  const resetSave = update.reset;
  useEffect(() => {
    dirtyRef.current = false;
    resetSave();
  }, [selectedTaskId, resetSave]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, requestClose]);

  return (
    <>
      <div
        onClick={requestClose}
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
            onClose={requestClose}
            onSave={save}
            onDelete={deleteCurrent}
            onDirtyChange={setDirty}
            isSaving={update.isPending}
            isDeleting={del.isPending}
            saveError={update.error}
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
  onSave: (patch: Partial<Task>) => Promise<void>;
  onDelete: () => void;
  onDirtyChange: (dirty: boolean) => void;
  isSaving: boolean;
  isDeleting: boolean;
  saveError: unknown;
}

function PanelBody({
  task,
  projects,
  onClose,
  onSave,
  onDelete,
  onDirtyChange,
  isSaving,
  isDeleting,
  saveError,
}: PanelBodyProps) {
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

  // Every field is buffered locally and written in one patch when the user
  // presses "Save task" — nothing is persisted on blur.
  function buildPatch(): Partial<Task> {
    const patch: Partial<Task> = {};

    const nextTitle = title.trim() || task.title;
    if (nextTitle !== task.title) patch.title = nextTitle;

    const nextNotes = notes === "" ? null : notes;
    if (nextNotes !== (task.notes ?? null)) patch.notes = nextNotes;

    const nextProject = projectId === "" ? null : projectId;
    if (nextProject !== (task.project_id ?? null)) patch.project_id = nextProject;

    const nextTags = parseTags(tags);
    if (!sameTags(nextTags, task.tags ?? [])) patch.tags = nextTags;

    if (soon !== task.soon) {
      patch.soon = soon;
      if (soon) {
        // Going "Soon" strips every date — it's the dateless state.
        patch.scheduled_date = null;
        patch.start_date = null;
        patch.due_date = null;
      } else {
        // Coming back from "Soon" the task needs a column to live in again.
        patch.scheduled_date = task.scheduled_date ?? toISODate(todayLocal());
      }
    }

    if (!soon) {
      const nextStart = startDate === "" ? null : startDate;
      if (nextStart !== (task.start_date ?? null)) patch.start_date = nextStart;
      const nextDue = dueDate === "" ? null : dueDate;
      if (nextDue !== (task.due_date ?? null)) patch.due_date = nextDue;
    }

    return patch;
  }

  const patch = buildPatch();
  const dirty = Object.keys(patch).length > 0;

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  function toggleSoon(checked: boolean) {
    setSoon(checked);
    if (checked) {
      setStartDate("");
      setDueDate("");
    }
  }

  function submit() {
    if (isSaving) return;
    void onSave(buildPatch()).catch(() => {
      // The error surfaces inline via saveError; the panel stays open.
    });
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
          {isSaving ? (
            <span className="inline-flex items-center gap-1 text-accent">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              Saving
            </span>
          ) : (
            dirty && <span className="text-stone-400">Unsaved</span>
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

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="focus-ring mb-5 w-full bg-transparent text-[22px] font-semibold leading-tight tracking-tight text-stone-900 placeholder:text-stone-300 focus:outline-none"
            placeholder="Untitled task"
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
              onChange={(e) => setProjectId(e.target.value)}
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

          {!soon && (
            <>
              {(patch.start_date !== undefined || patch.due_date !== undefined) && (
                <p className="mb-2 text-[11px] text-stone-400">
                  Repeat options follow the saved dates — save the task first to use a date you
                  just changed.
                </p>
              )}
              {/* The recurrence block has its own Save button — swallow Enter so
                  it can't implicitly submit (and close) the task form. */}
              <div
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
              >
                <RecurrenceEditor task={task} />
              </div>
            </>
          )}

          <Field label="Tags">
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
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

          {saveError != null && (
            <p className="mt-4 text-[12px] text-red-600">
              Failed to save: {(saveError as { message?: string })?.message ?? String(saveError)}
            </p>
          )}
        </div>

        <footer className="flex flex-none flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 bg-white px-4 py-3 sm:px-6">
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="focus-ring rounded-md px-3 py-1.5 text-[13px] text-stone-600 transition-colors hover:bg-slate-100 hover:text-stone-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="focus-ring rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-accent-600 disabled:opacity-50"
            >
              {isSaving ? "Saving…" : "Save task"}
            </button>
          </div>
        </footer>
      </form>
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
