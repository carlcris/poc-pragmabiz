"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { getInitials } from "@/lib/string";
import { useAuthStore } from "@/stores/authStore";

// Ring radius 38 inside an 80px box; the arc keyframes animate offsets within this length.
const ARC_LENGTH = 239;

export function LogoutBackdrop() {
  const t = useTranslations("userMenu");
  const dialogRef = useRef<HTMLDialogElement>(null);
  // completeLogout clears the user while this backdrop is still shown; keep the farewell stable.
  const [farewellUser] = useState(() => useAuthStore.getState().user);
  const firstName = farewellUser?.firstName || farewellUser?.name.split(/\s+/)[0] || "";
  const initials = farewellUser?.name ? getInitials(farewellUser.name) : "";

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    // Native modal inertness blocks page focus and clicks, including portals.
    // Stop keyboard shortcuts registered on document/window while signing out.
    const blockShortcut = (event: KeyboardEvent) => {
      event.stopImmediatePropagation();
      if (event.key !== "Tab") event.preventDefault();
    };
    window.addEventListener("keydown", blockShortcut, true);
    window.addEventListener("keyup", blockShortcut, true);
    return () => {
      window.removeEventListener("keydown", blockShortcut, true);
      window.removeEventListener("keyup", blockShortcut, true);
      dialog?.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-label={t("signingOut")}
      onCancel={(event) => event.preventDefault()}
      className="pointer-events-auto fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0 text-white backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <div className="flex h-full items-center justify-center p-6">
        <div role="status" className="flex flex-col items-center gap-5 text-center">
          <div aria-hidden="true" className="relative flex h-20 w-20 items-center justify-center">
            <svg
              viewBox="0 0 80 80"
              className="absolute inset-0 h-full w-full animate-logout-ring-spin motion-reduce:animate-none"
            >
              <circle
                cx="40"
                cy="40"
                r="38"
                fill="none"
                strokeWidth="3"
                className="stroke-white/15"
              />
              <circle
                cx="40"
                cy="40"
                r="38"
                fill="none"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={ARC_LENGTH}
                className="animate-logout-arc-draw stroke-primary motion-reduce:animate-none"
              />
            </svg>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
              {initials || <LogOut className="h-6 w-6" />}
            </div>
            <div className="absolute -right-0.5 bottom-0.5 flex h-7 w-7 animate-logout-badge-nudge items-center justify-center rounded-full bg-background text-primary shadow-md motion-reduce:animate-none">
              <LogOut className="h-3.5 w-3.5" strokeWidth={2.4} />
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-base font-semibold">
              {firstName ? t("farewellNamed", { name: firstName }) : t("farewell")}
            </span>
            <span className="text-sm text-white/70">{t("signingOut")}</span>
          </div>
        </div>
      </div>
    </dialog>
  );
}
