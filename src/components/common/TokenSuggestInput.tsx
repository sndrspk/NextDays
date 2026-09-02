import { useEffect, useMemo, useRef, useState } from "react";
import { useProjects } from "../../hooks/useProjects";
import { useTags, type TagUsage } from "../../hooks/useTags";
import type { Project } from "../../types";
import {
  acceptCsv,
  acceptInline,
  csvOtherValues,
  csvTokenAt,
  filterSuggestions,
  inlineTokenAt,
  type ActiveToken,
} from "../../lib/tokenSuggest";

interface TokenSuggestInputProps {
  value: string;
  onChange: (next: string) => void;
  /**
   * "inline" reads `#tag` / `@Project` tokens out of free text (task titles);
   * "csv" completes one segment of a comma-separated tag field.
   */
  mode: "inline" | "csv";
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Classes for the wrapper; it is `relative` so the dropdown can anchor to it. */
  wrapperClassName?: string;
  /** Quick-adds sit at the bottom of a column, so their list opens upwards. */
  placement?: "below" | "above";
  inputRef?: React.RefObject<HTMLInputElement | null>;
  "aria-label"?: string;
}

const MAX_SUGGESTIONS = 6;
const EMPTY_TAGS: TagUsage[] = [];
const EMPTY_PROJECTS: Project[] = [];
const EMPTY_NAMES: string[] = [];

// A text input that suggests existing tags (and projects) as you type. Used by
// every quick-add, the Add task form, and the task detail panel, so the same
// keyboard behaviour applies everywhere: ↑/↓ to move, Enter or Tab to accept,
// Escape to dismiss the list without closing the surrounding view.
export default function TokenSuggestInput({
  value,
  onChange,
  mode,
  placeholder,
  disabled,
  className = "",
  wrapperClassName = "relative w-full",
  placement = "below",
  inputRef,
  "aria-label": ariaLabel,
}: TokenSuggestInputProps) {
  const localRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? localRef;
  const pendingCaret = useRef<number | null>(null);

  const [caret, setCaret] = useState(0);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const tags = useTags().data ?? EMPTY_TAGS;
  const projects = useProjects().data ?? EMPTY_PROJECTS;
  const tagNames = useMemo(() => tags.map((t) => t.name), [tags]);
  const projectNames = useMemo(() => projects.map((p) => p.name), [projects]);

  const token: ActiveToken | null = useMemo(() => {
    if (mode === "inline") return inlineTokenAt(value, caret);
    const csv = csvTokenAt(value, caret);
    // A csv field has no sigil to signal intent, so wait for a first letter.
    return csv && csv.query.trim().length > 0 ? csv : null;
  }, [mode, value, caret]);

  const suggestions = useMemo(() => {
    if (!token) return EMPTY_NAMES;
    const candidates = token.kind === "tag" ? tagNames : projectNames;
    const exclude = mode === "csv" ? csvOtherValues(value, token) : EMPTY_NAMES;
    return filterSuggestions(candidates, token.query, { limit: MAX_SUGGESTIONS, exclude });
  }, [token, mode, value, tagNames, projectNames]);

  const showing = open && !disabled && suggestions.length > 0;

  useEffect(() => {
    setActive(0);
  }, [token?.kind, token?.query]);

  // The value is controlled by the parent, so the caret can only be restored
  // once the new value has been rendered back down.
  useEffect(() => {
    const next = pendingCaret.current;
    if (next == null) return;
    pendingCaret.current = null;
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(next, next);
    setCaret(next);
  }, [value, ref]);

  function accept(index: number) {
    const name = suggestions[index];
    if (!token || name === undefined) return;
    const result =
      mode === "inline" ? acceptInline(value, token, name) : acceptCsv(value, token, name);
    pendingCaret.current = result.caret;
    onChange(result.value);
    setOpen(false);
  }

  function syncCaret(el: HTMLInputElement) {
    setCaret(el.selectionStart ?? el.value.length);
  }

  return (
    <div className={wrapperClassName}>
      <input
        ref={ref}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        autoComplete="off"
        role="combobox"
        aria-expanded={showing}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        onChange={(e) => {
          onChange(e.target.value);
          syncCaret(e.target);
          setOpen(true);
        }}
        onKeyUp={(e) => syncCaret(e.currentTarget)}
        onClick={(e) => {
          syncCaret(e.currentTarget);
          setOpen(true);
        }}
        onFocus={(e) => syncCaret(e.currentTarget)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!showing) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
          } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            accept(active);
          } else if (e.key === "Escape") {
            // Keep the window-level Escape handlers (close panel / leave view)
            // from firing while the list is only being dismissed.
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          }
        }}
      />

      {showing && (
        <ul
          role="listbox"
          className={`absolute left-0 z-30 max-h-56 w-full min-w-[9rem] max-w-[18rem] overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-panel ${
            placement === "above" ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          {suggestions.map((name, i) => {
            const usage = token?.kind === "tag" ? tags.find((t) => t.name === name) : undefined;
            const count = usage ? usage.taskCount + usage.templateCount : 0;
            return (
              <li key={name}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => accept(i)}
                  className={`flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-[12px] transition-colors ${
                    i === active
                      ? "bg-accent-50 text-accent-700"
                      : "text-stone-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate">
                    {mode === "inline" && (
                      <span className="text-stone-400">
                        {token?.kind === "tag" ? "#" : "@"}
                      </span>
                    )}
                    {name}
                  </span>
                  {count > 0 && (
                    <span className="flex-none text-[10px] text-stone-400">{count}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
