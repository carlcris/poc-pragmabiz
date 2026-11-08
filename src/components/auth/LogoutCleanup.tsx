"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

export function LogoutCleanup() {
  const pathname = usePathname();
  const isLogoutReady = useAuthStore((state) => state.isLogoutReady);
  const completeLogout = useAuthStore((state) => state.completeLogout);

  useEffect(() => {
    if (pathname === "/login" && isLogoutReady) completeLogout();
  }, [pathname, isLogoutReady, completeLogout]);

  return null;
}
