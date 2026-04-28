"use client";

import { Menu } from "lucide-react";
import { useSidebarStore } from "@/stores/sidebarStore";
import { UserMenu } from "@/components/layout/UserMenu";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";
import { CurrencySwitcher } from "@/components/shared/CurrencySwitcher";
import { NotificationsMenu } from "@/components/notifications/NotificationsMenu";
import { Button } from "@/components/ui/button";

export function Header() {
  const toggleSidebar = useSidebarStore((state) => state.toggleSidebar);

  return (
    <header className="border-b border-border bg-background">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        {/* Left: Menu Toggle + Breadcrumb */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-8 w-8 flex-shrink-0 sm:h-9 sm:w-9"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <Breadcrumb />
        </div>

        {/* Right: Actions */}
        <div className="flex flex-shrink-0 items-center gap-2 sm:gap-4">
          <div className="hidden items-center gap-4 sm:flex">
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
