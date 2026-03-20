import { useState, useEffect, useRef } from "react";

/**
 * Debounce a value by `delay` ms.
 * Use for search inputs to avoid hitting the DB on every keystroke.
 */
export function useDebounce<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
