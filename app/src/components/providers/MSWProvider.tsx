"use client";

import { useEffect, useState } from "react";

export function MSWProvider({ children }: { children: React.ReactNode }) {
  const [mswReady, setMswReady] = useState(false);

  useEffect(() => {
    const initMocks = async () => {
      if (typeof window !== "undefined") {
        if (process.env.NODE_ENV === "development") {
          const { worker } = await import("@/mocks/browser");
          await worker.start({
            onUnhandledRequest: "bypass",
          });
          setMswReady(true);
        } else {
          setMswReady(true);
        }
      }
    };

    initMocks();
  }, []);

  if (!mswReady) {
    return null;
  }

  return <>{children}</>;
}
