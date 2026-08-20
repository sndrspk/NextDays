// A tiny search-query language for the Search screen.
//
//   report draft          → report AND draft   (whitespace is an implicit AND)
//   report OR draft       → either one
//   "quarterly report"    → the exact phrase, spaces included
//   (a OR b) invoice      → grouping with parentheses
//
// AND / OR must be UPPERCASE to act as operators, which is the convention
// Google, GitHub, and Jira all use. That keeps a lowercase "or" searchable as
// an ordinary word ("salt or pepper" finds the literal text). Quote a term to
// search for the uppercase spelling itself: "AND".
//
// Parsing is deliberately forgiving — the query is re-parsed on every
// keystroke, so a half-typed `(foo` or `"bar` must still return results rather
// than an error. Unclosed groups and quotes simply run to the end of the
// input, and a stray `)` is ignored.

export type SearchNode =
  | { kind: "term"; value: string }
  | { kind: "and"; children: SearchNode[] }
  | { kind: "or"; children: SearchNode[] };

type Token =
  | { type: "term"; value: string }
  | { type: "and" }
  | { type: "or" }
  | { type: "lparen" }
  | { type: "rparen" };

const SEPARATORS = new Set([" ", "\t", "\n", "\r", "(", ")", '"']);

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i += 1;
      continue;
    }

    if (ch === "(") {
      tokens.push({ type: "lparen" });
      i += 1;
      continue;
    }

    if (ch === ")") {
      tokens.push({ type: "rparen" });
      i += 1;
      continue;
    }

    if (ch === '"') {
      // Phrase: everything up to the closing quote, or the end of the input
      // when the user hasn't typed it yet.
      const end = input.indexOf('"', i + 1);
      const value = end === -1 ? input.slice(i + 1) : input.slice(i + 1, end);
      i = end === -1 ? input.length : end + 1;
      const trimmed = value.trim();
      if (trimmed) tokens.push({ type: "term", value: trimmed.toLowerCase() });
      continue;
    }

    let j = i;
    while (j < input.length && !SEPARATORS.has(input[j])) j += 1;
    const word = input.slice(i, j);
    i = j;

    if (word === "AND") tokens.push({ type: "and" });
    else if (word === "OR") tokens.push({ type: "or" });
    else tokens.push({ type: "term", value: word.toLowerCase() });
  }

  return tokens;
}

/**
 * Parses a raw query string into a match tree, or null when the query holds
 * no searchable terms (empty, whitespace, or operators alone).
 */
export function parseSearchQuery(input: string): SearchNode | null {
  const tokens = tokenize(input);
  let pos = 0;

  function peek(): Token | undefined {
    return tokens[pos];
  }

  // expr := and ( OR and )*
  function parseExpr(): SearchNode | null {
    const children: SearchNode[] = [];
    const first = parseAnd();
    if (first) children.push(first);

    while (peek()?.type === "or") {
      pos += 1; // consume OR
      const next = parseAnd();
      if (next) children.push(next);
    }

    if (children.length === 0) return null;
    if (children.length === 1) return children[0];
    return { kind: "or", children };
  }

  // and := factor ( AND? factor )*
  function parseAnd(): SearchNode | null {
    const children: SearchNode[] = [];

    for (;;) {
      const token = peek();
      if (!token || token.type === "or" || token.type === "rparen") break;

      if (token.type === "and") {
        pos += 1; // explicit AND is just noise between two factors
        continue;
      }

      const factor = parseFactor();
      if (factor) children.push(factor);
    }

    if (children.length === 0) return null;
    if (children.length === 1) return children[0];
    return { kind: "and", children };
  }

  function parseFactor(): SearchNode | null {
    const token = peek();
    if (!token) return null;

    if (token.type === "term") {
      pos += 1;
      return { kind: "term", value: token.value };
    }

    if (token.type === "lparen") {
      pos += 1;
      const inner = parseExpr();
      if (peek()?.type === "rparen") pos += 1; // tolerate a missing ")"
      return inner;
    }

    // Stray ")" or a leading operator: drop it so the loop always advances.
    pos += 1;
    return null;
  }

  const node = parseExpr();

  // A trailing ")" can leave tokens unconsumed; fold whatever remains in with
  // an AND so nothing in the query is silently ignored.
  const rest: SearchNode[] = [];
  while (pos < tokens.length) {
    const factor = parseExpr();
    if (factor) rest.push(factor);
    else if (pos < tokens.length) pos += 1;
  }

  if (rest.length === 0) return node;
  const all = node ? [node, ...rest] : rest;
  return all.length === 1 ? all[0] : { kind: "and", children: all };
}

/**
 * Joins a task's searchable fields with newlines. The separator matters: it
 * stops a quoted phrase from matching across a field boundary (a title ending
 * in "annual" followed by notes starting with "report" is not a match for
 * "annual report").
 */
export function buildSearchHaystack(parts: (string | null | undefined)[]): string {
  return parts
    .filter((p): p is string => typeof p === "string" && p.length > 0)
    .join("\n")
    .toLowerCase();
}

/** Evaluates a parsed query against a haystack built by {@link buildSearchHaystack}. */
export function matchesSearch(node: SearchNode | null, haystack: string): boolean {
  if (!node) return true;
  switch (node.kind) {
    case "term":
      return haystack.includes(node.value);
    case "and":
      return node.children.every((c) => matchesSearch(c, haystack));
    case "or":
      return node.children.some((c) => matchesSearch(c, haystack));
  }
}
