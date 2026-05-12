import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { UUID } from "../types";

interface SelectionState {
  selectedTaskId: UUID | null;
  setSelectedTaskId: (id: UUID | null) => void;
}

const SelectionContext = createContext<SelectionState | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedTaskId, setSelectedTaskId] = useState<UUID | null>(null);
  const value = useMemo(() => ({ selectedTaskId, setSelectedTaskId }), [selectedTaskId]);
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection must be used inside SelectionProvider");
  return ctx;
}
