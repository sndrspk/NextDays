// URL handling for the optional `tasks.url` field.
//
// Deliberately dependency-free at runtime (no relative imports) so
// `node --experimental-strip-types` can run scripts/extractUrl.test.ts.

export interface ExtractedUrl {
  /** The input with the matched URL removed and whitespace collapsed. */
  title: string;
  /** The first URL found, normalised to an absolute http(s) URL, or null. */
  url: string | null;
}

// A URL either carries an explicit http(s) scheme or starts with `www.`.
// It has to begin the string or follow whitespace or an opening bracket /
// quote, so `(https://x.example)` matches while `a@b.com/x` never does.
const URL_RE = /(?:^|[\s([<"'])((?:https?:\/\/|www\.)[^\s<>]+)/i;

// Trailing characters that are almost always sentence punctuation rather than
// part of the link. Closing brackets are only dropped when unbalanced, so
// `https://en.wikipedia.org/wiki/Foo_(bar)` survives intact.
const TRAILING = new Set([".", ",", ";", ":", "!", "?", "'", '"', "”", "’", "»"]);

function trimTrailingPunctuation(raw: string): string {
  let out = raw;
  for (;;) {
    const last = out[out.length - 1];
    if (last === undefined) return out;
    if (TRAILING.has(last)) {
      out = out.slice(0, -1);
      continue;
    }
    if (
      (last === ")" && count(out, "(") < count(out, ")")) ||
      (last === "]" && count(out, "[") < count(out, "]"))
    ) {
      out = out.slice(0, -1);
      continue;
    }
    return out;
  }
}

function count(haystack: string, ch: string): number {
  let n = 0;
  for (const c of haystack) if (c === ch) n += 1;
  return n;
}

/**
 * Normalises user input into an absolute http(s) URL.
 *
 * A missing scheme is filled in with `https://`. Anything that isn't http or
 * https — `javascript:`, `data:`, `mailto:` — is rejected with null, so a
 * stored URL can always be handed to an `href` safely.
 */
export function normaliseUrl(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (parsed.hostname === "") return null;
  return parsed.href;
}

/**
 * Pulls the first URL out of a task title.
 *
 * Returns the stripped title alongside the normalised URL. When no URL is
 * found the title comes back with its whitespace collapsed and `url: null`.
 */
export function extractUrl(raw: string): ExtractedUrl {
  const match = URL_RE.exec(raw);
  if (!match || match.index === undefined) {
    return { title: raw.replace(/\s+/g, " ").trim(), url: null };
  }

  const matched = match[1];
  const cleaned = trimTrailingPunctuation(matched);
  const url = normaliseUrl(cleaned);
  if (!url) return { title: raw.replace(/\s+/g, " ").trim(), url: null };

  // The whole matched run leaves the title, trailing punctuation included —
  // that punctuation belonged to the link's sentence, and leaving a stray
  // "." or "," behind reads worse than dropping it.
  const start = raw.indexOf(matched, match.index);
  const before = raw.slice(0, start);
  const after = raw.slice(start + matched.length);
  return {
    title: `${before}${after}`.replace(/\s+/g, " ").trim(),
    url,
  };
}

/**
 * A fallback title for a task typed as nothing but a link — the bare hostname,
 * without a `www.` prefix. Without this a quick-add of just a URL would strip
 * itself down to an empty title and be dropped.
 */
export function titleFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

/**
 * Guards a stored URL before it reaches an `href`. Rows written by older
 * clients — or restored from a backup taken elsewhere — are not trusted to
 * already be http(s).
 */
export function safeHref(url: string | null | undefined): string | null {
  if (!url) return null;
  return normaliseUrl(url);
}
