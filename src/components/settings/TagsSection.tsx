import { useState } from "react";
import { useDeleteTag, useRenameTag, useTags, type TagUsage } from "../../hooks/useTags";

export default function TagsSection() {
  const tagsQuery = useTags();
  const tags = tagsQuery.data ?? [];

  if (tagsQuery.isLoading) {
    return <p className="text-[12px] text-stone-500">Loading tags…</p>;
  }

  if (tags.length === 0) {
    return (
      <p className="text-[12px] text-stone-500">
        No tags yet. Add a <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px] text-stone-700">#tag</code>{" "}
        in a task title to create one.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 bg-white">
      {tags.map((tag) => (
        <TagRow key={tag.name.toLowerCase()} tag={tag} />
      ))}
    </ul>
  );
}

function TagRow({ tag }: { tag: TagUsage }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tag.name);
  const rename = useRenameTag();
  const remove = useDeleteTag();
  const total = tag.taskCount + tag.templateCount;

  function startEdit() {
    setDraft(tag.name);
    setEditing(true);
  }

  function commitEdit() {
    const target = draft.trim();
    if (!target || target === tag.name) {
      setEditing(false);
      return;
    }
    rename.mutate(
      { from: tag.name, to: target },
      {
        onSuccess: () => setEditing(false),
      },
    );
  }

  function onDelete() {
    if (
      !window.confirm(
        `Delete tag "${tag.name}"? It will be removed from ${total} ${
          total === 1 ? "item" : "items"
        }.`,
      )
    ) {
      return;
    }
    remove.mutate(tag.name);
  }

  const pending = rename.isPending || remove.isPending;

  return (
    <li className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
      <span className="flex-1 truncate">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitEdit();
              } else if (e.key === "Escape") {
                setEditing(false);
              }
            }}
            disabled={pending}
            className="focus-ring w-full rounded-md border border-slate-200/80 bg-white px-2 py-1 text-[13px] text-stone-800 focus:border-accent/60 focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={startEdit}
            className="rounded-full bg-slate-100 px-2 py-0.5 text-[12px] font-medium text-stone-600 transition-colors hover:bg-slate-200/70 hover:text-stone-900"
          >
            #{tag.name}
          </button>
        )}
      </span>
      <span className="flex-none text-[11px] text-stone-400">
        {total} {total === 1 ? "use" : "uses"}
      </span>
      <div className="flex flex-none items-center gap-1.5">
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            disabled={pending}
            className="focus-ring rounded-md border border-slate-200/80 bg-white px-2 py-1 text-[11px] font-medium text-stone-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Rename
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="focus-ring rounded-md border border-red-200/70 bg-white px-2 py-1 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </li>
  );
}
