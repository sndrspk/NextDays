import { useState } from "react";
import { useProjects } from "../../hooks/useProjects";
import {
  useCreateProject,
  useDeleteProject,
  useUpdateProject,
} from "../../hooks/useProjectMutations";
import {
  useCreateCustomList,
  useCustomLists,
  useDeleteCustomList,
  useUpdateCustomList,
} from "../../hooks/useCustomLists";
import type { CustomList, Project, UUID } from "../../types";
import { useView } from "../../state/view";
import ProjectForm from "./ProjectForm";

export default function Sidebar() {
  const { view, setView } = useView();
  const projectsQuery = useProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const listsQuery = useCustomLists();
  const createList = useCreateCustomList();
  const updateList = useUpdateCustomList();
  const deleteList = useDeleteCustomList();

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<UUID | null>(null);
  const [creatingList, setCreatingList] = useState(false);
  const [editingListId, setEditingListId] = useState<UUID | null>(null);

  const activeProjectId = view.kind === "project" ? view.id : null;
  const activeListId = view.kind === "list" ? view.id : null;

  return (
    <aside className="flex h-full w-60 flex-col overflow-y-auto border-r border-stone-200 bg-stone-50 px-4 py-6">
      <div className="mb-6">
        <h1 className="text-base font-semibold tracking-tight text-stone-900">NextDays</h1>
      </div>

      <button
        onClick={() => setView({ kind: "calendar" })}
        className={`mb-6 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
          view.kind === "calendar"
            ? "bg-stone-200/70 font-medium text-stone-900"
            : "text-stone-600 hover:bg-stone-100"
        }`}
      >
        <CalendarIcon />
        Calendar
      </button>

      <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-stone-400">
        Projects
      </div>

      <ul className="mb-2 space-y-0.5">
        {projectsQuery.data?.map((p) => (
          <li key={p.id}>
            {editingId === p.id ? (
              <ProjectForm
                initial={p}
                submitLabel="Save"
                pending={updateProject.isPending}
                onCancel={() => setEditingId(null)}
                onSubmit={(values) =>
                  updateProject.mutate(
                    { id: p.id, patch: values },
                    { onSuccess: () => setEditingId(null) },
                  )
                }
              />
            ) : (
              <ProjectRow
                project={p}
                active={p.id === activeProjectId}
                onOpen={() => setView({ kind: "project", id: p.id })}
                onEdit={() => setEditingId(p.id)}
                onDelete={() => {
                  if (!window.confirm(`Delete project "${p.name}"? Tasks will be unassigned.`)) {
                    return;
                  }
                  deleteProject.mutate(p.id, {
                    onSuccess: () => {
                      if (activeProjectId === p.id) setView({ kind: "calendar" });
                    },
                  });
                }}
              />
            )}
          </li>
        ))}
      </ul>

      {creating ? (
        <ProjectForm
          submitLabel="Create"
          pending={createProject.isPending}
          onCancel={() => setCreating(false)}
          onSubmit={(values) =>
            createProject.mutate(values, {
              onSuccess: () => setCreating(false),
            })
          }
        />
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="rounded-md px-2 py-1.5 text-left text-xs text-stone-500 hover:bg-stone-100 hover:text-stone-900"
        >
          + New project
        </button>
      )}

      <div className="mb-2 mt-6 text-[11px] font-medium uppercase tracking-[0.12em] text-stone-400">
        Lists
      </div>

      <ul className="mb-2 space-y-0.5">
        {listsQuery.data?.map((l) => (
          <li key={l.id}>
            {editingListId === l.id ? (
              <ListNameForm
                initial={l.name}
                pending={updateList.isPending}
                submitLabel="Save"
                onCancel={() => setEditingListId(null)}
                onSubmit={(name) =>
                  updateList.mutate(
                    { id: l.id, name },
                    { onSuccess: () => setEditingListId(null) },
                  )
                }
              />
            ) : (
              <ListRow
                list={l}
                active={l.id === activeListId}
                onOpen={() => setView({ kind: "list", id: l.id })}
                onEdit={() => setEditingListId(l.id)}
                onDelete={() => {
                  if (!window.confirm(`Delete list "${l.name}"? All items will be removed.`)) {
                    return;
                  }
                  deleteList.mutate(l.id, {
                    onSuccess: () => {
                      if (activeListId === l.id) setView({ kind: "calendar" });
                    },
                  });
                }}
              />
            )}
          </li>
        ))}
      </ul>

      {creatingList ? (
        <ListNameForm
          pending={createList.isPending}
          submitLabel="Create"
          onCancel={() => setCreatingList(false)}
          onSubmit={(name) =>
            createList.mutate(name, {
              onSuccess: () => setCreatingList(false),
            })
          }
        />
      ) : (
        <button
          onClick={() => setCreatingList(true)}
          className="rounded-md px-2 py-1.5 text-left text-xs text-stone-500 hover:bg-stone-100 hover:text-stone-900"
        >
          + New list
        </button>
      )}
    </aside>
  );
}

interface ListRowProps {
  list: CustomList;
  active: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ListRow({ list, active, onOpen, onEdit, onDelete }: ListRowProps) {
  return (
    <div
      className={`group flex items-center gap-2 rounded-md px-2 py-1 ${
        active ? "bg-stone-200/70" : "hover:bg-stone-100"
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-1 items-center gap-2 text-left text-sm"
      >
        <ListIcon />
        <span
          className={`truncate ${
            active ? "font-medium text-stone-900" : "text-stone-700"
          }`}
        >
          {list.name}
        </span>
      </button>
      <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
        <IconButton label="Rename list" onClick={onEdit}>
          <PencilIcon />
        </IconButton>
        <IconButton label="Delete list" onClick={onDelete}>
          <TrashIcon />
        </IconButton>
      </div>
    </div>
  );
}

interface ListNameFormProps {
  initial?: string;
  pending: boolean;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (name: string) => void;
}

function ListNameForm({ initial = "", pending, submitLabel, onCancel, onSubmit }: ListNameFormProps) {
  const [name, setName] = useState(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed || pending) return;
        onSubmit(trimmed);
      }}
      className="rounded-md border border-stone-200 bg-white p-2"
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
        placeholder="List name"
        className="w-full bg-transparent text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none"
      />
      <div className="mt-1.5 flex justify-end gap-1 text-[11px]">
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-2 py-0.5 text-stone-500 hover:bg-stone-100"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="rounded bg-stone-900 px-2 py-0.5 text-white disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

interface ProjectRowProps {
  project: Project;
  active: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ProjectRow({ project, active, onOpen, onEdit, onDelete }: ProjectRowProps) {
  return (
    <div
      className={`group flex items-center gap-2 rounded-md px-2 py-1 ${
        active ? "bg-stone-200/70" : "hover:bg-stone-100"
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-1 items-center gap-2 text-left text-sm"
      >
        <span
          aria-hidden
          className="inline-block h-2.5 w-2.5 flex-none rounded-full"
          style={{ backgroundColor: project.colour }}
        />
        <span
          className={`truncate ${
            active ? "font-medium text-stone-900" : "text-stone-700"
          }`}
        >
          {project.name}
        </span>
        {!project.is_personal && (
          <span className="text-[10px] uppercase tracking-wider text-stone-400">work</span>
        )}
      </button>
      <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
        <IconButton label="Edit project" onClick={onEdit}>
          <PencilIcon />
        </IconButton>
        <IconButton label="Delete project" onClick={onDelete}>
          <TrashIcon />
        </IconButton>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="rounded p-1 text-stone-400 hover:bg-stone-200/70 hover:text-stone-700"
    >
      {children}
    </button>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 flex-none text-stone-400" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M5.5 4h7M5.5 8h7M5.5 12h7M3 4h.01M3 8h.01M3 12h.01" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3.5" width="12" height="10.5" rx="1.5" />
      <path d="M2 7h12M5.5 1.5v3M10.5 1.5v3" strokeLinecap="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M11 2.5l2.5 2.5L5 13.5H2.5V11L11 2.5z" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 4.5h10M6 4.5V3a1 1 0 011-1h2a1 1 0 011 1v1.5M4.5 4.5l.75 8.5a1 1 0 001 .92h3.5a1 1 0 001-.92l.75-8.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
