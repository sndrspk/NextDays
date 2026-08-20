import { useEffect, useRef, useState } from "react";
import { useDeleteTag, useRenameTag, useTags } from "../../hooks/useTags";
import { useToast } from "../../state/toast";

interface TagFilterRowProps {
  tags: string[];
  selected: Set<string>;
  onToggle: (tag: string) => void;
  onClear: () => void;
  /** Called after a successful rename so the caller can fix up its filter set. */
  onRenamed?: (from: string, to: string) => void;
  /** Called after a successful removal so the caller can drop it from its filter set. */
  onRemoved?: (tag: string) => void;
}

interface MenuState {
  tag: string;
  x: number;
  y: number;
}

const MENU_WIDTH = 150;
const MENU_HEIGHT = 76;

// Touch fallback for right-click. Android Chrome's long-press only sometimes
// produces a `contextmenu` event (it competes with text selection and varies
// by version) and iOS Safari doesn't play along at all, so touch devices get
// their own timer instead of relying on the platform.
const LONG_PRESS_MS = 500;
// Treat the press as a scroll, not a hold, once the finger travels this far.
const LONG_PRESS_SLOP_PX = 10;

/**
 * The tag chips above a task list. Left-click (or tap) filters; right-click,
 * long-press on touch, or the keyboard context-menu key on a focused chip
 * opens Rename / Remove, which act on the tag **everywhere** — every task and
 * recurrence template that carries it, not just the ones in view.
 */
export default function TagFilterRow({
  tags,
  selected,
  onToggle,
  onClear,
  onRenamed,
  onRemoved,
}: TagFilterRowProps) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const lastPointerType = useRef<string>("mouse");
  // Set when a menu was opened by touch, so the click that lands on finger-up
  // doesn't also toggle the filter.
  const swallowNextClick = useRef(false);
  const rename = useRenameTag();
  const remove = useDeleteTag();
  const tagsQuery = useTags();
  const { push } = useToast();

  const busy = rename.isPending || remove.isPending;

  function usageCount(tag: string): number {
    const key = tag.toLowerCase();
    const hit = (tagsQuery.data ?? []).find((t) => t.name.toLowerCase() === key);
    return hit ? hit.taskCount + hit.templateCount : 0;
  }

  function openMenu(e: React.MouseEvent, tag: string) {
    e.preventDefault();
    e.stopPropagation();
    // A contextmenu raised by a touch long-press is followed by a click on
    // finger-up; a mouse right-click is not.
    if (lastPointerType.current === "touch") swallowNextClick.current = true;
    cancelLongPress();
    setMenu({ tag, x: e.clientX, y: e.clientY });
  }

  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    pressOrigin.current = null;
  }

  function onPointerDown(e: React.PointerEvent, tag: string) {
    lastPointerType.current = e.pointerType;
    swallowNextClick.current = false;
    cancelLongPress();
    if (e.pointerType === "mouse") return;

    const { clientX: x, clientY: y } = e;
    pressOrigin.current = { x, y };
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      swallowNextClick.current = true;
      setMenu({ tag, x, y });
    }, LONG_PRESS_MS);
  }

  function onPointerMove(e: React.PointerEvent) {
    const origin = pressOrigin.current;
    if (!origin || !longPressTimer.current) return;
    const moved =
      Math.abs(e.clientX - origin.x) > LONG_PRESS_SLOP_PX ||
      Math.abs(e.clientY - origin.y) > LONG_PRESS_SLOP_PX;
    if (moved) cancelLongPress();
  }

  // Cleans up if the component unmounts mid-press.
  useEffect(() => cancelLongPress, []);

  function startRename(tag: string) {
    setMenu(null);
    setDraft(tag);
    setRenaming(tag);
  }

  function commitRename() {
    const from = renaming;
    if (!from) return;
    const to = draft.trim();
    if (!to || to === from) {
      setRenaming(null);
      return;
    }

    // A rename onto an existing tag merges the two — say so before doing it.
    const existing = (tagsQuery.data ?? []).find(
      (t) => t.name.toLowerCase() === to.toLowerCase() && t.name.toLowerCase() !== from.toLowerCase(),
    );
    if (existing) {
      const ok = window.confirm(
        `"${existing.name}" already exists. Merge "${from}" into it? Every task tagged "${from}" will be tagged "${existing.name}" instead.`,
      );
      if (!ok) return;
    }

    rename.mutate(
      { from, to },
      {
        onSuccess: () => {
          setRenaming(null);
          onRenamed?.(from, to);
          push({ message: existing ? `Merged into "${to}"` : `Tag renamed to "${to}"` });
        },
        onError: (error) => {
          push({
            message: `Rename failed: ${(error as { message?: string })?.message ?? "unknown error"}`,
          });
        },
      },
    );
  }

  function removeTag(tag: string) {
    setMenu(null);
    const count = usageCount(tag);
    const scope =
      count > 0 ? `${count} item${count === 1 ? "" : "s"}` : "every item that carries it";
    if (!window.confirm(`Remove the tag "${tag}" from ${scope}? This can't be undone.`)) return;

    remove.mutate(tag, {
      onSuccess: () => {
        onRemoved?.(tag);
        push({ message: `Tag "${tag}" removed` });
      },
      onError: (error) => {
        push({
          message: `Remove failed: ${(error as { message?: string })?.message ?? "unknown error"}`,
        });
      },
    });
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
        Tags
      </span>

      {tags.map((tag) => {
        if (renaming === tag) {
          return (
            <input
              key={tag}
              autoFocus
              value={draft}
              disabled={rename.isPending}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitRename();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setRenaming(null);
                }
              }}
              aria-label={`Rename tag ${tag}`}
              className="focus-ring w-28 rounded-full border border-accent/60 bg-white px-2.5 py-0.5 text-[11px] font-medium text-stone-800 focus:outline-none disabled:opacity-50"
            />
          );
        }

        const active = selected.has(tag);
        return (
          <button
            key={tag}
            type="button"
            disabled={busy}
            onClick={() => {
              if (swallowNextClick.current) {
                swallowNextClick.current = false;
                return;
              }
              onToggle(tag);
            }}
            onContextMenu={(e) => openMenu(e, tag)}
            onPointerDown={(e) => onPointerDown(e, tag)}
            onPointerMove={onPointerMove}
            onPointerUp={cancelLongPress}
            onPointerCancel={cancelLongPress}
            onPointerLeave={cancelLongPress}
            title={`${tag} — right-click or long-press to rename or remove`}
            style={{ WebkitTouchCallout: "none" }}
            className={`focus-ring select-none rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-50 ${
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

      <span className="ml-1 hidden text-[10px] text-stone-300 sm:inline">
        right-click or long-press a tag to rename or remove
      </span>

      {menu && (
        <TagContextMenu
          state={menu}
          onClose={() => setMenu(null)}
          onRename={() => startRename(menu.tag)}
          onRemove={() => removeTag(menu.tag)}
        />
      )}
    </div>
  );
}

function TagContextMenu({
  state,
  onClose,
  onRename,
  onRemove,
}: {
  state: MenuState;
  onClose: () => void;
  onRename: () => void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  // Keep the menu inside the viewport when a chip sits near an edge.
  const left = Math.max(8, Math.min(state.x, window.innerWidth - MENU_WIDTH - 8));
  const top = Math.max(8, Math.min(state.y, window.innerHeight - MENU_HEIGHT - 8));

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`Actions for tag ${state.tag}`}
      style={{ left, top, width: MENU_WIDTH }}
      className="fixed z-50 overflow-hidden rounded-lg border border-slate-200/80 bg-white py-1 shadow-panel"
    >
      <div className="truncate px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
        {state.tag}
      </div>
      <button
        type="button"
        role="menuitem"
        autoFocus
        onClick={onRename}
        className="block w-full px-3 py-1.5 text-left text-[12px] text-stone-700 transition-colors hover:bg-slate-100"
      >
        Rename…
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={onRemove}
        className="block w-full px-3 py-1.5 text-left text-[12px] text-red-600 transition-colors hover:bg-red-50"
      >
        Remove
      </button>
    </div>
  );
}
