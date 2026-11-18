"use client";

import { useEffect, useState } from "react";

/** `value`, updated at most every `ms` milliseconds (RULES.md §5: debounce detection and preview). */
export function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
