import { useMemo, useState } from "react";
import { useProjects } from "../../hooks/useProjects";
import { useProjectTasks } from "../../hooks/useProjectTasks";
import {
  useBulkCompleteTasks,
  useBulkDeleteTasks,
  useCreateTask,
  useToggleTaskCompleted,
} from "../../hooks/useTaskMutations";
import { isDueOrOverdue, todayLocal, toISODate } from "../../lib/dates";
import { parseTaskTitle } from "../../lib/parseTaskTitle";
import { useSelection } from "../../state/selection";
import type { Task, UUID } from "../../types";

type Filter = "active" | "completed" | "all";

interface ProjectViewProps {
  projectId: UUID;
}

export default function ProjectView({ projectId }: ProjectViewProps) {
  const projectsQuery = useProjects();
  const tasksQuery = useProjectTasks(projectId);
  const [filter, setFilter] = useState<Filter>("active");
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<Set<string>>(() => new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<UUID>>(() => new Set());

  const bulkComplete = useBulkCompleteTasks();
  const bulkDelete = useBulkDeleteTasks();

  const project = projectsQuery.data?.find((p) => p.id === projectId);
  const today = toISODate(todayLocal());

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const t of tasksQuery.data ?? []) {
      for (const tag of t.tags ?? []) set.add(tag);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [tasksQuery.data]);

  const filtered = useMemo(() => {
    const all = tasksQuery.data ?? [];
    const needle = query.trim().toLowerCase();
    return all.filter((t) => {
      if (filter === "active" && t.completed) return false;
      if (filter === "completed" && !t.completed) return false;
      if (needle && !t.title.toLowerCase().includes(needle)) return false;
      if (tagFilter.size > 0) {
        const hits = (t.tags ?? []).some((tag) => tagFilter.has(tag));
        if (!hits) return false;
      }
      return true;
    });
  }, [tasksQuery.data, filter, query, tagFilter]);

  const filteredIds = useMemo(() => filtered.map((t) => t.id), [filtered]);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));

  function toggleSelected(id: UUID) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function exitSelectMode() {
    setSelectMode(false);
    clearSelection();
  }

  function toggleTag(tag: string) {
    setTagFilter((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function bulkCompleteSelected(completed: boolean) {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    bulkComplete.mutate(
      { ids, completed },
      { onSuccess: () => clearSelection() },
    );
  }

  function bulkDeleteSelected() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} task${ids.length === 1 ? "" : "s"}?`)) return;
    bulkDelete.mutate(ids, { onSuccess: () => clearSelection() });
  }

  if (!project) {
    return (
      <div className="p-8 text-sm text-stone-500">
        {projectsQuery.isLoading ? "Loading…" : "Project not found."}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col px-4 py-5 sm:px-8 sm:py-8 lg:px-10">
      <header className="mb-5 flex flex-wrap items-center gap-2.5 sm:mb-6 sm:gap-3">
        <span
          aria-hidden
          className="inline-block h-3.5 w-3.5 rounded-full ring-2 ring-inset ring-black/[0.05]"
          style={{ backgroundColor: project.colour }}
        />
        <h2 className="text-[22px] font-semibold tracking-tight text-stone-900 sm:text-[26px]">
          {project.name}
        </h2>
        <span className="rounded-full border border-slate-200/80 bg-white/70 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
          {project.is_personal ? "Personal" : "Work"}
        </span>
      </header>

      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedFilter value={filter} onChange={setFilter} />
        <ProjectQuickAdd projectId={projectId} today={today} />
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <SearchInput value={query} onChange={setQuery} />
        <button
          type="button"
          onClick={() => {
            if (selectMode) exitSelectMode();
            else setSelectMode(true);
          }}
          className={`focus-ring inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
            selectMode
              ? "border-accent-100 bg-accent-50 text-accent-700"
              : "border-slate-200/80 bg-white text-stone-600 hover:bg-slate-50"
          }`}
        >
          {selectMode ? "Done" : "Select"}
        </button>
      </div>

      {allTags.length > 0 && (
        <TagFilterRow
          tags={allTags}
          selected={tagFilter}
          onToggle={toggleTag}
          onClear={() => setTagFilter(new Set())}
        />
      )}

      {selectMode && selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          allFilteredSelected={allFilteredSelected}
          onToggleAll={() => {
            if (allFilteredSelected) clearSelection();
            else setSelectedIds(new Set(filteredIds));
          }}
          onComplete={() => bulkCompleteSelected(true)}
          onUncomplete={() => bulkCompleteSelected(false)}
          onDelete={bulkDeleteSelected}
          onCancel={clearSelection}
          pending={bulkComplete.isPending || bulkDelete.isPending}
        />
      )}

      <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white/95">
        {tasksQuery.isLoading ? (
          <p className="p-8 text-sm text-stone-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={query || tagFilter.size > 0 ? "No matching tasks" : "Nothing here yet"}
            subtitle={
              query || tagFilter.size > 0
                ? "Try a different search or clear the tag filter."
                : filter === "active"
                ? "Use the input above to add your first task."
                : filter === "completed"
                ? "Completed tasks will appear here."
                : "No tasks in this project."
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((t) => (
              <ProjectTaskRow
                key={t.id}
                task={t}
                today={today}
                tint={project.colour}
                selectMode={selectMode}
                selected={selectedIds.has(t.id)}
                onToggleSelected={() => toggleSelected(t.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SegmentedFilter({
  value,
  onChange,
}: {
  value: Filter;
  onChange: (next: Filter) => void;
}) {
  const items: Filter[] = ["active", "completed", "all"];
  return (
    <div className="inline-flex w-fit gap-0.5 rounded-lg border border-slate-200/80 bg-white/60 p-0.5 text-[12px]">
      {items.map((f) => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className={`focus-ring rounded-md px-3 py-1 font-medium capitalize transition-all duration-150 ease-out-soft ${
            value === f
              ? "bg-accent-50 text-accent-700"
              : "text-stone-500 hover:text-stone-900"
          }`}
        >
          {f}
        </button>
      ))}
    </div>
  );
}

function SearchInput({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <div className="relative flex-1">
      <svg
        viewBox="0 0 16 16"
        aria-hidden
        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <circle cx="7" cy="7" r="4.5" />
        <path d="M10.5 10.5L13.5 13.5" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search tasks…"
        className="focus-ring w-full rounded-lg border border-slate-200/80 bg-white py-1.5 pl-8 pr-3 text-[13px] text-stone-800 placeholder:text-stone-400 transition-colors hover:border-slate-300 focus:border-accent/60 focus:outline-none"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-1.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-slate-100 hover:text-stone-700"
        >
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

function TagFilterRow({
  tags,
  selected,
  onToggle,
  onClear,
}: {
  tags: string[];
  selected: Set<string>;
  onToggle: (tag: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
        Tags
      </span>
      {tags.map((tag) => {
        const active = selected.has(tag);
        return (
          <button
            key={tag}
            type="button"
            onClick={() => onToggle(tag)}
            className={`focus-ring rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
              active
                ? "border-accent-100 bg-accent-50 text-accent-700"
                : "border-slate-200/80 bg-white text-stone-600 hover:border-slate-300 hover:text-stone-900"
            }`}
          >
            {tag}
          </button>
        );
      })}
      {selected.size > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="ml-1 text-[11px] text-stone-400 underline-offset-2 transition-colors hover:text-stone-700 hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}

function BulkActionBar({
  count,
  allFilteredSelected,
  onToggleAll,
  onComplete,
  onUncomplete,
  onDelete,
  onCancel,
  pending,
}: {
  count: number;
  allFilteredSelected: boolean;
  onToggleAll: () => void;
  onComplete: () => void;
  onUncomplete: () => void;
  onDelete: () => void;
  onCancel: () => void;
  pending: boolean;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-accent-100 bg-accent-50 px-3 py-2">
      <span className="text-[12px] font-medium text-accent-700">
        {count} selected
      </span>
      <button
        type="button"
        onClick={onToggleAll}
        className="text-[12px] text-accent-700 underline-offset-2 hover:underline"
      >
        {allFilteredSelected ? "Deselect all" : "Select all"}
      </button>
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onComplete}
          disabled={pending}
          className="focus-ring rounded-md border border-accent-100 bg-white px-2.5 py-1 text-[12px] font-medium text-accent-700 transition-colors hover:bg-accent-100/60 disabled:opacity-50"
        >
          Complete
        </button>
        <button
          type="button"
          onClick={onUncomplete}
          disabled={pending}
          className="focus-ring rounded-md border border-slate-200/80 bg-white px-2.5 py-1 text-[12px] font-medium text-stone-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          Mark active
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="focus-ring rounded-md border border-red-200/70 bg-white px-2.5 py-1 text-[12px] font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
        >
          Delete
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="focus-ring rounded-md px-2 py-1 text-[12px] text-stone-500 transition-colors hover:text-stone-800 disabled:opacity-50"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

function ProjectQuickAdd({ projectId, today }: { projectId: UUID; today: string }) {
  const [title, setTitle] = useState("");
  const create = useCreateTask();
  const projectsQuery = useProjects();

  function submit() {
    const trimmed = title.trim();
    if (!trimmed || create.isPending) return;
    const parsed = parseTaskTitle(trimmed, projectsQuery.data ?? []);
    if (!parsed.title) return;
    create.mutate(
      {
        title: parsed.title,
        scheduled_date: today,
        project_id: parsed.project_id ?? projectId,
        tags: parsed.tags,
      },
      { onSuccess: () => setTitle("") },
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex w-full items-center rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 transition-colors focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/20 sm:w-72"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="+ Add task to project"
        disabled={create.isPending}
        className="w-full bg-transparent text-[13px] text-stone-800 placeholder:text-stone-400 focus:outline-none disabled:opacity-50"
      />
    </form>
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

interface ProjectTaskRowProps {
  task: Task;
  today: string;
  tint: string;
  selectMode: boolean;
  selected: boolean;
  onToggleSelected: () => void;
}

function ProjectTaskRow({
  task,
  today,
  tint,
  selectMode,
  selected,
  onToggleSelected,
}: ProjectTaskRowProps) {
  const toggle = useToggleTaskCompleted();
  const { setSelectedTaskId } = useSelection();

  const overdue = task.due_date && !task.completed && task.due_date < today;
  const urgent = isDueOrOverdue(task.due_date, today, task.completed);

  const checkboxStyle = task.completed
    ? { backgroundColor: tint, borderColor: tint }
    : { borderColor: tint };

  function onRowClick() {
    if (selectMode) onToggleSelected();
    else setSelectedTaskId(task.id);
  }

  return (
    <li
      onClick={onRowClick}
      className={`group flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors duration-150 ease-out-soft sm:px-5 ${
        selected ? "bg-accent-50/70" : "hover:bg-slate-50"
      }`}
    >
      {selectMode && (
        <span
          aria-hidden
          className={`inline-flex h-4 w-4 flex-none items-center justify-center rounded-[5px] border transition-colors ${
            selected
              ? "border-accent bg-accent text-white"
              : "border-stone-300 bg-white"
          }`}
        >
          {selected && (
            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="2.5,6.5 5,9 9.5,3.5" />
            </svg>
          )}
        </span>
      )}
      <button
        type="button"
        aria-label={task.completed ? "Mark task incomplete" : "Mark task complete"}
        onClick={(e) => {
          e.stopPropagation();
          toggle.mutate(task);
        }}
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
      <span
        className={`flex-1 text-[13px] ${
          task.completed ? "text-stone-400 line-through" : "text-stone-800"
        } ${urgent ? "font-semibold" : ""}`}
      >
        {task.title}
        {task.tags && task.tags.length > 0 && (
          <span className="ml-1.5 inline-flex flex-wrap gap-1 align-middle">
            {task.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-slate-100 px-1.5 py-px text-[10px] font-medium text-stone-500"
              >
                {tag}
              </span>
            ))}
          </span>
        )}
      </span>
      <span className={`text-[11px] ${overdue ? "font-medium text-red-600" : "text-stone-400"}`}>
        {task.scheduled_date}
      </span>
    </li>
  );
}
