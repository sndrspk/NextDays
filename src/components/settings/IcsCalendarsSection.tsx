import { useState } from "react";
import { useSettings } from "../../state/settings";
import { useExternalEvents } from "../../hooks/useExternalEvents";
import { PROJECT_COLOURS, DEFAULT_PROJECT_COLOUR } from "../../lib/projectColours";
import type { IcsCalendar } from "../../lib/ics";

export default function IcsCalendarsSection() {
  const { icsCalendars } = useSettings();
  const { errors, fetchedAt, isFetching, refresh } = useExternalEvents();

  const errorByCalendar = new Map(errors.map((e) => [e.calendarId, e.message]));

  return (
    <div className="space-y-4">
      <AddCalendarForm />

      {icsCalendars.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 bg-white">
          {icsCalendars.map((cal) => (
            <CalendarRow
              key={cal.id}
              calendar={cal}
              error={errorByCalendar.get(cal.id)}
              fetchedAt={fetchedAt.get(cal.id)}
            />
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-stone-400">
          Stored locally on this device — not included in backups. Requires the
          provider to allow cross-origin requests (Google's public ICS works;
          iCloud and Outlook often don't).
        </p>
        {icsCalendars.length > 0 && (
          <button
            type="button"
            onClick={refresh}
            disabled={isFetching}
            className="focus-ring flex-none rounded-md border border-slate-200/80 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            {isFetching ? "Refreshing…" : "Refresh all"}
          </button>
        )}
      </div>
    </div>
  );
}

function AddCalendarForm() {
  const { addIcsCalendar } = useSettings();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [colour, setColour] = useState<string>(DEFAULT_PROJECT_COLOUR);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Paste an .ics URL.");
      return;
    }
    try {
      new URL(trimmed);
    } catch {
      setError("That doesn't look like a valid URL.");
      return;
    }
    setError(null);
    addIcsCalendar({ url: trimmed, name: name.trim() || undefined, colour });
    setUrl("");
    setName("");
    setColour(DEFAULT_PROJECT_COLOUR);
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://calendar.example.com/feed.ics"
          className="focus-ring flex-1 rounded-md border border-slate-200/80 bg-white px-2.5 py-1.5 text-[12px] text-stone-800 focus:border-accent/60 focus:outline-none"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (optional)"
          className="focus-ring rounded-md border border-slate-200/80 bg-white px-2.5 py-1.5 text-[12px] text-stone-800 focus:border-accent/60 focus:outline-none sm:w-44"
        />
      </div>
      <div className="flex items-center gap-3">
        <ColourSwatches selected={colour} onSelect={setColour} />
        <button
          type="submit"
          className="focus-ring rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-accent-700"
        >
          Add calendar
        </button>
      </div>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </form>
  );
}

function ColourSwatches({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (c: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PROJECT_COLOURS.map((c) => {
        const isSelected = c === selected;
        return (
          <button
            key={c}
            type="button"
            aria-label={`Choose colour ${c}`}
            onClick={() => onSelect(c)}
            className={`h-5 w-5 rounded-full border transition-transform ${
              isSelected
                ? "scale-110 border-stone-900 ring-2 ring-stone-900/20"
                : "border-stone-200 hover:scale-105"
            }`}
            style={{ backgroundColor: c }}
          />
        );
      })}
    </div>
  );
}

function CalendarRow({
  calendar,
  error,
  fetchedAt,
}: {
  calendar: IcsCalendar;
  error?: string;
  fetchedAt?: string;
}) {
  const { updateIcsCalendar, removeIcsCalendar } = useSettings();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(calendar.name);
  const [showColour, setShowColour] = useState(false);
  const [showUrl, setShowUrl] = useState(false);

  function commitName() {
    const next = nameDraft.trim();
    if (next && next !== calendar.name) {
      updateIcsCalendar(calendar.id, { name: next });
    } else {
      setNameDraft(calendar.name);
    }
    setEditingName(false);
  }

  function onDelete() {
    if (!window.confirm(`Remove calendar "${calendar.name}"?`)) return;
    removeIcsCalendar(calendar.id);
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-3 text-[13px]">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setShowColour((s) => !s)}
          aria-label="Change calendar colour"
          className="h-4 w-4 flex-none rounded-full border border-stone-200"
          style={{ backgroundColor: calendar.colour }}
        />
        <div className="min-w-0 flex-1">
          {editingName ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitName();
                } else if (e.key === "Escape") {
                  setNameDraft(calendar.name);
                  setEditingName(false);
                }
              }}
              className="focus-ring w-full rounded-md border border-slate-200/80 bg-white px-2 py-1 text-[13px] text-stone-800 focus:border-accent/60 focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setNameDraft(calendar.name);
                setEditingName(true);
              }}
              className="truncate font-medium text-stone-800 hover:text-accent-700"
            >
              {calendar.name}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowUrl((s) => !s)}
            className="block w-full truncate text-left font-mono text-[11px] text-stone-400 hover:text-stone-600"
          >
            {showUrl ? calendar.url : `${calendar.url.slice(0, 60)}${calendar.url.length > 60 ? "…" : ""}`}
          </button>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="focus-ring rounded-md border border-red-200/70 bg-white px-2 py-1 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          Remove
        </button>
      </div>

      {showColour && (
        <div className="pl-7">
          <ColourSwatches
            selected={calendar.colour}
            onSelect={(c) => {
              updateIcsCalendar(calendar.id, { colour: c });
              setShowColour(false);
            }}
          />
        </div>
      )}

      <div className="flex items-center gap-2 pl-7 text-[11px]">
        {error ? (
          <span className="text-red-600">⚠ {error}</span>
        ) : fetchedAt ? (
          <span className="text-stone-400">
            Last synced {formatRelative(fetchedAt)}
          </span>
        ) : (
          <span className="text-stone-400">Syncing…</span>
        )}
      </div>
    </li>
  );
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
