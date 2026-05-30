// NextDays — send-daily-notification Edge Function.
//
// Called hourly by the `.github/workflows/daily-notification.yml` cron via
// the Supabase service-role key (Authorization: Bearer <service_role_key>).
// For every user with discord_enabled = true, the function:
//   1. Checks whether the current hour (in the user's stored timezone) matches
//      their notification_hour. Skips if not.
//   2. Fetches their uncompleted tasks for today (overdue + due today +
//      scheduled today), matching the Focus-view logic in useFocusTasks.ts.
//   3. Formats a plain-text Discord message mirroring the Focus-view sections.
//   4. Sends the message via the Discord Bot API (DM channel).
//
// Required secrets (set via `supabase secrets set`):
//   DISCORD_BOT_TOKEN   — your Discord bot token
//
// The SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically
// by Supabase into every Edge Function runtime.
//
// Deploy with:
//   supabase functions deploy send-daily-notification

// @ts-ignore Deno-only import
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-ignore Deno-only import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DISCORD_API = "https://discord.com/api/v10";
const MAX_MESSAGE_LENGTH = 2000;

interface NotificationSettingsRow {
  id: string;
  user_id: string;
  discord_enabled: boolean;
  discord_user_id: string | null;
  notification_hour: number;
  timezone: string;
}

interface Task {
  id: string;
  title: string;
  scheduled_date: string;
  start_date: string | null;
  due_date: string | null;
  completed: boolean;
  projects: { name: string } | null;
}

// Returns today's date (YYYY-MM-DD) in the given IANA timezone.
function todayInTimezone(tz: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: tz });
}

// Returns the current hour (0–23) in the given IANA timezone.
function currentHourInTimezone(tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: tz,
  }).formatToParts(new Date());
  const h = parts.find((p) => p.type === "hour")?.value ?? "0";
  // "24" can appear for midnight in some locales; normalise to 0.
  return parseInt(h, 10) % 24;
}

// Formats YYYY-MM-DD as "1 Jan", "15 Mar", etc.
function formatShortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d} ${months[m - 1]}`;
}

// Formats the full date header: "Wednesday, 28 May 2026"
function formatLongDate(tz: string): string {
  return new Date().toLocaleDateString("en-GB", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function buildMessage(tasks: Task[], today: string, tz: string): string {
  const header = `**📅 NextDays — ${formatLongDate(tz)}**`;

  const overdue = tasks.filter((t) => !t.completed && t.scheduled_date < today);
  const dueToday = tasks.filter(
    (t) =>
      !t.completed &&
      t.scheduled_date >= today &&
      t.due_date !== null &&
      t.due_date <= today &&
      t.scheduled_date > t.due_date,
  );
  // Scheduled for today: scheduled today, not already in dueToday
  const scheduledToday = tasks.filter(
    (t) =>
      !t.completed &&
      t.scheduled_date === today &&
      !(t.due_date !== null && t.due_date <= today && t.scheduled_date > t.due_date),
  );

  if (overdue.length === 0 && dueToday.length === 0 && scheduledToday.length === 0) {
    return `${header}\n\n✨ Nothing on your plate today. Enjoy!`;
  }

  const lines: string[] = [header, ""];

  function renderSection(label: string, items: Task[]) {
    if (items.length === 0) return;
    lines.push(`**${label} (${items.length})**`);
    for (const t of items) {
      const project = t.projects?.name ? ` _(${t.projects.name})_` : "";
      const due = t.due_date && t.due_date < today ? ` *(due ${formatShortDate(t.due_date)})*` : "";
      lines.push(`• ${t.title}${project}${due}`);
    }
    lines.push("");
  }

  if (overdue.length > 0) renderSection("⚠️ Overdue", overdue);
  if (dueToday.length > 0) renderSection("📌 Due today", dueToday);
  if (scheduledToday.length > 0) renderSection("📆 Scheduled for today", scheduledToday);

  let text = lines.join("\n").trimEnd();

  // Truncate gracefully if Discord's 2 000-char limit is hit.
  if (text.length > MAX_MESSAGE_LENGTH) {
    const cutoff = MAX_MESSAGE_LENGTH - 40;
    text = text.slice(0, cutoff) + "\n\n*…and more. Open the app!*";
  }

  return text;
}

async function openDmChannel(botToken: string, userId: string): Promise<string> {
  const res = await fetch(`${DISCORD_API}/users/@me/channels`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ recipient_id: userId }),
  });
  if (!res.ok) throw new Error(`Failed to open DM channel: ${res.status}`);
  const data = await res.json();
  return data.id as string;
}

async function sendDm(botToken: string, channelId: string, content: string): Promise<void> {
  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to send DM: ${res.status} ${body}`);
  }
}

serve(async (_req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const discordToken = Deno.env.get("DISCORD_BOT_TOKEN");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Missing Supabase env vars." }), { status: 500 });
  }
  if (!discordToken) {
    return new Response(JSON.stringify({ error: "DISCORD_BOT_TOKEN not set." }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Fetch all enabled notification settings.
  const { data: settings, error: settingsError } = await supabase
    .from("notification_settings")
    .select("*")
    .eq("discord_enabled", true)
    .not("discord_user_id", "is", null);

  if (settingsError) {
    return new Response(JSON.stringify({ error: settingsError.message }), { status: 500 });
  }

  const rows = (settings ?? []) as NotificationSettingsRow[];
  const results: { userId: string; status: string }[] = [];

  for (const row of rows) {
    try {
      const tz = row.timezone || "UTC";

      // Only send if the current hour in the user's timezone matches.
      const currentHour = currentHourInTimezone(tz);
      if (currentHour !== row.notification_hour) {
        results.push({ userId: row.user_id, status: "skipped (wrong hour)" });
        continue;
      }

      const today = todayInTimezone(tz);

      // Fetch tasks: scheduled today OR due today or earlier.
      // This mirrors the useFocusTasks query, plus delayed-start filtering.
      const { data: taskData, error: taskError } = await supabase
        .from("tasks")
        .select("id, title, scheduled_date, start_date, due_date, completed, projects(name)")
        .eq("user_id", row.user_id)
        .eq("completed", false)
        .or(`scheduled_date.eq.${today},due_date.lte.${today}`)
        .order("sort_order", { ascending: true });

      if (taskError) throw new Error(taskError.message);

      // Apply the delayed-start filter (same as useFocusTasks).
      const tasks = ((taskData ?? []) as Task[]).filter(
        (t) => !t.start_date || t.start_date <= t.scheduled_date,
      );

      const message = buildMessage(tasks, today, tz);
      const channelId = await openDmChannel(discordToken, row.discord_user_id!);
      await sendDm(discordToken, channelId, message);

      results.push({ userId: row.user_id, status: "sent" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ userId: row.user_id, status: `error: ${msg}` });
    }
  }

  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
