import { useEffect, useState } from "react";
import SignIn from "./components/auth/SignIn";
import AddTaskView from "./components/calendar/AddTaskView";
import CalendarStrip from "./components/calendar/CalendarStrip";
import TaskDetailPanel from "./components/calendar/TaskDetailPanel";
import FocusView from "./components/focus/FocusView";
import CustomListView from "./components/lists/CustomListView";
import ProjectView from "./components/projects/ProjectView";
import SettingsView from "./components/settings/SettingsView";
import TagView from "./components/tags/TagView";
import Sidebar from "./components/sidebar/Sidebar";
import { ToastContainer } from "./components/common/Toast";
import { useRecurrenceGenerator } from "./hooks/useRecurrenceGenerator";
import { useRollover } from "./hooks/useRollover";
import { supabaseConfigured } from "./lib/supabase";
import { AuthProvider, useAuth } from "./state/auth";
import { SelectionProvider } from "./state/selection";
import { SettingsProvider } from "./state/settings";
import { ToastProvider } from "./state/toast";
import { ViewProvider, useView } from "./state/view";

export default function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </SettingsProvider>
  );
}

function AuthGate() {
  const { session, loading } = useAuth();

  if (!supabaseConfigured) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
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
        Loading...
      </div>
    );
  }

  if (!session) {
    return <SignIn />;
  }

  return (
    <ToastProvider>
      <SelectionProvider>
        <ViewProvider>
          <AppShell />
        </ViewProvider>
      </SelectionProvider>
    </ToastProvider>
  );
}

function AppShell() {
  useRollover();
  useRecurrenceGenerator();
  const { view } = useView();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Close the mobile drawer whenever the active view changes.
  const viewKey = view.kind + ("id" in view ? `:${view.id}` : "tag" in view ? `:${view.tag}` : "");
  useEffect(() => {
    setMobileNavOpen(false);
  }, [viewKey]);

  return (
    <div className="flex h-full">
      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
      <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <MobileTopBar onOpenNav={() => setMobileNavOpen(true)} />
        <div className="min-h-0 flex-1 overflow-hidden">
          <MainView />
        </div>
      </main>
      <TaskDetailPanel />
      <ToastContainer />
    </div>
  );
}

function MobileTopBar({ onOpenNav }: { onOpenNav: () => void }) {
  const { view } = useView();
  const label =
    view.kind === "calendar"
      ? "Calendar"
      : view.kind === "focus"
      ? "Focus"
      : view.kind === "project"
      ? "Project"
      : view.kind === "settings"
      ? "Settings"
      : view.kind === "addTask"
      ? "Add task"
      : view.kind === "tag"
      ? `Tag: #${view.tag}`
      : "List";

  return (
    <header className="flex flex-none items-center gap-3 border-b border-slate-200/70 bg-white/80 px-3 py-2.5 md:hidden">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open navigation"
        className="focus-ring -ml-1 inline-flex h-9 w-9 items-center justify-center rounded-lg text-stone-600 transition-colors hover:bg-slate-100 hover:text-stone-900"
      >
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
        </svg>
      </button>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">
          NextDays
        </div>
        <div className="truncate text-[14px] font-semibold tracking-tight text-stone-900">
          {label}
        </div>
      </div>
    </header>
  );
}

function MainView() {
  const { view } = useView();

  if (view.kind === "focus") {
    return (
      <div className="h-full overflow-y-auto">
        <FocusView />
      </div>
    );
  }

  if (view.kind === "project") {
    return <ProjectView projectId={view.id} />;
  }

  if (view.kind === "list") {
    return <CustomListView listId={view.id} />;
  }

  if (view.kind === "settings") {
    return <SettingsView />;
  }

  if (view.kind === "addTask") {
    return <AddTaskView />;
  }

  if (view.kind === "tag") {
    return (
      <div className="h-full overflow-y-auto">
        <TagView tag={view.tag} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-5 sm:px-8 sm:py-8 lg:px-10">
      <CalendarStrip />
    </div>
  );
}
