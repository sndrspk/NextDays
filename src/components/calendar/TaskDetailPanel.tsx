import { useEffect, useState } from "react";
import type { Task } from "../../types";
import { useTask } from "../../hooks/useTasks";
import { useProjects } from "../../hooks/useProjects";
import { useUpdateTask } from "../../hooks/useTaskMutations";
import { useSelection } from "../../state/selection";
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
        className={`fixed inset-0 z-30 bg-stone-900/15 backdrop-blur-[2px] transition-opacity duration-200 ${
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!isOpen}
      />
      <aside
        role="dialog"
        aria-label="Task details"
        className={`fixed inset-x-0 bottom-0 top-12 z-40 flex flex-col overflow-hidden rounded-t-2xl border border-black/[0.06] bg-white/95 shadow-panel backdrop-blur-xl transition-transform duration-200 ease-out-soft sm:inset-y-3 sm:inset-x-auto sm:right-3 sm:left-auto sm:w-[min(28rem,calc(100vw-1.5rem))] sm:rounded-2xl ${
          isOpen ? "translate-y-0 sm:translate-x-0 sm:translate-y-0" : "translate-y-[110%] sm:translate-y-0 sm:translate-x-[120%]"
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

  const inputClass =
    "focus-ring w-full rounded-lg border border-black/[0.07] bg-white/80 px-3 py-2 text-[13px] text-stone-800 placeholder:text-stone-300 transition-colors duration-150 hover:border-black/[0.12] focus:border-accent/50 focus:outline-none";

  return (
    <>
      <header className="flex flex-none items-center justify-between border-b border-black/[0.05] bg-white/60 px-4 py-3 backdrop-blur-xl sm:px-5">
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
          className="focus-ring rounded-md p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
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

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              onBlur={() => saveIfChanged("start_date", startDate === "" ? null : startDate)}
              className={inputClass}
            />
          </Field>
          <Field label="Due date">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              onBlur={() => saveIfChanged("due_date", dueDate === "" ? null : dueDate)}
              className={inputClass}
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

        <RecurrenceEditor task={task} />

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

        <div className="mt-6 space-y-0.5 border-t border-black/[0.05] pt-4 text-[11px] text-stone-400">
          <div>
            <span className="text-stone-500">Scheduled</span> · {task.scheduled_date}
          </div>
          {task.completed && task.completed_at && (
            <div>
              <span className="text-stone-500">Completed</span> ·{" "}
              {new Date(task.completed_at).toLocaleString()}
            </div>
          )}
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
