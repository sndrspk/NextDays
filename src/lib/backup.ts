import { supabase } from "./supabase";
import type {
  CustomList,
  CustomListItem,
  Project,
  Task,
  TaskTemplate,
} from "../types";

export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupEnvelope {
  schema_version: number;
  exported_at: string;
  app: "nextdays";
  projects: Project[];
  task_templates: TaskTemplate[];
  tasks: Task[];
  custom_lists: CustomList[];
  custom_list_items: CustomListItem[];
}

export interface BackupCounts {
  projects: number;
  task_templates: number;
  tasks: number;
  custom_lists: number;
  custom_list_items: number;
}

export type ImportMode = "merge" | "replace";

// Backups travel between sessions / accounts. user_id is server-stamped on
// every insert via the column default (auth.uid()), so stripping it here
// avoids RLS rejecting rows whose user_id doesn't match the current session.
function stripUserId<T extends Record<string, unknown>>(row: T): T {
  const { user_id: _userId, ...rest } = row as T & { user_id?: unknown };
  return rest as T;
}

export async function exportAll(): Promise<BackupEnvelope> {
  const [projects, templates, tasks, lists, items] = await Promise.all([
    supabase.from("projects").select("*"),
    supabase.from("task_templates").select("*"),
    supabase.from("tasks").select("*"),
    supabase.from("custom_lists").select("*"),
    supabase.from("custom_list_items").select("*"),
  ]);

  for (const r of [projects, templates, tasks, lists, items]) {
    if (r.error) throw r.error;
  }

  return {
    schema_version: BACKUP_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    app: "nextdays",
    projects: (projects.data ?? []) as Project[],
    task_templates: (templates.data ?? []) as TaskTemplate[],
    tasks: (tasks.data ?? []) as Task[],
    custom_lists: (lists.data ?? []) as CustomList[],
    custom_list_items: (items.data ?? []) as CustomListItem[],
  };
}

export function downloadBackup(envelope: BackupEnvelope, filename?: string) {
  const stamp = envelope.exported_at.slice(0, 19).replace(/[T:]/g, "-");
  const name = filename ?? `nextdays-backup-${stamp}.json`;
  const blob = new Blob([JSON.stringify(envelope, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function countBackup(envelope: BackupEnvelope): BackupCounts {
  return {
    projects: envelope.projects.length,
    task_templates: envelope.task_templates.length,
    tasks: envelope.tasks.length,
    custom_lists: envelope.custom_lists.length,
    custom_list_items: envelope.custom_list_items.length,
  };
}

export function parseBackup(raw: string): BackupEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error("File isn't valid JSON.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("File doesn't look like a backup (not a JSON object).");
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.app !== "nextdays") {
    throw new Error("This file isn't a NextDays backup.");
  }
  if (typeof obj.schema_version !== "number") {
    throw new Error("Backup is missing a schema_version.");
  }
  if (obj.schema_version !== BACKUP_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported backup schema version: ${obj.schema_version}. This app expects ${BACKUP_SCHEMA_VERSION}.`,
    );
  }
  for (const key of [
    "projects",
    "task_templates",
    "tasks",
    "custom_lists",
    "custom_list_items",
  ]) {
    if (!Array.isArray(obj[key])) {
      throw new Error(`Backup is missing or malformed "${key}".`);
    }
  }
  return parsed as BackupEnvelope;
}

// Supabase REST refuses to send DELETE without a filter, so we use a never-
// matching id sentinel to force a bare "delete all my rows" (RLS scopes it
// to the current user automatically).
const SENTINEL_ID = "00000000-0000-0000-0000-000000000000";

async function wipeAll(): Promise<void> {
  // Order matters: children first to satisfy FKs.
  const tablesInOrder = [
    "custom_list_items",
    "custom_lists",
    "tasks",
    "task_templates",
    "projects",
  ] as const;
  for (const table of tablesInOrder) {
    const { error } = await supabase.from(table).delete().neq("id", SENTINEL_ID);
    if (error) throw new Error(`Failed to clear ${table}: ${error.message}`);
  }
}

async function upsertRows<T extends { id: string }>(
  table: string,
  rows: T[],
  mode: ImportMode,
): Promise<void> {
  if (rows.length === 0) return;
  const payload = rows.map(stripUserId);
  // In replace mode the table is already empty; an INSERT works.
  // In merge mode we want "skip if id already exists" — upsert with
  // ignoreDuplicates does exactly that.
  if (mode === "merge") {
    const { error } = await supabase
      .from(table)
      .upsert(payload, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw new Error(`Failed to import ${table}: ${error.message}`);
  } else {
    const { error } = await supabase.from(table).insert(payload);
    if (error) throw new Error(`Failed to import ${table}: ${error.message}`);
  }
}

export async function importBackup(
  envelope: BackupEnvelope,
  mode: ImportMode,
): Promise<BackupCounts> {
  if (mode === "replace") {
    await wipeAll();
  }
  // Insert parents before children so FKs resolve.
  await upsertRows("projects", envelope.projects, mode);
  await upsertRows("task_templates", envelope.task_templates, mode);
  await upsertRows("tasks", envelope.tasks, mode);
  await upsertRows("custom_lists", envelope.custom_lists, mode);
  await upsertRows("custom_list_items", envelope.custom_list_items, mode);
  return countBackup(envelope);
}
