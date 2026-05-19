/// <reference lib="webworker" />
import { parseIcs } from "../lib/icsParse";

interface ParseRequest {
  text: string;
  calendarId: string;
}

interface ParseSuccess {
  ok: true;
  events: ReturnType<typeof parseIcs>;
}

interface ParseFailure {
  ok: false;
  error: string;
}

export type ParseResponse = ParseSuccess | ParseFailure;

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.addEventListener("message", (event: MessageEvent<ParseRequest>) => {
  const { text, calendarId } = event.data;
  try {
    const events = parseIcs(text, calendarId);
    const reply: ParseResponse = { ok: true, events };
    ctx.postMessage(reply);
  } catch (err) {
    const reply: ParseResponse = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    ctx.postMessage(reply);
  }
});
