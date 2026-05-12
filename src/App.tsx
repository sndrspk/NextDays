import CalendarStrip from "./components/calendar/CalendarStrip";
import TaskDetailPanel from "./components/calendar/TaskDetailPanel";
import CustomListView from "./components/lists/CustomListView";
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
              <div className="mx-8 mt-6 rounded-xl border border-amber-200/70 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 shadow-card backdrop-blur">
                Supabase env vars are not set. Copy <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">.env.example</code> to <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">.env</code>{" "}
                and restart <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">npm run dev</code>.
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

  if (view.kind === "list") {
    return <CustomListView listId={view.id} />;
  }

  return (
    <div className="h-full overflow-y-auto px-8 py-8 lg:px-10">
      <CalendarStrip />
    </div>
  );
}
