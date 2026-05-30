import { useState, useEffect } from "react";
import {
  useNotificationSettings,
  useUpsertNotificationSettings,
} from "../../hooks/useNotificationSettings";

// Curated list of common IANA timezones shown in the selector.
const TIMEZONES = [
  { label: "UTC", value: "UTC" },
  { label: "London (GMT/BST)", value: "Europe/London" },
  { label: "Amsterdam / Paris / Berlin", value: "Europe/Amsterdam" },
  { label: "Stockholm / Copenhagen / Oslo", value: "Europe/Stockholm" },
  { label: "Helsinki / Tallinn / Riga", value: "Europe/Helsinki" },
  { label: "Istanbul", value: "Europe/Istanbul" },
  { label: "New York (ET)", value: "America/New_York" },
  { label: "Chicago (CT)", value: "America/Chicago" },
  { label: "Denver (MT)", value: "America/Denver" },
  { label: "Los Angeles (PT)", value: "America/Los_Angeles" },
  { label: "Toronto", value: "America/Toronto" },
  { label: "São Paulo", value: "America/Sao_Paulo" },
  { label: "Dubai", value: "Asia/Dubai" },
  { label: "Mumbai", value: "Asia/Kolkata" },
  { label: "Singapore / Kuala Lumpur", value: "Asia/Singapore" },
  { label: "Tokyo / Seoul", value: "Asia/Tokyo" },
  { label: "Shanghai / Beijing", value: "Asia/Shanghai" },
  { label: "Sydney", value: "Australia/Sydney" },
  { label: "Auckland", value: "Pacific/Auckland" },
];

// Hour options (0–23) rendered as "08:00", "09:00", etc.
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${String(i).padStart(2, "0")}:00`,
}));

export default function NotificationSection() {
  const query = useNotificationSettings();
  const upsert = useUpsertNotificationSettings();

  const settings = query.data;
  const isLoading = query.isLoading;

  // Local state — mirrors the DB row, used to drive the form.
  const [enabled, setEnabled] = useState(false);
  const [discordUserId, setDiscordUserId] = useState("");
  const [hour, setHour] = useState(8);
  const [timezone, setTimezone] = useState("UTC");
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Seed local state from loaded settings.
  useEffect(() => {
    if (!settings) return;
    setEnabled(settings.discord_enabled);
    setDiscordUserId(settings.discord_user_id ?? "");
    setHour(settings.notification_hour);
    setTimezone(settings.timezone);
    setDirty(false);
  }, [settings]);

  function markDirty() {
    setDirty(true);
    setSaveStatus("idle");
  }

  async function handleSave() {
    setSaveStatus("saving");
    setDirty(false);
    upsert.mutate(
      {
        discord_enabled: enabled,
        discord_user_id: discordUserId.trim() || null,
        notification_hour: hour,
        timezone,
      },
      {
        onSuccess: () => setSaveStatus("saved"),
        onError: () => {
          setSaveStatus("error");
          setDirty(true);
        },
      },
    );
  }

  if (isLoading) {
    return <p className="text-[12px] text-stone-500">Loading…</p>;
  }

  return (
    <div className="space-y-5">
      {/* Enable / disable toggle */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-stone-800">Discord DM</p>
          <p className="text-[12px] text-stone-500">
            Send a daily Focus-view summary to your Discord account.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => {
            setEnabled((v) => !v);
            markDirty();
          }}
          className={`focus-ring relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
            enabled ? "bg-accent" : "bg-slate-200"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Discord User ID */}
      <div className="space-y-1.5">
        <label className="block text-[12px] font-medium text-stone-700">
          Discord User ID
        </label>
        <input
          type="text"
          value={discordUserId}
          onChange={(e) => {
            setDiscordUserId(e.target.value);
            markDirty();
          }}
          placeholder="e.g. 123456789012345678"
          className="focus-ring w-full rounded-md border border-slate-200/80 bg-white px-2.5 py-1.5 font-mono text-[12px] text-stone-800 focus:border-accent/60 focus:outline-none"
        />
        <p className="text-[11px] text-stone-400">
          Discord → Settings → Advanced → Developer Mode, then right-click your
          username → Copy User ID.
        </p>
      </div>

      {/* Time + timezone row */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="space-y-1.5 sm:w-32">
          <label className="block text-[12px] font-medium text-stone-700">
            Send at
          </label>
          <select
            value={hour}
            onChange={(e) => {
              setHour(Number(e.target.value));
              markDirty();
            }}
            className="focus-ring w-full rounded-md border border-slate-200/80 bg-white px-2.5 py-1.5 text-[12px] text-stone-800 focus:border-accent/60 focus:outline-none"
          >
            {HOUR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 space-y-1.5">
          <label className="block text-[12px] font-medium text-stone-700">
            Timezone
          </label>
          <select
            value={timezone}
            onChange={(e) => {
              setTimezone(e.target.value);
              markDirty();
            }}
            className="focus-ring w-full rounded-md border border-slate-200/80 bg-white px-2.5 py-1.5 text-[12px] text-stone-800 focus:border-accent/60 focus:outline-none"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Save button + status */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!dirty || saveStatus === "saving"}
          onClick={handleSave}
          className={`focus-ring rounded-lg px-3.5 py-2 text-[12px] font-medium transition-colors disabled:opacity-40 ${
            saveStatus === "saved"
              ? "bg-green-50 text-green-700"
              : saveStatus === "error"
                ? "bg-red-50 text-red-700"
                : "bg-accent-50 text-accent-700 hover:bg-accent-100"
          }`}
        >
          {saveStatus === "saving"
            ? "Saving…"
            : saveStatus === "saved"
              ? "Saved ✓"
              : saveStatus === "error"
                ? "Error — try again"
                : "Save"}
        </button>

        {!dirty && saveStatus === "idle" && settings && (
          <p className="text-[11px] text-stone-400">
            {settings.discord_enabled
              ? `Enabled — daily DM at ${String(settings.notification_hour).padStart(2, "0")}:00 (${settings.timezone})`
              : "Disabled"}
          </p>
        )}
      </div>

      {/* Setup instructions */}
      <div className="rounded-lg border border-slate-200/60 bg-slate-50 px-4 py-3">
        <p className="mb-1.5 text-[11px] font-medium text-stone-600">Setup checklist</p>
        <ol className="list-decimal space-y-1 pl-4 text-[11px] text-stone-500">
          <li>
            Create a Discord bot at{" "}
            <span className="font-mono text-stone-600">discord.com/developers</span> and copy its
            token.
          </li>
          <li>
            Set the secret in Supabase:{" "}
            <span className="font-mono text-stone-600">
              supabase secrets set DISCORD_BOT_TOKEN=&lt;token&gt;
            </span>
          </li>
          <li>
            Add <span className="font-mono text-stone-600">SUPABASE_SERVICE_ROLE_KEY</span> to your
            GitHub repository secrets (Settings → Secrets).
          </li>
          <li>
            Deploy the edge function:{" "}
            <span className="font-mono text-stone-600">
              supabase functions deploy send-daily-notification
            </span>
          </li>
          <li>The bot must share a server with you for DMs to work.</li>
        </ol>
      </div>
    </div>
  );
}
