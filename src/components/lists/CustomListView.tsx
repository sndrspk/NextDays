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
    <div className="flex h-full flex-col px-8 py-6">
      <header className="mb-6 flex items-center gap-3">
        <h2 className="text-2xl font-semibold tracking-tight text-stone-900">{list.name}</h2>
        <span className="text-[11px] uppercase tracking-[0.12em] text-stone-400">List</span>
      </header>

      <div className="mb-4 flex gap-1 text-xs">
        {(["active", "completed", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1 capitalize ${
              filter === f
                ? "bg-stone-900 text-white"
                : "bg-transparent text-stone-500 hover:text-stone-900"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto rounded-lg border border-stone-200 bg-white">
        {itemsQuery.isLoading ? (
          <p className="p-6 text-sm text-stone-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-stone-400">No items.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {filtered.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </ul>
        )}
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
      <div className="flex items-center gap-3 px-4 py-2 hover:bg-stone-50">
        <button
          type="button"
          aria-label={item.completed ? "Mark item incomplete" : "Mark item complete"}
          onClick={() => toggle.mutate(item)}
          disabled={toggle.isPending}
          className={`inline-flex h-3.5 w-3.5 flex-none items-center justify-center rounded-[3px] border ${
            item.completed
              ? "border-stone-300 bg-stone-200 text-stone-500"
              : "border-stone-400 hover:border-stone-700"
          } disabled:opacity-50`}
        >
          {item.completed && (
            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          className={`flex-1 bg-transparent text-sm focus:outline-none ${
            item.completed ? "text-stone-400 line-through" : "text-stone-800"
          }`}
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Hide notes" : "Show notes"}
          className="rounded p-1 text-stone-300 opacity-0 transition hover:bg-stone-200/70 hover:text-stone-600 group-hover:opacity-100"
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
          className="rounded p-1 text-stone-300 opacity-0 transition hover:bg-stone-200/70 hover:text-red-600 group-hover:opacity-100 disabled:opacity-50"
        >
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 4.5h10M6 4.5V3a1 1 0 011-1h2a1 1 0 011 1v1.5M4.5 4.5l.75 8.5a1 1 0 001 .92h3.5a1 1 0 001-.92l.75-8.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {expanded && (
        <div className="px-4 pb-3 pl-11">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder="Notes…"
            rows={2}
            className="w-full resize-y rounded-md border border-stone-200 bg-stone-50 px-2 py-1.5 text-xs text-stone-700 placeholder:text-stone-300 focus:border-stone-400 focus:outline-none"
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
      className="border-t border-stone-100 px-4 py-2"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="+ Add item"
        disabled={create.isPending}
        className="w-full bg-transparent text-sm text-stone-700 placeholder:text-stone-300 focus:outline-none disabled:opacity-50"
      />
    </form>
  );
}
