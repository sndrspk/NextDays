import CalendarStrip from "./components/calendar/CalendarStrip";
import { useRollover } from "./hooks/useRollover";
import { supabaseConfigured } from "./lib/supabase";

export default function App() {
  useRollover();

  return (
    <div className="min-h-full px-6 py-8 lg:px-10">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-stone-900">NextDays</h1>
        <p className="text-xs text-stone-400">Milestone 3 · interactive</p>
      </header>

      {!supabaseConfigured && (
        <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Supabase env vars are not set. Copy <code>.env.example</code> to <code>.env</code> and
          restart <code>npm run dev</code>.
        </div>
      )}

      <CalendarStrip />
    </div>
  );
}
