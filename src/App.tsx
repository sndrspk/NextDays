import CalendarStrip from "./components/calendar/CalendarStrip";
import TaskDetailPanel from "./components/calendar/TaskDetailPanel";
import ProjectView from "./components/projects/ProjectView";
import Sidebar from "./components/sidebar/Sidebar";
import { useRollover } from "./hooks/useRollover";
import { supabaseConfigured } from "./lib/supabase";
import { SelectionProvider } from "./state/selection";
import { ViewProvider, useView } from "./state/view";

export default function App() {
  useRollover();

  return (
    <SelectionProvider>
      <ViewProvider>
        <div className="flex h-full">
          <Sidebar />
          <main className="flex-1 overflow-hidden">
            {!supabaseConfigured && (
              <div className="mx-6 mt-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                Supabase env vars are not set. Copy <code>.env.example</code> to <code>.env</code>{" "}
                and restart <code>npm run dev</code>.
              </div>
            )}
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

  return (
    <div className="px-6 py-6 lg:px-8">
      <CalendarStrip />
    </div>
  );
}
