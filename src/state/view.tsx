import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { UUID } from "../types";

export type View =
  | { kind: "calendar" }
  | { kind: "focus" }
  | { kind: "project"; id: UUID }
  | { kind: "list"; id: UUID };

interface ViewState {
  view: View;
  setView: (next: View) => void;
}

const ViewContext = createContext<ViewState | null>(null);

export function ViewProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>({ kind: "calendar" });
  const value = useMemo(() => ({ view, setView }), [view]);
  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
}

export function useView() {
  const ctx = useContext(ViewContext);
  if (!ctx) throw new Error("useView must be used inside ViewProvider");
  return ctx;
}
