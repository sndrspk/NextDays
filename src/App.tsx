import SmokeScreen from "./components/dev/SmokeScreen";
import { supabaseConfigured } from "./lib/supabase";

export default function App() {
  return (
    <div className="min-h-full p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">NextDays</h1>
        <p className="text-sm text-stone-500">
          Milestone 1 scaffold — calendar UI lands in Milestone 2.
        </p>
      </header>

      {!supabaseConfigured && (
        <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Supabase env vars are not set. Copy <code>.env.example</code> to <code>.env</code> and
          restart <code>npm run dev</code>.
        </div>
      )}

      <SmokeScreen />
    </div>
  );
}
