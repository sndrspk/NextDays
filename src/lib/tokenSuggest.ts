// Caret-aware token detection for the tag / project autocomplete.
//
// Two shapes are supported:
//   * "inline"  — a `#tag` or `@Project` token inside a free-text title, the
//                 same syntax `lib/parseTaskTitle.ts` reads back out.
//   * "csv"     — one segment of a comma-separated tag field (the Tags input
//                 in the task detail panel and the Add task form).
//
// Deliberately dependency-free (no relative runtime imports) so
// `scripts/tokenSuggest.test.ts` can run it under `node --experimental-strip-types`.

export type TokenKind = "tag" | "project";

export interface ActiveToken {
  kind: TokenKind;
  /** What the user has typed so far, from the start of the token up to the caret. */
  query: string;
  /** Index of the sigil for inline tokens; of the first segment character for csv. */
  start: number;
  /** Index just past the last character belonging to the token. */
  end: number;
}

export interface AcceptResult {
  value: string;
  caret: number;
}

const WORD_CHAR = /[A-Za-z0-9_-]/;
const SPACE = /\s/;

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && WORD_CHAR.test(ch);
}

function isSpace(ch: string | undefined): boolean {
  return ch !== undefined && SPACE.test(ch);
}

// Finds the `#…` / `@…` token the caret currently sits in, or null. The token
// must start at the beginning of the string or after whitespace, matching the
// boundary rule the title parser uses — so `a@b` is an email, not a project.
export function inlineTokenAt(value: string, caret: number): ActiveToken | null {
  const at = Math.max(0, Math.min(caret, value.length));

  let start = at;
  while (start > 0 && isWordChar(value[start - 1])) start -= 1;

  const sigilIndex = start - 1;
  if (sigilIndex < 0) return null;
  const sigil = value[sigilIndex];
  if (sigil !== "#" && sigil !== "@") return null;
  if (sigilIndex > 0 && !isSpace(value[sigilIndex - 1])) return null;

  let end = at;
  while (end < value.length && isWordChar(value[end])) end += 1;

  return {
    kind: sigil === "#" ? "tag" : "project",
    query: value.slice(start, at),
    start: sigilIndex,
    end,
  };
}

// Finds the comma-separated segment the caret sits in. Always a tag token.
export function csvTokenAt(value: string, caret: number): ActiveToken | null {
  const at = Math.max(0, Math.min(caret, value.length));

  let start = value.lastIndexOf(",", at - 1) + 1;
  while (start < at && isSpace(value[start])) start += 1;

  const nextComma = value.indexOf(",", at);
  let end = nextComma === -1 ? value.length : nextComma;
  while (end > at && isSpace(value[end - 1])) end -= 1;

  return { kind: "tag", query: value.slice(start, at), start, end };
}

// The other segments of a comma-separated field — so a tag already on the task
// is not offered a second time.
export function csvOtherValues(value: string, token: ActiveToken): string[] {
  const before = value.slice(0, token.start);
  const after = value.slice(token.end);
  return (before + "," + after)
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export interface FilterOptions {
  limit?: number;
  exclude?: string[];
}

// Prefix match, case-insensitive, original order preserved. A sole candidate
// that is exactly what has been typed is dropped — there is nothing to accept.
export function filterSuggestions(
  candidates: string[],
  query: string,
  options: FilterOptions = {},
): string[] {
  const { limit = 6, exclude = [] } = options;
  const q = query.trim().toLowerCase();
  const skip = new Set(exclude.map((e) => e.toLowerCase()));

  const hits = candidates.filter((c) => {
    const key = c.toLowerCase();
    if (skip.has(key)) return false;
    return key.startsWith(q);
  });

  if (hits.length === 1 && hits[0].toLowerCase() === q) return [];
  return hits.slice(0, limit);
}

// Writes the chosen name back over the inline token, keeping the sigil and
// leaving exactly one space after it.
export function acceptInline(value: string, token: ActiveToken, name: string): AcceptResult {
  const sigil = token.kind === "tag" ? "#" : "@";
  const insert = sigil + name;
  const head = value.slice(0, token.start);
  const rest = value.slice(token.end);
  const spaced = rest.startsWith(" ") ? rest : " " + rest;
  return { value: head + insert + spaced, caret: head.length + insert.length + 1 };
}

// Writes the chosen name back over one segment of a comma-separated field.
export function acceptCsv(value: string, token: ActiveToken, name: string): AcceptResult {
  const head = value.slice(0, token.start);
  const rest = value.slice(token.end);

  if (rest.trim() === "") {
    const next = head + name + ", ";
    return { value: next, caret: next.length };
  }
  const separated = rest.startsWith(",") ? rest : ", " + rest;
  return { value: head + name + separated, caret: head.length + name.length + 2 };
}
