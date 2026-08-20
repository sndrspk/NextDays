import { useMemo, useRef, useState } from "react";
import { useAllTasks } from "../../hooks/useAllTasks";
import { useProjects } from "../../hooks/useProjects";
import { useToggleTaskCompleted } from "../../hooks/useTaskMutations";
import { isDueOrOverdue, todayLocal, toISODate } from "../../lib/dates";
import { buildSearchHaystack, matchesSearch, parseSearchQuery } from "../../lib/searchQuery";
import { useSelection } from "../../state/selection";
import { useToast } from "../../state/toast";
import { useView } from "../../state/view";
import type { Project, Task, UUID } from "../../types";
import { compareActiveTasks } from "../calendar/DayColumn";

export default function SearchView() {
  const [query, setQuery] = useState("");
  const tasksQuery = useAllTasks();
  const projectsQuery = useProjects();
  const today = toISODate(todayLocal());

  const projectsById = useMemo(() => {
    const map = new Map<UUID, Project>();
    for (const p of projectsQuery.data ?? []) map.set(p.id, p);
    return map;
  }, [projectsQuery.data]);

  const trimmed = query.trim();

  const results = useMemo(() => {
    if (!trimmed) return [];
    const node = parseSearchQuery(trimmed);
    if (!node) return [];

    const hits = (tasksQuery.data ?? []).filter((task) => {
      const project = task.project_id ? projectsById.get(task.project_id) : undefined;
      const haystack = buildSearchHaystack([
        task.title,
        task.notes,
        ...(task.tags ?? []),
        project?.name,
      ]);
      return matchesSearch(node, haystack);
    });

    // Active tasks first in the calendar's usual order; completed sink to the
    // bottom, most recently finished first.
    const active: Task[] = [];
    const completed: Task[] = [];
    for (const t of hits) (t.completed ? completed : active).push(t);
    active.sort(compareActiveTasks);
    completed.sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
    return [...active, ...completed];
  }, [trimmed, tasksQuery.data, projectsById]);

  const activeCount = results.filter((t) => !t.completed).length;

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-4 py-5 sm:px-8 sm:py-8 lg:px-10">
      <header className="mb-4">
        <h2 className="text-[22px] font-semibold tracking-tight text-stone-900 sm:text-[26px]">
          Search
        </h2>
        <p className="text-[12px] text-stone-500">
          Looks through titles, notes, tags, and project names.
        </p>
      </header>

      <SearchField value={query} onChange={setQuery} />

      <p className="mt-2 text-[11px] leading-relaxed text-stone-400">
        Words are combined with AND. Use <Code>OR</Code> for either, <Code>"exact phrase"</Code> for
        a full string, and <Code>( )</Code> to group. <Code>AND</Code> and <Code>OR</Code> must be
        uppercase — lowercase <em>and</em> / <em>or</em> are searched as ordinary words.
      </p>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white/95">
        {!trimmed ? (
          <EmptyState
            title="Search your tasks"
            subtitle="Start typing to look through every task, past and present."
          />
        ) : tasksQuery.isLoading ? (
          <p className="p-8 text-sm text-stone-400">Loading…</p>
        ) : tasksQuery.isError ? (
          <p className="p-8 text-sm text-red-600">
            Could not load tasks:{" "}
            {(tasksQuery.error as { message?: string })?.message ?? "unknown error"}
          </p>
        ) : results.length === 0 ? (
          <EmptyState
            title="No matches"
            subtitle="Try fewer words, or OR between them to widen the search."
          />
        ) : (
          <>
            <div className="border-b border-slate-100 px-4 py-2 text-[11px] text-stone-400 sm:px-5">
              {results.length} {results.length === 1 ? "result" : "results"}
              {activeCount !== results.length && ` · ${activeCount} active`}
            </div>
            <ul className="divide-y divide-slate-100">
              {results.map((t) => (
                <SearchResultRow
                  key={t.id}
                  task={t}
                  today={today}
                  project={t.project_id ? projectsById.get(t.project_id) : undefined}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-slate-100 px-1 py-px font-mono text-[10px] text-stone-600">
      {children}
    </code>
  );
}

function SearchField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="relative">
      <svg
        viewBox="0 0 16 16"
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <circle cx="7" cy="7" r="4.5" />
        <path d="M10.5 10.5L13.5 13.5" strokeLinecap="round" />
      </svg>
      <input
        ref={inputRef}
        autoFocus
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.stopPropagation();
            onChange("");
          }
        }}
        placeholder='Search tasks — try: report OR invoice, "quarterly report"'
        className="focus-ring w-full rounded-xl border border-slate-200/80 bg-white py-2.5 pl-9 pr-9 text-[14px] text-stone-800 placeholder:text-stone-400 transition-colors hover:border-slate-300 focus:border-accent/60 focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-slate-100 hover:text-stone-700"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

function SearchResultRow({
  task,
  today,
  project,
}: {
  task: Task;
  today: string;
  project: Project | undefined;
}) {
  const toggle = useToggleTaskCompleted();
  const { setSelectedTaskId } = useSelection();
  const { setView } = useView();
  const { push } = useToast();

  const tint = project?.colour ?? "#d6d3d1";
  const overdue = task.due_date && !task.completed && task.due_date < today;
  const urgent = isDueOrOverdue(task.due_date, today, task.completed);

  const checkboxStyle = task.completed
    ? { backgroundColor: tint, borderColor: tint }
    : { borderColor: tint };

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    const wasCompleted = task.completed;
    toggle.mutate(task, {
      onSuccess: () => {
        push({
          message: wasCompleted ? "Task marked active" : "Task completed",
          actionLabel: "Undo",
          onAction: () => {
            toggle.mutate({ ...task, completed: !wasCompleted });
          },
        });
      },
    });
  }

  return (
    <li
      onClick={() => setSelectedTaskId(task.id)}
      className="group flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors duration-150 ease-out-soft hover:bg-slate-50 sm:px-5"
    >
      <button
        type="button"
        aria-label={task.completed ? "Mark task incomplete" : "Mark task complete"}
        title={project?.name}
        onClick={handleToggle}
        disabled={toggle.isPending}
        style={checkboxStyle}
        className={`focus-ring inline-flex h-4 w-4 flex-none items-center justify-center rounded-full border-[1.5px] transition-all duration-150 ease-out-soft ${
          task.completed ? "text-white" : "bg-white hover:shadow-sm"
        } disabled:opacity-50`}
      >
        {task.completed && (
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2.5,6.5 5,9 9.5,3.5" />
          </svg>
        )}
      </button>

      <span className="min-w-0 flex-1">
        <span
          className={`text-[13px] ${
            task.completed ? "text-stone-400 line-through" : "text-stone-800"
          } ${urgent ? "font-semibold" : ""}`}
        >
          {task.title}
          {task.template_id && (
            <span aria-label="Recurring" title="Recurring" className="ml-1 text-stone-400">
              ↻
            </span>
          )}
        </span>
        {task.tags && task.tags.length > 0 && (
          <span className="ml-1.5 inline-flex flex-wrap gap-1 align-middle">
            {task.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setView({ kind: "tag", tag });
                }}
                className="rounded-full bg-slate-100 px-1.5 py-px text-[10px] font-medium text-stone-500 transition-colors hover:bg-slate-200/70 hover:text-stone-700"
              >
                {tag}
              </button>
            ))}
          </span>
        )}
        {task.notes && (
          <span className="mt-0.5 block truncate text-[11px] text-stone-400">{task.notes}</span>
        )}
      </span>

      {project && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setView({ kind: "project", id: project.id });
          }}
          className="hidden flex-none items-center gap-1.5 rounded-full border border-slate-200/80 px-2 py-0.5 text-[10px] font-medium text-stone-500 transition-colors hover:border-slate-300 hover:text-stone-800 sm:inline-flex"
        >
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: project.colour }}
          />
          {project.name}
        </button>
      )}

      <span
        className={`flex-none text-[11px] ${overdue ? "font-medium text-red-600" : "text-stone-400"}`}
      >
        {task.soon ? "Soon" : task.scheduled_date ?? "—"}
      </span>
    </li>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 px-6 py-16 text-center">
      <p className="text-sm font-medium text-stone-600">{title}</p>
      <p className="text-xs text-stone-400">{subtitle}</p>
    </div>
  );
}
