import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type FontChoice = "inter" | "public-sans" | "instrument-sans" | "hanken-grotesk" | "rethink-sans";

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
  {
    id: "hanken-grotesk",
    label: "Hanken Grotesk",
    stack:
      '"Hanken Grotesk Variable", "Hanken Grotesk", ui-sans-serif, system-ui, sans-serif',
  },
  {
    id: "rethink-sans",
    label: "Rethink Sans",
    stack:
      '"Rethink Sans Variable", "Rethink Sans", ui-sans-serif, system-ui, sans-serif',
  },
];

export const DEFAULT_FONT: FontChoice = "inter";
const FONT_STORAGE_KEY = "nextdays:font";

export type DesktopDayCount = 3 | 5;
export const DESKTOP_DAY_COUNT_OPTIONS: readonly DesktopDayCount[] = [3, 5];
export const DEFAULT_DESKTOP_DAY_COUNT: DesktopDayCount = 5;
const DESKTOP_DAY_COUNT_STORAGE_KEY = "nextdays:desktopDayCount";

export type FontSize = "normal" | "larger" | "largest";

export interface FontSizeOption {
  id: FontSize;
  label: string;
  scale: number;
}

// Each step is +10%. At 1.20× the app still fits comfortably on a 360px-wide
// phone (the calendar stacks vertically anyway), so mobile remains usable.
export const FONT_SIZE_OPTIONS: readonly FontSizeOption[] = [
  { id: "normal", label: "Normal", scale: 1 },
  { id: "larger", label: "Larger", scale: 1.1 },
  { id: "largest", label: "Largest", scale: 1.2 },
];

export const DEFAULT_FONT_SIZE: FontSize = "normal";
const FONT_SIZE_STORAGE_KEY = "nextdays:fontSize";

function readStoredFont(): FontChoice {
  if (typeof window === "undefined") return DEFAULT_FONT;
  const raw = window.localStorage.getItem(FONT_STORAGE_KEY);
  if (raw && FONT_OPTIONS.some((o) => o.id === raw)) {
    return raw as FontChoice;
  }
  return DEFAULT_FONT;
}

function readStoredDesktopDayCount(): DesktopDayCount {
  if (typeof window === "undefined") return DEFAULT_DESKTOP_DAY_COUNT;
  const raw = window.localStorage.getItem(DESKTOP_DAY_COUNT_STORAGE_KEY);
  const parsed = raw === null ? NaN : Number(raw);
  if (DESKTOP_DAY_COUNT_OPTIONS.includes(parsed as DesktopDayCount)) {
    return parsed as DesktopDayCount;
  }
  return DEFAULT_DESKTOP_DAY_COUNT;
}

function readStoredFontSize(): FontSize {
  if (typeof window === "undefined") return DEFAULT_FONT_SIZE;
  const raw = window.localStorage.getItem(FONT_SIZE_STORAGE_KEY);
  if (raw && FONT_SIZE_OPTIONS.some((o) => o.id === raw)) {
    return raw as FontSize;
  }
  return DEFAULT_FONT_SIZE;
}

function stackFor(choice: FontChoice): string {
  return (FONT_OPTIONS.find((o) => o.id === choice) ?? FONT_OPTIONS[0]).stack;
}

function scaleFor(size: FontSize): number {
  return (FONT_SIZE_OPTIONS.find((o) => o.id === size) ?? FONT_SIZE_OPTIONS[0]).scale;
}

interface SettingsState {
  font: FontChoice;
  setFont: (next: FontChoice) => void;
  desktopDayCount: DesktopDayCount;
  setDesktopDayCount: (next: DesktopDayCount) => void;
  fontSize: FontSize;
  setFontSize: (next: FontSize) => void;
}

const SettingsContext = createContext<SettingsState | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [font, setFontState] = useState<FontChoice>(() => readStoredFont());
  const [desktopDayCount, setDesktopDayCountState] = useState<DesktopDayCount>(
    () => readStoredDesktopDayCount(),
  );
  const [fontSize, setFontSizeState] = useState<FontSize>(() => readStoredFontSize());

  useEffect(() => {
    document.documentElement.style.setProperty("--app-font-sans", stackFor(font));
  }, [font]);

  useEffect(() => {
    // CSS `zoom` on <html> proportionally scales typography, spacing, and hit
    // targets across every component, including arbitrary `text-[Npx]` classes
    // that wouldn't respond to a root font-size change. Mobile layouts still
    // adapt because viewport-relative media queries fire before zoom is applied.
    const scale = scaleFor(fontSize);
    document.documentElement.style.setProperty("--app-font-scale", String(scale));
    document.documentElement.style.setProperty("zoom", String(scale));
  }, [fontSize]);

  const setFont = (next: FontChoice) => {
    setFontState(next);
    try {
      window.localStorage.setItem(FONT_STORAGE_KEY, next);
    } catch {
      // localStorage can be unavailable (private mode, quota). Silent fallback —
      // the choice still applies for this session via state.
    }
  };

  const setDesktopDayCount = (next: DesktopDayCount) => {
    setDesktopDayCountState(next);
    try {
      window.localStorage.setItem(DESKTOP_DAY_COUNT_STORAGE_KEY, String(next));
    } catch {
      // see setFont
    }
  };

  const setFontSize = (next: FontSize) => {
    setFontSizeState(next);
    try {
      window.localStorage.setItem(FONT_SIZE_STORAGE_KEY, next);
    } catch {
      // see setFont
    }
  };

  const value = useMemo(
    () => ({ font, setFont, desktopDayCount, setDesktopDayCount, fontSize, setFontSize }),
    [font, desktopDayCount, fontSize],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
