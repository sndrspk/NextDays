import { useEffect, useState } from "react";
import { useSettings } from "../state/settings";

// Three responsive tiers:
// - phones (< 640px) → 3 days, stacked vertically by CalendarStrip
// - tablets / small laptops (640–1279px) → 4 days, horizontal
// - wide screens (≥ 1280px) → user-chosen 3 or 5 days, horizontal
const WIDE_QUERY = "(min-width: 1280px)";
const MID_QUERY = "(min-width: 640px)";
const MID_COUNT = 4;
const NARROW_COUNT = 3;

type Tier = "wide" | "mid" | "narrow";

function currentTier(): Tier {
  if (typeof window === "undefined") return "wide";
  if (window.matchMedia(WIDE_QUERY).matches) return "wide";
  if (window.matchMedia(MID_QUERY).matches) return "mid";
  return "narrow";
}

export function useDayCount(): number {
  const { desktopDayCount } = useSettings();
  const [tier, setTier] = useState<Tier>(currentTier);

  useEffect(() => {
    const wide = window.matchMedia(WIDE_QUERY);
    const mid = window.matchMedia(MID_QUERY);
    const update = () => setTier(currentTier());
    wide.addEventListener("change", update);
    mid.addEventListener("change", update);
    return () => {
      wide.removeEventListener("change", update);
      mid.removeEventListener("change", update);
    };
  }, []);

  if (tier === "wide") return desktopDayCount;
  if (tier === "mid") return MID_COUNT;
  return NARROW_COUNT;
}
