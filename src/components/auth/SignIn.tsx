import { useState } from "react";
import { useAuth } from "../../state/auth";

type Status = "idle" | "sending" | "sent" | "error";

export default function SignIn() {
  const { signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setStatus("sending");
    setError(null);
    try {
      await signInWithMagicLink(trimmed);
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      const raw = err instanceof Error ? err.message : String(err);
      setError(
        /signups? not allowed/i.test(raw)
          ? "This email isn't authorised to sign in."
          : raw,
      );
    }
  }

  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <h1 className="text-[32px] font-semibold tracking-tight text-stone-900">NextDays</h1>
          <p className="mt-1 text-[13px] text-stone-500">
            Keyboard-first daily focus. Sign in to get started.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="space-y-3 rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-panel"
        >
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
              Email
            </span>
            <input
              autoFocus
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={status === "sending" || status === "sent"}
              className="focus-ring w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-[14px] text-stone-800 placeholder:text-stone-300 transition-colors hover:border-slate-300 focus:border-accent/60 focus:outline-none disabled:opacity-60"
            />
          </label>

          <button
            type="submit"
            disabled={status === "sending" || status === "sent" || !email.trim()}
            className="focus-ring w-full rounded-lg bg-accent px-3 py-2 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-accent-600 disabled:opacity-50"
          >
            {status === "sending"
              ? "Sending magic link…"
              : status === "sent"
              ? "Link sent — check your email"
              : "Send magic link"}
          </button>

          {status === "sent" && (
            <p className="rounded-lg bg-accent-50 px-3 py-2 text-[12px] text-accent-700">
              Open the link on this device to finish signing in.
            </p>
          )}
          {status === "error" && error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</p>
          )}
        </form>

        <p className="mt-4 text-center text-[11px] text-stone-400">
          We'll email a one-time link. No passwords.
        </p>
      </div>
    </div>
  );
}
