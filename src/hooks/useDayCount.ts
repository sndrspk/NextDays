import { useEffect, useState } from "react";

const WIDE_QUERY = "(min-width: 1280px)";
const WIDE_COUNT = 7;
const NARROW_COUNT = 4;

function currentCount(): number {
  if (typeof window === "undefined") return WIDE_COUNT;
  return window.matchMedia(WIDE_QUERY).matches ? WIDE_COUNT : NARROW_COUNT;
}

export function useDayCount(): number {
  const [count, setCount] = useState<number>(currentCount);

  useEffect(() => {
    const mql = window.matchMedia(WIDE_QUERY);
    const handler = () => setCount(mql.matches ? WIDE_COUNT : NARROW_COUNT);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return count;
}
