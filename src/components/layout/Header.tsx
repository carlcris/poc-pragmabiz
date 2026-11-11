"use client";

import { Menu } from "lucide-react";
import { useSidebarStore } from "@/stores/sidebarStore";
import { UserMenu } from "@/components/layout/UserMenu";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";
import { CurrencySwitcher } from "@/components/shared/CurrencySwitcher";
import { NotificationsMenu } from "@/components/notifications/NotificationsMenu";
import { Button } from "@/components/ui/button";

// Below md the header has no row of its own: its account actions sit on the
// right of the sidebar's 56px brand bar (DashboardShell is the positioning
// context), so phones get one top bar instead of two.
export function Header() {
  const toggleSidebar = useSidebarStore((state) => state.toggleSidebar);

  return (
    <header className="border-b border-border bg-background max-md:absolute max-md:right-0 max-md:top-0 max-md:z-40 max-md:border-b-0 max-md:bg-transparent max-md:text-white">
      <div className="flex items-center justify-between gap-3 px-4 py-4 max-md:h-14 max-md:px-1.5 max-md:py-0 xl:px-6">
        {/* Left: Menu Toggle + Breadcrumb */}
        <div className="flex min-w-0 flex-1 items-center gap-3 max-md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-9 w-9 flex-shrink-0"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Breadcrumb />
        </div>

        {/* Right: Actions */}
        <div className="flex flex-shrink-0 items-center gap-1 md:gap-2 xl:gap-4">
          <div className="hidden items-center gap-2 md:flex xl:gap-4">
            <LanguageSwitcher />
            <CurrencySwitcher />
          </div>
          <NotificationsMenu />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
