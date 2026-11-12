"use client";

import { useCallback, useSyncExternalStore } from "react";

const getServerMatch = () => undefined;

/**
 * Tracks a CSS media query. Server rendering and hydration report `undefined`
 * because the viewport is unknown there; render breakpoint-neutral content (for
 * example CSS-switched skeletons) until the client value arrives.
 */
export function useMediaQuery(query: string): boolean | undefined {
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
