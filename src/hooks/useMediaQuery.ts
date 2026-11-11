"use client";

import { useCallback, useSyncExternalStore } from "react";

const getServerMatch = () => false;

/**
 * Tracks a CSS media query. Server rendering and hydration report `false`, then the
 * client value takes over, so callers should treat `false` as the narrow layout.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mediaQueryList = window.matchMedia(query);
      mediaQueryList.addEventListener("change", onChange);
      return () => mediaQueryList.removeEventListener("change", onChange);
    },
    [query]
  );
  const getClientMatch = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getClientMatch, getServerMatch);
}
