import type { Project, UUID } from "../types";

export interface ParsedTaskTitle {
  title: string;
  project_id: UUID | null;
  tags: string[];
}

const TAG_BODY = /^[A-Za-z0-9_-]+/;

// Parses inline `@Project` and `#tag` tokens out of a task title, returning the
// stripped title plus the resolved project_id and tag list.
//
// Rules:
//   * `@Name` is only consumed when a project with that name exists
//     (case-insensitive). Multi-word project names are matched greedily —
//     longest name wins — so `@Home Admin` works. An unknown `@word` is left
//     in the title untouched, and only the first match assigns the project.
//   * `#tag` is always consumed; the text behind the `#` becomes the tag as-is.
//     Tags are deduped case-insensitively, keeping the first spelling.
//   * Tokens must start the string or follow whitespace, so `a@b.com` and
//     `C#` are left alone.
export function parseTaskTitle(raw: string, projects: Project[]): ParsedTaskTitle {
  // Longest first so a project called "Home Admin" beats one called "Home".
  const byLength = projects
    .map((p) => ({ project: p, name: p.name.trim() }))
    .filter((p) => p.name.length > 0)
    .sort((a, b) => b.name.length - a.name.length);
  const lower = raw.toLowerCase();

  let project_id: UUID | null = null;
  const tags: string[] = [];
  const seenTags = new Set<string>();

  let out = "";
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    const atBoundary = i === 0 || /\s/.test(raw[i - 1]);

    if (atBoundary && ch === "@" && project_id === null) {
      const match = byLength.find(({ name }) => {
        if (!lower.startsWith(name.toLowerCase(), i + 1)) return false;
        const after = raw[i + 1 + name.length];
        return after === undefined || /\s/.test(after);
      });
      if (match) {
        project_id = match.project.id;
        i += 1 + match.name.length;
        continue;
      }
    }

    if (atBoundary && ch === "#") {
      const body = TAG_BODY.exec(raw.slice(i + 1));
      if (body) {
        const key = body[0].toLowerCase();
        if (!seenTags.has(key)) {
          seenTags.add(key);
          tags.push(body[0]);
        }
        i += 1 + body[0].length;
        continue;
      }
    }

    out += ch;
    i += 1;
  }

  return { title: out.replace(/\s+/g, " ").trim(), project_id, tags };
}
