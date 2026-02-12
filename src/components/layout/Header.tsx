"use client";

import { Menu } from "lucide-react";
import { useSidebarStore } from "@/stores/sidebarStore";
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";
import { CurrencySwitcher } from "@/components/shared/CurrencySwitcher";
import { NotificationsMenu } from "@/components/notifications/NotificationsMenu";
import { UserMenu } from "@/components/layout/UserMenu";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ClientOnly } from "@/components/shared/ClientOnly";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export function Header() {
  const toggleSidebar = useSidebarStore((state) => state.toggleSidebar);

  return (
    <header className="border-b border-border bg-background">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
        {/* Left: Menu Toggle + Breadcrumb */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="flex-shrink-0 h-8 w-8 sm:h-9 sm:w-9"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <Breadcrumb />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-4">
            <LanguageSwitcher />
            <CurrencySwitcher />
          </div>
          <ClientOnly fallback={<Skeleton className="h-8 w-8 sm:h-10 sm:w-10 rounded-full" />}>
            <NotificationsMenu />
          </ClientOnly>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
