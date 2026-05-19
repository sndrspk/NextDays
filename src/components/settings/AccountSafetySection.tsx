import { useState } from "react";
import {
  countBackup,
  downloadBackup,
  exportAll,
  type BackupCounts,
} from "../../lib/backup";

type Status =
  | { kind: "idle" }
  | { kind: "exporting" }
  | { kind: "exported"; counts: BackupCounts; at: string }
  | { kind: "error"; message: string };

// Deleting an account in Supabase (dashboard or future in-app button) cascades
// through every row in every owned table. We can't change that without going
// to soft-delete (Phase C in SECURITYPLAN), so the cheapest defense is to make
// the JSON backup unmissable, with one click, right where a destructive flow
// would naturally land.
export default function AccountSafetySection() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleExport() {
    setStatus({ kind: "exporting" });
    try {
      const envelope = await exportAll();
      downloadBackup(envelope);
      setStatus({
        kind: "exported",
        counts: countBackup(envelope),
        at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3.5 py-3 text-[12px] leading-relaxed text-amber-900">
        <div className="mb-1 font-semibold">Before deleting your account</div>
        <p className="text-[12px] text-amber-900/90">
          Deleting your Supabase account wipes every project, task, list, recurrence,
          and calendar subscription — the deletion cascades and cannot be undone.
          Download a backup first, every time. You can re-import it later in
          Backup &amp; Restore, on any account.
        </p>
      </div>

      <button
        type="button"
        onClick={handleExport}
        disabled={status.kind === "exporting"}
        className="focus-ring inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
      >
        {status.kind === "exporting" ? "Preparing…" : "Download backup now"}
      </button>

      {status.kind === "exported" && (
        <p className="text-[11px] text-stone-500">
          Saved {summary(status.counts)} at {status.at}.
        </p>
      )}

      {status.kind === "error" && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">
          {status.message}
        </p>
      )}
    </div>
  );
}

function summary(c: BackupCounts): string {
  const parts: string[] = [];
  parts.push(`${c.projects} project${c.projects === 1 ? "" : "s"}`);
  parts.push(`${c.tasks} task${c.tasks === 1 ? "" : "s"}`);
  parts.push(`${c.custom_lists} list${c.custom_lists === 1 ? "" : "s"}`);
  if (c.task_templates > 0) {
    parts.push(`${c.task_templates} recurrence${c.task_templates === 1 ? "" : "s"}`);
  }
  if (c.ics_calendars > 0) {
    parts.push(`${c.ics_calendars} calendar${c.ics_calendars === 1 ? "" : "s"}`);
  }
  return parts.join(", ");
}
