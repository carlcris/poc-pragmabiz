"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { resolveNavigationPage } from "@/lib/activity-logging/navigation-pages";

export function NavigationActivityLogger() {
  const pathname = usePathname();
  const lastLoggedPathRef = useRef<string | null>(null);

  useEffect(() => {
    const page = resolveNavigationPage(pathname);
    if (!page || lastLoggedPathRef.current === pathname) return;

    const fromPath = lastLoggedPathRef.current;
    lastLoggedPathRef.current = pathname;

    void fetch("/api/activity/navigation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify({
        path: pathname,
        ...(fromPath ? { fromPath } : {}),
      }),
    }).catch(() => {
      // Navigation logging is best-effort and must not affect page navigation.
    });
  }, [pathname]);

  return null;
}
