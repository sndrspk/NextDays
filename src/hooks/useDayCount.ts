import { useEffect, useState } from "react";

// Three responsive tiers:
// - phones (< 640px) → 3 days, stacked vertically by CalendarStrip
// - tablets / small laptops (640–1279px) → 4 days, horizontal
// - wide screens (≥ 1280px) → 7 days, horizontal
const WIDE_QUERY = "(min-width: 1280px)";
const MID_QUERY = "(min-width: 640px)";
const WIDE_COUNT = 7;
const MID_COUNT = 4;
const NARROW_COUNT = 3;

function currentCount(): number {
  if (typeof window === "undefined") return WIDE_COUNT;
  if (window.matchMedia(WIDE_QUERY).matches) return WIDE_COUNT;
  if (window.matchMedia(MID_QUERY).matches) return MID_COUNT;
  return NARROW_COUNT;
}

export function useDayCount(): number {
  const [count, setCount] = useState<number>(currentCount);

  useEffect(() => {
    const wide = window.matchMedia(WIDE_QUERY);
    const mid = window.matchMedia(MID_QUERY);
    const update = () => setCount(currentCount());
    wide.addEventListener("change", update);
    mid.addEventListener("change", update);
    return () => {
      wide.removeEventListener("change", update);
      mid.removeEventListener("change", update);
    };
  }, []);

  return count;
}
