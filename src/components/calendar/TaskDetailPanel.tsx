import { useEffect, useState } from "react";
import type { Task } from "../../types";
import { useTask } from "../../hooks/useTasks";
import { useProjects } from "../../hooks/useProjects";
import { useUpdateTask } from "../../hooks/useTaskMutations";
import { useSelection } from "../../state/selection";

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

  const isOpen = selectedTaskId !== null;

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
        className={`fixed inset-0 z-30 bg-stone-900/10 transition-opacity ${
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!isOpen}
      />
      <aside
        role="dialog"
        aria-label="Task details"
        className={`fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-stone-200 bg-white shadow-xl transition-transform duration-200 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {isOpen && taskQuery.data && (
          <PanelBody
            task={taskQuery.data}
            projects={projectsQuery.data ?? []}
            onClose={() => setSelectedTaskId(null)}
            onPatch={(patch) => update.mutate({ id: taskQuery.data!.id, patch })}
            isSaving={update.isPending}
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
  isSaving: boolean;
}

function PanelBody({ task, projects, onClose, onPatch, isSaving }: PanelBodyProps) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [startDate, setStartDate] = useState(task.start_date ?? "");
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [tags, setTags] = useState(formatTags(task.tags));
  const [projectId, setProjectId] = useState(task.project_id ?? "");

  useEffect(() => {
    setTitle(task.title);
    setNotes(task.notes ?? "");
    setStartDate(task.start_date ?? "");
    setDueDate(task.due_date ?? "");
    setTags(formatTags(task.tags));
    setProjectId(task.project_id ?? "");
  }, [task.id]);

  function saveIfChanged<K extends keyof Task>(field: K, next: Task[K]) {
    if (task[field] === next) return;
    onPatch({ [field]: next } as Partial<Task>);
  }

  return (
    <>
      <header className="flex items-center justify-between border-b border-stone-200 px-5 py-3">
        <div className="text-[11px] uppercase tracking-[0.12em] text-stone-400">
          {isSaving ? "Saving…" : "Task"}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-stone-400 hover:text-stone-700"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <Field label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => saveIfChanged("title", title.trim() || task.title)}
            className="w-full border-0 border-b border-stone-200 bg-transparent pb-1 text-base font-medium text-stone-900 focus:border-stone-500 focus:outline-none"
          />
        </Field>

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => saveIfChanged("notes", notes === "" ? null : notes)}
            rows={5}
            placeholder="Add notes…"
            className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-300 focus:border-stone-500 focus:outline-none"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              onBlur={() => saveIfChanged("start_date", startDate === "" ? null : startDate)}
              className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 focus:border-stone-500 focus:outline-none"
            />
          </Field>
          <Field label="Due date">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              onBlur={() => saveIfChanged("due_date", dueDate === "" ? null : dueDate)}
              className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 focus:border-stone-500 focus:outline-none"
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
            className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 focus:border-stone-500 focus:outline-none"
          >
            <option value="">(no project)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {projects.length === 0 && (
            <p className="mt-1 text-[11px] text-stone-400">
              Projects can be created in Milestone 5.
            </p>
          )}
        </Field>

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
            className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-300 focus:border-stone-500 focus:outline-none"
          />
        </Field>

        <div className="mt-6 text-[11px] text-stone-400">
          <div>Scheduled: {task.scheduled_date}</div>
          {task.completed && task.completed_at && (
            <div>Completed: {new Date(task.completed_at).toLocaleString()}</div>
          )}
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-stone-400">
        {label}
      </span>
      {children}
    </label>
  );
}
