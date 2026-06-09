"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  clearIntentionalLogoutMarker,
  hasSessionInvalidNoticeShown,
  hasIntentionalLogoutMarker,
  isSessionInvalidStatus,
  markSessionInvalidNoticeShown,
  SESSION_INVALID_EVENT,
} from "@/lib/auth/sessionInvalidation";
import { useAuthStore } from "@/stores/authStore";

const isSameOriginApiRequest = (input: RequestInfo | URL): boolean => {
  const requestUrl =
    input instanceof Request ? input.url : input instanceof URL ? input.toString() : input;

  try {
    const url = new URL(requestUrl, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith("/api");
  } catch {
    return false;
  }
};

export const SessionInvalidDialog = () => {
  const t = useTranslations("sessionInvalidDialog");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sessionParam = searchParams.get("session") ?? "";
  const logout = useAuthStore((state) => state.logout);
  const [open, setOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const openSessionInvalidDialog = useCallback(() => {
    if (hasIntentionalLogoutMarker() || hasSessionInvalidNoticeShown()) return;
    markSessionInvalidNoticeShown();
    setOpen(true);
  }, []);

  useEffect(() => {
    const handleSessionInvalid = () => {
      openSessionInvalidDialog();
    };

    window.addEventListener(SESSION_INVALID_EVENT, handleSessionInvalid);
    return () => window.removeEventListener(SESSION_INVALID_EVENT, handleSessionInvalid);
  }, [openSessionInvalidDialog]);

  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (isSameOriginApiRequest(args[0]) && isSessionInvalidStatus(response.status)) {
        openSessionInvalidDialog();
      }
      return response;
    };

    return () => {
      if (window.fetch !== originalFetch) {
        window.fetch = originalFetch;
      }
    };
  }, [openSessionInvalidDialog]);

  useEffect(() => {
    if (sessionParam === "invalid") {
      if (hasIntentionalLogoutMarker()) {
        clearIntentionalLogoutMarker();
        router.replace("/login");
        return;
      }
      if (hasSessionInvalidNoticeShown()) {
        router.replace("/login");
        return;
      }
      openSessionInvalidDialog();
    } else if (pathname === "/login" && hasIntentionalLogoutMarker()) {
      clearIntentionalLogoutMarker();
    }
  }, [openSessionInvalidDialog, pathname, router, sessionParam]);

  const handleContinue = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setOpen(false);
      setIsLoggingOut(false);
      router.replace("/login");
    }
  }, [logout, router]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen || isLoggingOut) return;
    setOpen(nextOpen);
    if (pathname === "/login" && sessionParam === "invalid") {
      router.replace("/login");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={handleContinue} disabled={isLoggingOut}>
            {isLoggingOut ? t("redirecting") : t("action")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
