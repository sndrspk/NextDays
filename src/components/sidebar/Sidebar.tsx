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
import { useAuth } from "../../state/auth";
import { useView } from "../../state/view";
import ProjectForm from "./ProjectForm";

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps = {}) {
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
    <>
      {/* Mobile backdrop */}
      <div
        onClick={onMobileClose}
        aria-hidden={!mobileOpen}
        className={`fixed inset-0 z-40 bg-slate-900/15 transition-opacity duration-200 md:hidden ${
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-72 max-w-[85vw] flex-none flex-col overflow-y-auto border-r border-slate-200/70 bg-white px-3 py-5 transition-transform duration-200 ease-out-soft md:static md:z-auto md:w-64 md:max-w-none md:translate-x-0 md:bg-white/40 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-5 flex items-start justify-between px-2 md:mb-7 md:block">
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight text-stone-900">NextDays</h1>
            <p className="text-[11px] text-stone-400">Keyboard-first daily focus</p>
          </div>
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Close navigation"
            className="focus-ring -mr-1 inline-flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-slate-100 hover:text-stone-700 md:hidden"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
            </svg>
          </button>
        </div>

      <button
        onClick={() => setView({ kind: "calendar" })}
        className={`focus-ring mb-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors duration-150 ease-out-soft ${
          view.kind === "calendar"
            ? "bg-accent-50 text-accent-700"
            : "text-stone-600 hover:bg-slate-100/70 hover:text-stone-900"
        }`}
      >
        <CalendarIcon active={view.kind === "calendar"} />
        Calendar
      </button>

      <button
        onClick={() => setView({ kind: "focus" })}
        className={`focus-ring mb-6 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors duration-150 ease-out-soft ${
          view.kind === "focus"
            ? "bg-accent-50 text-accent-700"
            : "text-stone-600 hover:bg-slate-100/70 hover:text-stone-900"
        }`}
      >
        <FocusIcon active={view.kind === "focus"} />
        Focus
      </button>

      <SectionHeader>Projects</SectionHeader>

      <ul className="mb-1 space-y-px">
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
        <AddButton onClick={() => setCreating(true)} label="New project" />
      )}

      <div className="mt-7">
        <SectionHeader>Lists</SectionHeader>
      </div>

      <ul className="mb-1 space-y-px">
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
        <AddButton onClick={() => setCreatingList(true)} label="New list" />
      )}

      <UserFooter />
      </aside>
    </>
  );
}

function UserFooter() {
  const { session, signOut } = useAuth();
  const { setView } = useView();
  const email = session?.user?.email ?? "Signed in";
  return (
    <div className="mt-auto pt-6">
      <div className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-white/60 px-2.5 py-2">
        <div className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent-100 text-[10px] font-semibold text-accent-700">
          {email.slice(0, 1).toUpperCase()}
        </div>
        <span className="flex-1 truncate text-[11px] text-stone-600" title={email}>
          {email}
        </span>
        <button
          type="button"
          onClick={() => setView({ kind: "settings" })}
          aria-label="Settings"
          title="Settings"
          className="rounded-md p-1 text-stone-400 transition-colors duration-150 hover:bg-slate-100 hover:text-stone-700"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="1.75" />
            <path
              d="M13 8a5 5 0 00-.08-.88l1.3-1.02-1-1.73-1.55.55a5 5 0 00-1.52-.88L9.9 2.4h-2l-.25 1.64a5 5 0 00-1.52.88l-1.55-.55-1 1.73L4.88 7.12A5 5 0 004.8 8c0 .3.03.59.08.88L3.58 9.9l1 1.73 1.55-.55c.45.36.96.66 1.52.88L7.9 13.6h2l.25-1.64a5 5 0 001.52-.88l1.55.55 1-1.73-1.3-1.02c.05-.29.08-.58.08-.88z"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => signOut()}
          aria-label="Sign out"
          title="Sign out"
          className="rounded-md p-1 text-stone-400 transition-colors duration-150 hover:bg-slate-100 hover:text-stone-700"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 3H4.5A1.5 1.5 0 003 4.5v7A1.5 1.5 0 004.5 13H9M11 5.5L13.5 8 11 10.5M6.5 8H13" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
      {children}
    </div>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="focus-ring flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] text-stone-400 transition-colors duration-150 hover:bg-slate-100/70 hover:text-stone-700"
    >
      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-200/70 text-[10px] text-stone-500">
        +
      </span>
      {label}
    </button>
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
      className={`group flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors duration-150 ease-out-soft ${
        active
          ? "bg-accent-50 text-accent-700"
          : "text-stone-700 hover:bg-slate-100/70"
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="focus-ring flex flex-1 items-center gap-2.5 rounded text-left text-[13px]"
      >
        <ListIcon active={active} />
        <span className={`truncate ${active ? "font-medium" : ""}`}>{list.name}</span>
      </button>
      <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
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
      className="animate-fade-up rounded-xl border border-slate-200/80 bg-white p-2.5"
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
        placeholder="List name"
        className="w-full bg-transparent text-[13px] text-stone-800 placeholder:text-stone-300 focus:outline-none"
      />
      <div className="mt-2 flex justify-end gap-1 text-[11px]">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-2 py-1 text-stone-500 transition-colors hover:bg-slate-100 hover:text-stone-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="rounded-md bg-accent px-2.5 py-1 font-medium text-white shadow-sm transition-colors hover:bg-accent-600 disabled:opacity-50"
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
      className={`group flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors duration-150 ease-out-soft ${
        active
          ? "bg-accent-50 text-accent-700"
          : "text-stone-700 hover:bg-slate-100/70"
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="focus-ring flex flex-1 items-center gap-2.5 rounded text-left text-[13px]"
      >
        <span
          aria-hidden
          className="inline-block h-2 w-2 flex-none rounded-full ring-1 ring-inset ring-black/5"
          style={{ backgroundColor: project.colour }}
        />
        <span className={`truncate ${active ? "font-medium" : ""}`}>{project.name}</span>
        {!project.is_personal && (
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-stone-500">
            work
          </span>
        )}
      </button>
      <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
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
      className="rounded-md p-1 text-stone-400 transition-colors duration-150 hover:bg-slate-100 hover:text-stone-700"
    >
      {children}
    </button>
  );
}

function ListIcon({ active }: { active?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`h-3.5 w-3.5 flex-none ${active ? "text-accent" : "text-stone-400"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M5.5 4h7M5.5 8h7M5.5 12h7M3 4h.01M3 8h.01M3 12h.01" strokeLinecap="round" />
    </svg>
  );
}

function FocusIcon({ active }: { active?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`h-3.5 w-3.5 ${active ? "text-accent" : "text-stone-500"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="8" cy="8" r="5.5" />
      <circle cx="8" cy="8" r="2.5" />
    </svg>
  );
}

function CalendarIcon({ active }: { active?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`h-3.5 w-3.5 ${active ? "text-accent" : "text-stone-500"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="2" y="3.5" width="12" height="10.5" rx="2" />
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
      <path
        d="M3 4.5h10M6 4.5V3a1 1 0 011-1h2a1 1 0 011 1v1.5M4.5 4.5l.75 8.5a1 1 0 001 .92h3.5a1 1 0 001-.92l.75-8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
