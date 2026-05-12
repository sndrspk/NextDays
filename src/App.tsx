import SignIn from "./components/auth/SignIn";
import CalendarStrip from "./components/calendar/CalendarStrip";
import TaskDetailPanel from "./components/calendar/TaskDetailPanel";
import CustomListView from "./components/lists/CustomListView";
import ProjectView from "./components/projects/ProjectView";
import Sidebar from "./components/sidebar/Sidebar";
import { useRollover } from "./hooks/useRollover";
import { supabaseConfigured } from "./lib/supabase";
import { AuthProvider, useAuth } from "./state/auth";
import { SelectionProvider } from "./state/selection";
import { ViewProvider, useView } from "./state/view";

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

function AuthGate() {
  const { session, loading } = useAuth();

  if (!supabaseConfigured) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="max-w-md rounded-2xl border border-amber-200/70 bg-amber-50/80 px-5 py-4 text-sm text-amber-900 shadow-card backdrop-blur">
          Supabase env vars are not set. Copy{" "}
          <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">.env.example</code> to{" "}
          <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">.env</code> and restart{" "}
          <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">npm run dev</code>.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-stone-400">
        Loading…
      </div>
    );
  }

  if (!session) {
    return <SignIn />;
  }

  return <AppShell />;
}

function AppShell() {
  useRollover();

  return (
    <SelectionProvider>
      <ViewProvider>
        <div className="flex h-full">
          <Sidebar />
          <main className="flex-1 overflow-hidden">
            <MainView />
          </main>
        </div>
        <TaskDetailPanel />
      </ViewProvider>
    </SelectionProvider>
  );
}

function MainView() {
  const { view } = useView();

  if (view.kind === "project") {
    return <ProjectView projectId={view.id} />;
  }

  if (view.kind === "list") {
    return <CustomListView listId={view.id} />;
  }

  return (
    <div className="h-full overflow-y-auto px-8 py-8 lg:px-10">
      <CalendarStrip />
    </div>
  );
}
