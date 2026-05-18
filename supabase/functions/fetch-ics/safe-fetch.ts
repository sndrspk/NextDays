// SSRF-hardened fetch for the fetch-ics Edge Function.
//
// `safeFetch` enforces:
//   - http(s) only, ports 80/443 only, no embedded credentials
//   - DNS pre-resolution; reject if any A/AAAA address is private/reserved
//     (RFC1918, loopback, link-local incl. cloud metadata 169.254.169.254,
//     ULA fc00::/7, IPv4-mapped IPv6 ::ffff:0:0/96 re-checked against v4)
//   - manual redirects (max 5 hops), each Location re-validated through the
//     same allow-list
//   - 10s overall timeout via AbortController
//   - 5 MiB streamed body cap (we abort the read mid-stream on overflow)
//   - Content-Type allow-list (text/calendar, text/plain,
//     application/octet-stream — some hosts mis-label .ics)
//   - VCALENDAR sniff on the first bytes to catch hosts that 200 with HTML
//
// Pure helpers are exported so `safe-fetch_test.ts` can exercise them
// without touching the network.

// @ts-ignore  Deno globals are available at runtime
declare const Deno: {
  resolveDns(hostname: string, recordType: "A" | "AAAA"): Promise<string[]>;
};

export const MAX_REDIRECTS = 5;
export const TIMEOUT_MS = 10_000;
export const MAX_BODY_BYTES = 5 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES = new Set([
  "text/calendar",
  "text/plain",
  "application/octet-stream",
]);

export class SafeFetchError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "SafeFetchError";
    this.status = status;
  }
}

export function parseIPv4(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const out: number[] = [];
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n < 0 || n > 255) return null;
    out.push(n);
  }
  return out;
}

export function isPrivateIPv4(ip: string): boolean {
  const o = parseIPv4(ip);
  if (!o) return false;
  if (o[0] === 0) return true; // 0.0.0.0/8
  if (o[0] === 10) return true; // RFC1918
  if (o[0] === 127) return true; // loopback
  if (o[0] === 169 && o[1] === 254) return true; // link-local incl. 169.254.169.254
  if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true; // RFC1918
  if (o[0] === 192 && o[1] === 168) return true; // RFC1918
  if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) return true; // CGNAT
  if (o[0] === 192 && o[1] === 0 && o[2] === 0) return true; // IETF reserved
  if (o[0] === 198 && (o[1] === 18 || o[1] === 19)) return true; // benchmarking
  if (o[0] >= 224 && o[0] <= 239) return true; // multicast
  if (o[0] >= 240) return true; // reserved + broadcast
  return false;
}

export function parseIPv6(input: string): number[] | null {
  let ip = input.split("%")[0]; // strip zone id

  // IPv4-mapped/embedded form: ::ffff:1.2.3.4
  let ipv4Tail: number[] | null = null;
  const lastColon = ip.lastIndexOf(":");
  if (lastColon !== -1 && ip.slice(lastColon + 1).includes(".")) {
    const v4 = parseIPv4(ip.slice(lastColon + 1));
    if (!v4) return null;
    ipv4Tail = v4;
    ip = ip.slice(0, lastColon + 1) + "0:0";
  }

  const doubleColon = ip.indexOf("::");
  let parts: string[];
  if (doubleColon === -1) {
    parts = ip.split(":");
  } else {
    if (ip.indexOf("::", doubleColon + 1) !== -1) return null; // only one "::"
    const leftStr = ip.slice(0, doubleColon);
    const rightStr = ip.slice(doubleColon + 2);
    const left = leftStr === "" ? [] : leftStr.split(":");
    const right = rightStr === "" ? [] : rightStr.split(":");
    const missing = 8 - left.length - right.length;
    if (missing < 1) return null;
    parts = [...left, ...Array(missing).fill("0"), ...right];
  }

  if (parts.length !== 8) return null;
  const groups: number[] = [];
  for (const p of parts) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(p)) return null;
    groups.push(parseInt(p, 16));
  }

  if (ipv4Tail) {
    groups[6] = (ipv4Tail[0] << 8) | ipv4Tail[1];
    groups[7] = (ipv4Tail[2] << 8) | ipv4Tail[3];
  }
  return groups;
}

export function isPrivateIPv6(ip: string): boolean {
  const g = parseIPv6(ip);
  if (!g) return false;
  // :: unspecified
  if (g.every((x) => x === 0)) return true;
  // ::1 loopback
  if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 &&
      g[4] === 0 && g[5] === 0 && g[6] === 0 && g[7] === 1) return true;
  // ::ffff:0:0/96 — IPv4-mapped, re-check as v4
  if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 &&
      g[4] === 0 && g[5] === 0xffff) {
    const v4 = `${(g[6] >> 8) & 0xff}.${g[6] & 0xff}.${(g[7] >> 8) & 0xff}.${g[7] & 0xff}`;
    return isPrivateIPv4(v4);
  }
  // 64:ff9b::/96 — NAT64, treat as public (it maps to a public v4)
  // fc00::/7 — unique local
  if ((g[0] & 0xfe00) === 0xfc00) return true;
  // fe80::/10 — link-local
  if ((g[0] & 0xffc0) === 0xfe80) return true;
  // ff00::/8 — multicast
  if ((g[0] & 0xff00) === 0xff00) return true;
  return false;
}

export function isPrivateAddress(ip: string): boolean {
  if (ip.includes(":")) return isPrivateIPv6(ip);
  return isPrivateIPv4(ip);
}

export function assertSafeUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new SafeFetchError("Invalid URL.", 400);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SafeFetchError("Only http(s) URLs are allowed.", 400);
  }
  if (url.username !== "" || url.password !== "") {
    throw new SafeFetchError("URLs with embedded credentials are not allowed.", 400);
  }
  if (url.port !== "") {
    const port = Number(url.port);
    if (port !== 80 && port !== 443) {
      throw new SafeFetchError("Only ports 80 and 443 are allowed.", 400);
    }
  }
  return url;
}

async function assertHostnameSafe(hostname: string): Promise<void> {
  // Strip brackets WHATWG sometimes leaves on IPv6 literals.
  let host = hostname;
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);

  // Literal IP — check directly, no DNS round-trip.
  if (parseIPv4(host)) {
    if (isPrivateIPv4(host)) {
      throw new SafeFetchError("URL resolves to a private or reserved address.", 400);
    }
    return;
  }
  if (parseIPv6(host)) {
    if (isPrivateIPv6(host)) {
      throw new SafeFetchError("URL resolves to a private or reserved address.", 400);
    }
    return;
  }

  const addrs: string[] = [];
  for (const type of ["A", "AAAA"] as const) {
    try {
      const r = await Deno.resolveDns(host, type);
      addrs.push(...r);
    } catch {
      // No record of this type — fine, try the other one.
    }
  }
  if (addrs.length === 0) {
    throw new SafeFetchError("Could not resolve hostname.", 400);
  }
  for (const addr of addrs) {
    if (isPrivateAddress(addr)) {
      throw new SafeFetchError("URL resolves to a private or reserved address.", 400);
    }
  }
}

function looksLikeVCalendar(text: string): boolean {
  // Allow BOM + leading whitespace before BEGIN:VCALENDAR.
  return /^﻿?\s*BEGIN:VCALENDAR/i.test(text.slice(0, 256));
}

async function readCapped(body: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        throw new SafeFetchError("Calendar body exceeds 5 MiB limit.", 502);
      }
      chunks.push(value);
    }
  } finally {
    try { reader.releaseLock(); } catch { /* ignore */ }
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

export async function safeFetch(rawUrl: string): Promise<string> {
  const initial = assertSafeUrl(rawUrl);
  await assertHostnameSafe(initial.hostname);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let current = initial;
    let response: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const r = await fetch(current.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "NextDays/1.0 (+https://github.com/sndrspk/NextDays)",
          "Accept": "text/calendar, text/plain;q=0.8, application/octet-stream;q=0.5",
        },
      });

      if (r.status >= 300 && r.status < 400) {
        const loc = r.headers.get("Location");
        try { await r.body?.cancel(); } catch { /* ignore */ }
        if (!loc) {
          throw new SafeFetchError(`Redirect ${r.status} without Location header.`, 502);
        }
        if (hop === MAX_REDIRECTS) {
          throw new SafeFetchError("Too many redirects.", 502);
        }
        let next: URL;
        try {
          next = new URL(loc, current);
        } catch {
          throw new SafeFetchError("Redirect to an invalid URL.", 502);
        }
        // Re-run the full allow-list on each hop.
        const validated = assertSafeUrl(next.toString());
        await assertHostnameSafe(validated.hostname);
        current = validated;
        continue;
      }

      response = r;
      break;
    }

    if (!response) {
      throw new SafeFetchError("No response after redirect chain.", 502);
    }
    if (!response.ok) {
      try { await response.body?.cancel(); } catch { /* ignore */ }
      throw new SafeFetchError(`Upstream returned HTTP ${response.status}.`, 502);
    }

    const ctRaw = response.headers.get("Content-Type") ?? "";
    const ct = ctRaw.split(";")[0].trim().toLowerCase();
    if (ct && !ALLOWED_CONTENT_TYPES.has(ct)) {
      try { await response.body?.cancel(); } catch { /* ignore */ }
      throw new SafeFetchError(`Unexpected Content-Type "${ct}".`, 502);
    }

    if (!response.body) {
      throw new SafeFetchError("Empty response body.", 502);
    }

    const bytes = await readCapped(response.body);
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if (!looksLikeVCalendar(text)) {
      throw new SafeFetchError("Response is not an iCalendar document.", 502);
    }
    return text;
  } catch (err) {
    if (err instanceof SafeFetchError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new SafeFetchError("Upstream fetch timed out.", 504);
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new SafeFetchError(`Couldn't reach the calendar: ${message}`, 502);
  } finally {
    clearTimeout(timer);
  }
}
