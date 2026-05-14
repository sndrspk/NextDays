import type { Project, UUID } from "../types";

export interface ParsedTaskTitle {
  title: string;
  project_id: UUID | null;
  tags: string[];
}

const PROJECT_TOKEN = /(^|\s)@([A-Za-z0-9_-]+)/g;
const TAG_TOKEN = /(^|\s)#([A-Za-z0-9_-]+)/g;

// Parses inline `@Project` (only kept if a project with that name — case-
// insensitive — exists) and `#tag` (always kept) tokens out of a task title,
// returning the stripped title plus the resolved project_id and tag list.
// Only the first matching @Project wins; tags accumulate (deduped, original
// casing preserved).
export function parseTaskTitle(raw: string, projects: Project[]): ParsedTaskTitle {
  const byName = new Map<string, Project>();
  for (const p of projects) byName.set(p.name.toLowerCase(), p);

  let project_id: UUID | null = null;
  let title = raw.replace(PROJECT_TOKEN, (full, prefix, name) => {
    if (project_id !== null) return full;
    const found = byName.get(String(name).toLowerCase());
    if (!found) return full;
    project_id = found.id;
    return prefix;
  });

  const seenTags = new Set<string>();
  const tags: string[] = [];
  title = title.replace(TAG_TOKEN, (_full, prefix, name) => {
    const key = String(name).toLowerCase();
    if (!seenTags.has(key)) {
      seenTags.add(key);
      tags.push(String(name));
    }
    return prefix;
  });

  title = title.replace(/\s+/g, " ").trim();
  return { title, project_id, tags };
}
