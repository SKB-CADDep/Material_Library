import { useRef } from "react";

export function useStickyTabKey<T extends string>(
  current: T | null,
  fallback: T,
): T {
  const lastRef = useRef<T>(current ?? fallback);
  if (current) {
    lastRef.current = current;
  }
  return current ?? lastRef.current;
}
