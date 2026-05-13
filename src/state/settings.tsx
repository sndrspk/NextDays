import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type FontChoice = "inter" | "public-sans" | "instrument-sans";

export interface FontOption {
  id: FontChoice;
  label: string;
  stack: string;
}

export const FONT_OPTIONS: readonly FontOption[] = [
  {
    id: "inter",
    label: "Inter",
    stack: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  },
  {
    id: "public-sans",
    label: "Public Sans",
    stack: '"Public Sans Variable", "Public Sans", ui-sans-serif, system-ui, sans-serif',
  },
  {
    id: "instrument-sans",
    label: "Instrument Sans",
    stack:
      '"Instrument Sans Variable", "Instrument Sans", ui-sans-serif, system-ui, sans-serif',
  },
];

export const DEFAULT_FONT: FontChoice = "inter";
const STORAGE_KEY = "nextdays:font";

function readStoredFont(): FontChoice {
  if (typeof window === "undefined") return DEFAULT_FONT;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw && FONT_OPTIONS.some((o) => o.id === raw)) {
    return raw as FontChoice;
  }
  return DEFAULT_FONT;
}

function stackFor(choice: FontChoice): string {
  return (FONT_OPTIONS.find((o) => o.id === choice) ?? FONT_OPTIONS[0]).stack;
}

interface SettingsState {
  font: FontChoice;
  setFont: (next: FontChoice) => void;
}

const SettingsContext = createContext<SettingsState | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [font, setFontState] = useState<FontChoice>(() => readStoredFont());

  useEffect(() => {
    document.documentElement.style.setProperty("--app-font-sans", stackFor(font));
  }, [font]);

  const setFont = (next: FontChoice) => {
    setFontState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage can be unavailable (private mode, quota). Silent fallback —
      // the choice still applies for this session via state.
    }
  };

  const value = useMemo(() => ({ font, setFont }), [font]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
