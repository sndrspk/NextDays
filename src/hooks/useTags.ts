import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, supabaseConfigured } from "../lib/supabase";

export interface TagUsage {
  name: string;
  taskCount: number;
  templateCount: number;
}

// Aggregates every distinct tag value across `tasks` and `task_templates` for
// the current user (RLS already scopes both reads). Sorted alphabetically,
// case-insensitive. Two records that differ only by casing are merged under
// the first-seen spelling.
export function useTags() {
  return useQuery({
    enabled: supabaseConfigured,
    queryKey: ["tags"],
    queryFn: async (): Promise<TagUsage[]> => {
      const [tasksRes, templatesRes] = await Promise.all([
        supabase.from("tasks").select("tags"),
        supabase.from("task_templates").select("tags"),
      ]);
      if (tasksRes.error) throw tasksRes.error;
      if (templatesRes.error) throw templatesRes.error;

      const byKey = new Map<string, TagUsage>();
      for (const row of (tasksRes.data ?? []) as { tags: string[] | null }[]) {
        for (const tag of row.tags ?? []) {
          const key = tag.toLowerCase();
          const existing = byKey.get(key);
          if (existing) existing.taskCount += 1;
          else byKey.set(key, { name: tag, taskCount: 1, templateCount: 0 });
        }
      }
      for (const row of (templatesRes.data ?? []) as { tags: string[] | null }[]) {
        for (const tag of row.tags ?? []) {
          const key = tag.toLowerCase();
          const existing = byKey.get(key);
          if (existing) existing.templateCount += 1;
          else byKey.set(key, { name: tag, taskCount: 0, templateCount: 1 });
        }
      }
      return [...byKey.values()].sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
      );
    },
  });
}

interface RowWithTags {
  id: string;
  tags: string[] | null;
}

async function rewriteTagOnTable(
  table: "tasks" | "task_templates",
  match: string,
  transform: (tags: string[]) => string[],
) {
  const matchKey = match.toLowerCase();
  const { data, error } = await supabase
    .from(table)
    .select("id, tags")
    .contains("tags", [match]);
  if (error) throw error;

  // `contains` is case-sensitive; also collect rows whose tags include any
  // case variant of the same name so renames/deletes are exhaustive.
  const rows = (data ?? []) as RowWithTags[];
  const updates = rows
    .map((row) => {
      const before = row.tags ?? [];
      const hit = before.some((t) => t.toLowerCase() === matchKey);
      if (!hit) return null;
      const after = transform(before);
      return { id: row.id, before, after };
    })
    .filter((u): u is { id: string; before: string[]; after: string[] } => u !== null);

  for (const u of updates) {
    const { error: updateError } = await supabase
      .from(table)
      .update({ tags: u.after })
      .eq("id", u.id);
    if (updateError) throw updateError;
  }
}

export function useRenameTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ from, to }: { from: string; to: string }) => {
      const target = to.trim();
      if (!target) throw new Error("Tag name cannot be empty.");
      const fromKey = from.toLowerCase();
      const transform = (tags: string[]): string[] => {
        const out: string[] = [];
        const seen = new Set<string>();
        for (const t of tags) {
          const next = t.toLowerCase() === fromKey ? target : t;
          const key = next.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(next);
        }
        return out;
      };
      await rewriteTagOnTable("tasks", from, transform);
      await rewriteTagOnTable("task_templates", from, transform);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["task_templates"] });
    },
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tag: string) => {
      const key = tag.toLowerCase();
      const transform = (tags: string[]): string[] =>
        tags.filter((t) => t.toLowerCase() !== key);
      await rewriteTagOnTable("tasks", tag, transform);
      await rewriteTagOnTable("task_templates", tag, transform);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["task_templates"] });
    },
  });
}
