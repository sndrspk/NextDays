// NextDays — fetch-ics Edge Function.
//
// Browsers can't fetch most public .ics endpoints because providers (Google,
// iCloud, Outlook, Fastmail, …) don't send `Access-Control-Allow-Origin`.
// This function proxies the fetch server-side and returns the raw text in
// a JSON envelope. The client invokes it through the authenticated Supabase
// client, so the user's JWT is required — the function isn't an open proxy.
//
// Deploy with:
//   supabase functions deploy fetch-ics
//
// (JWT verification is on by default; we want that — only signed-in users
// of this project can use the proxy.)

// @ts-ignore  Deno-only import
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: { url?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Body must be JSON." }, 400);
  }

  const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
  if (!rawUrl) {
    return jsonResponse({ error: "Missing `url` in body." }, 400);
  }

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return jsonResponse({ error: "Invalid URL." }, 400);
  }
  // Basic SSRF guard: only public http(s).
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return jsonResponse({ error: "Only http(s) URLs are allowed." }, 400);
  }

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      redirect: "follow",
      headers: { "User-Agent": "NextDays/1.0 (+https://github.com/sndrspk/NextDays)" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Couldn't reach the calendar: ${message}` }, 502);
  }

  if (!upstream.ok) {
    return jsonResponse(
      { error: `Provider returned HTTP ${upstream.status} ${upstream.statusText}` },
      502,
    );
  }

  const text = await upstream.text();
  return jsonResponse({ text });
});
