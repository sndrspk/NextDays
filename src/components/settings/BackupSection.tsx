import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  BACKUP_SCHEMA_VERSION,
  countBackup,
  downloadBackup,
  exportAll,
  importBackup,
  parseBackup,
  type BackupCounts,
  type BackupEnvelope,
  type ImportMode,
} from "../../lib/backup";

type Status =
  | { kind: "idle" }
  | { kind: "exporting" }
  | { kind: "exported"; counts: BackupCounts }
  | { kind: "loaded"; envelope: BackupEnvelope; filename: string }
  | { kind: "importing" }
  | { kind: "imported"; counts: BackupCounts; mode: ImportMode }
  | { kind: "error"; message: string };

export default function BackupSection() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [mode, setMode] = useState<ImportMode>("merge");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setStatus({ kind: "exporting" });
    try {
      const envelope = await exportAll();
      downloadBackup(envelope);
      setStatus({ kind: "exported", counts: countBackup(envelope) });
    } catch (err) {
      setStatus({ kind: "error", message: messageOf(err) });
    }
  }

  function handleFileChosen(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const envelope = parseBackup(String(reader.result ?? ""));
        setStatus({ kind: "loaded", envelope, filename: file.name });
      } catch (err) {
        setStatus({ kind: "error", message: messageOf(err) });
      }
    };
    reader.onerror = () => setStatus({ kind: "error", message: "Couldn't read the file." });
    reader.readAsText(file);
  }

  async function handleImport() {
    if (status.kind !== "loaded") return;
    const counts = countBackup(status.envelope);
    if (mode === "replace") {
      const confirmed = window.confirm(
        `Replace ALL current data with this backup?\n\n` +
          `Current data will be deleted:\n` +
          `  • all projects, tasks, and recurrences\n` +
          `  • all custom lists and items\n\n` +
          `Restoring will insert:\n` +
          `  • ${counts.projects} projects\n` +
          `  • ${counts.tasks} tasks (${counts.task_templates} recurrence templates)\n` +
          `  • ${counts.custom_lists} lists (${counts.custom_list_items} items)\n\n` +
          `This cannot be undone.`,
      );
      if (!confirmed) return;
    }
    setStatus({ kind: "importing" });
    try {
      const applied = await importBackup(status.envelope, mode);
      qc.invalidateQueries();
      setStatus({ kind: "imported", counts: applied, mode });
    } catch (err) {
      setStatus({ kind: "error", message: messageOf(err) });
    }
  }

  const busy = status.kind === "exporting" || status.kind === "importing";

  return (
    <div className="space-y-6">
      <section>
        <SectionLabel>Export</SectionLabel>
        <p className="mb-3 text-[12px] leading-relaxed text-stone-500">
          Download a JSON snapshot of all your projects, tasks, recurrences,
          custom lists, and items. The file lives wherever you save it — keep it
          somewhere safe.
        </p>
        <button
          type="button"
          onClick={handleExport}
          disabled={busy}
          className="focus-ring inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
        >
          {status.kind === "exporting" ? "Preparing…" : "Download backup"}
        </button>
        {status.kind === "exported" && (
          <p className="mt-2 text-[11px] text-stone-500">
            Saved {summary(status.counts)}.
          </p>
        )}
      </section>

      <div className="border-t border-slate-200/70" />

      <section>
        <SectionLabel>Restore from file</SectionLabel>
        <p className="mb-3 text-[12px] leading-relaxed text-stone-500">
          Pick a previously exported NextDays backup. Schema version{" "}
          <code className="rounded bg-slate-100 px-1 py-px text-[10px]">
            {BACKUP_SCHEMA_VERSION}
          </code>{" "}
          files are supported.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileChosen(f);
          }}
          className="block w-full text-[12px] text-stone-600 file:mr-3 file:rounded-md file:border file:border-slate-200/80 file:bg-white file:px-2.5 file:py-1 file:text-[12px] file:font-medium file:text-stone-700 file:transition-colors hover:file:border-slate-300 hover:file:bg-slate-50"
        />

        {status.kind === "loaded" && (
          <div className="mt-3 rounded-lg border border-slate-200/80 bg-slate-50/60 px-3 py-2.5 text-[12px]">
            <div className="font-medium text-stone-800">{status.filename}</div>
            <div className="mt-0.5 text-[11px] text-stone-500">
              Contains {summary(countBackup(status.envelope))}.
            </div>
          </div>
        )}

        {(status.kind === "loaded" ||
          status.kind === "importing" ||
          status.kind === "imported") && (
          <>
            <fieldset className="mt-4 space-y-1.5 text-[12px]">
              <legend className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                Mode
              </legend>
              <ModeRadio
                name="merge"
                title="Merge"
                description="Skip rows whose ID already exists. Adds new items only, keeps current data."
                selected={mode === "merge"}
                onSelect={() => setMode("merge")}
                disabled={status.kind === "importing"}
              />
              <ModeRadio
                name="replace"
                title="Replace everything"
                description="Wipes ALL your current projects, tasks, lists, then inserts the backup. Cannot be undone."
                selected={mode === "replace"}
                onSelect={() => setMode("replace")}
                disabled={status.kind === "importing"}
                tone="danger"
              />
            </fieldset>

            {status.kind === "loaded" && (
              <button
                type="button"
                onClick={handleImport}
                disabled={busy}
                className={`focus-ring mt-4 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium text-white transition-colors disabled:opacity-50 ${
                  mode === "replace"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-accent hover:bg-accent-600"
                }`}
              >
                {mode === "replace" ? "Replace and restore" : "Merge backup"}
              </button>
            )}
          </>
        )}

        {status.kind === "importing" && (
          <p className="mt-3 text-[11px] text-stone-500">Restoring…</p>
        )}

        {status.kind === "imported" && (
          <p className="mt-3 rounded-lg bg-accent-50 px-3 py-2 text-[12px] text-accent-700">
            Restored {summary(status.counts)} ({status.mode}).
          </p>
        )}
      </section>

      {status.kind === "error" && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">
          {status.message}
        </p>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
      {children}
    </div>
  );
}

function ModeRadio({
  name,
  title,
  description,
  selected,
  onSelect,
  disabled,
  tone = "default",
}: {
  name: string;
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
}) {
  const accent =
    tone === "danger"
      ? selected
        ? "border-red-200 bg-red-50"
        : "border-slate-200/80 hover:border-slate-300"
      : selected
      ? "border-accent-100 bg-accent-50"
      : "border-slate-200/80 hover:border-slate-300";

  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 transition-colors ${accent} ${
        disabled ? "cursor-not-allowed opacity-60" : ""
      }`}
    >
      <input
        type="radio"
        name="backup-mode"
        value={name}
        checked={selected}
        onChange={onSelect}
        disabled={disabled}
        className="mt-0.5 h-3.5 w-3.5 accent-accent"
      />
      <span className="flex-1">
        <span
          className={`block text-[12px] font-medium ${
            tone === "danger" && selected ? "text-red-700" : "text-stone-800"
          }`}
        >
          {title}
        </span>
        <span className="block text-[11px] text-stone-500">{description}</span>
      </span>
    </label>
  );
}

function summary(c: BackupCounts): string {
  const parts: string[] = [];
  parts.push(`${c.projects} project${c.projects === 1 ? "" : "s"}`);
  parts.push(`${c.tasks} task${c.tasks === 1 ? "" : "s"}`);
  if (c.task_templates > 0) {
    parts.push(`${c.task_templates} recurrence${c.task_templates === 1 ? "" : "s"}`);
  }
  parts.push(`${c.custom_lists} list${c.custom_lists === 1 ? "" : "s"}`);
  if (c.custom_list_items > 0) {
    parts.push(`${c.custom_list_items} item${c.custom_list_items === 1 ? "" : "s"}`);
  }
  if (c.ics_calendars > 0) {
    parts.push(`${c.ics_calendars} calendar${c.ics_calendars === 1 ? "" : "s"}`);
  }
  return parts.join(", ");
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
