import { useMemo, useState } from "react";
import { useCustomLists } from "../../hooks/useCustomLists";
import {
  useCreateCustomListItem,
  useCustomListItems,
  useDeleteCustomListItem,
  useToggleCustomListItem,
  useUpdateCustomListItem,
} from "../../hooks/useCustomListItems";
import type { CustomListItem, UUID } from "../../types";

type Filter = "active" | "completed" | "all";

interface CustomListViewProps {
  listId: UUID;
}

export default function CustomListView({ listId }: CustomListViewProps) {
  const listsQuery = useCustomLists();
  const itemsQuery = useCustomListItems(listId);
  const [filter, setFilter] = useState<Filter>("active");

  const list = listsQuery.data?.find((l) => l.id === listId);

  const filtered = useMemo(() => {
    const all = itemsQuery.data ?? [];
    if (filter === "active") return all.filter((i) => !i.completed);
    if (filter === "completed") return all.filter((i) => i.completed);
    return all;
  }, [itemsQuery.data, filter]);

  if (!list) {
    return (
      <div className="p-8 text-sm text-stone-500">
        {listsQuery.isLoading ? "Loading…" : "List not found."}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col px-4 py-5 sm:px-8 sm:py-8 lg:px-10">
      <header className="mb-5 flex flex-wrap items-center gap-2.5 sm:mb-6 sm:gap-3">
        <h2 className="text-[22px] font-semibold tracking-tight text-stone-900 sm:text-[26px]">
          {list.name}
        </h2>
        <span className="rounded-full border border-slate-200/80 bg-white/70 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
          List
        </span>
      </header>

      <div className="inline-flex w-fit gap-0.5 rounded-lg border border-slate-200/80 bg-white/60 p-0.5 text-[12px]">
        {(["active", "completed", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`focus-ring rounded-md px-3 py-1 font-medium capitalize transition-all duration-150 ease-out-soft ${
              filter === f
                ? "bg-accent-50 text-accent-700"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95">
        <div className="flex-1 overflow-y-auto">
          {itemsQuery.isLoading ? (
            <p className="p-8 text-sm text-stone-400">Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 px-6 py-16 text-center">
              <p className="text-sm font-medium text-stone-600">No items yet</p>
              <p className="text-xs text-stone-400">Add one below to get started.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((item) => (
                <ItemRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </div>
        <AddItemRow listId={listId} />
      </div>
    </div>
  );
}

function ItemRow({ item }: { item: CustomListItem }) {
  const toggle = useToggleCustomListItem();
  const update = useUpdateCustomListItem();
  const del = useDeleteCustomListItem();
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [notes, setNotes] = useState(item.notes ?? "");

  function saveTitle() {
    const trimmed = title.trim();
    if (!trimmed || trimmed === item.title) {
      setTitle(item.title);
      return;
    }
    update.mutate({ id: item.id, patch: { title: trimmed } });
  }

  function saveNotes() {
    const next = notes.trim() === "" ? null : notes;
    if (next === (item.notes ?? null)) return;
    update.mutate({ id: item.id, patch: { notes: next } });
  }

  return (
    <li className="group">
      <div className="flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 ease-out-soft hover:bg-slate-50 sm:px-5">
        <button
          type="button"
          aria-label={item.completed ? "Mark item incomplete" : "Mark item complete"}
          onClick={() => toggle.mutate(item)}
          disabled={toggle.isPending}
          className={`focus-ring inline-flex h-4 w-4 flex-none items-center justify-center rounded-full border transition-all duration-150 ease-out-soft ${
            item.completed
              ? "border-accent bg-accent text-white"
              : "border-stone-300 bg-white hover:border-accent/60 hover:shadow-sm"
          } disabled:opacity-50`}
        >
          {item.completed && (
            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="2.5,6.5 5,9 9.5,3.5" />
            </svg>
          )}
        </button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === "Escape") {
              setTitle(item.title);
              (e.target as HTMLInputElement).blur();
            }
          }}
          className={`flex-1 bg-transparent text-[13px] focus:outline-none ${
            item.completed ? "text-stone-400 line-through" : "text-stone-800"
          }`}
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Hide notes" : "Show notes"}
          className={`rounded-md p-1 transition-all duration-150 hover:bg-slate-100 hover:text-stone-600 ${
            expanded
              ? "text-stone-500 opacity-100"
              : "text-stone-300 opacity-0 group-hover:opacity-100"
          }`}
        >
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 5h10M3 8h10M3 11h7" strokeLinecap="round" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Delete item"
          onClick={() => del.mutate(item)}
          disabled={del.isPending}
          className="rounded-md p-1 text-stone-300 opacity-0 transition-all duration-150 hover:bg-slate-100 hover:text-red-600 group-hover:opacity-100 disabled:opacity-50"
        >
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 4.5h10M6 4.5V3a1 1 0 011-1h2a1 1 0 011 1v1.5M4.5 4.5l.75 8.5a1 1 0 001 .92h3.5a1 1 0 001-.92l.75-8.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {expanded && (
        <div className="animate-fade-up px-5 pb-3 pl-12">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder="Notes…"
            rows={2}
            className="focus-ring w-full resize-y rounded-lg border border-slate-200/80 bg-slate-50/60 px-2.5 py-2 text-[12px] leading-relaxed text-stone-700 placeholder:text-stone-300 focus:border-accent/60 focus:bg-white focus:outline-none"
          />
        </div>
      )}
    </li>
  );
}

function AddItemRow({ listId }: { listId: UUID }) {
  const [title, setTitle] = useState("");
  const create = useCreateCustomListItem();

  function submit() {
    const trimmed = title.trim();
    if (!trimmed || create.isPending) return;
    create.mutate(
      { list_id: listId, title: trimmed },
      { onSuccess: () => setTitle("") },
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex items-center gap-3 border-t border-slate-200/70 bg-slate-50/40 px-4 py-3 sm:px-5"
    >
      <span className="flex h-4 w-4 flex-none items-center justify-center rounded-full border border-dashed border-stone-300 text-[10px] text-stone-400">
        +
      </span>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add item"
        disabled={create.isPending}
        className="w-full bg-transparent text-[13px] text-stone-800 placeholder:text-stone-400 focus:outline-none disabled:opacity-50"
      />
    </form>
  );
}
