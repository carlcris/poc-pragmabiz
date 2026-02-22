"use client";

import dynamic from "next/dynamic";
import { Menu } from "lucide-react";
import { useSidebarStore } from "@/stores/sidebarStore";
import { UserMenu } from "@/components/layout/UserMenu";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ClientOnly } from "@/components/shared/ClientOnly";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const LanguageSwitcher = dynamic(
  () => import("@/components/shared/LanguageSwitcher").then((mod) => mod.LanguageSwitcher),
  { ssr: false, loading: () => <Skeleton className="h-8 w-24" /> }
);

const CurrencySwitcher = dynamic(
  () => import("@/components/shared/CurrencySwitcher").then((mod) => mod.CurrencySwitcher),
  { ssr: false, loading: () => <Skeleton className="h-8 w-20" /> }
);

const NotificationsMenu = dynamic(
  () => import("@/components/notifications/NotificationsMenu").then((mod) => mod.NotificationsMenu),
  { ssr: false, loading: () => <Skeleton className="h-8 w-8 sm:h-10 sm:w-10 rounded-full" /> }
);

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
