"use client";

import { useAuthStore } from "@/stores/authStore";
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";
import { CurrencySwitcher } from "@/components/shared/CurrencySwitcher";
import { NotificationsMenu } from "@/components/notifications/NotificationsMenu";
import { UserMenu } from "@/components/layout/UserMenu";
import { ClientOnly } from "@/components/shared/ClientOnly";
import { Skeleton } from "@/components/ui/skeleton";

export function Header() {
  const user = useAuthStore((state) => state.user);

  return (
    <header className="flex h-14 sm:h-16 items-center justify-between border-b border-border bg-background px-4 sm:px-6">
      <div className="flex items-center gap-3 sm:gap-4">
        <h2 className="text-sm sm:text-lg font-semibold truncate">
          Welcome, {user?.name || "User"}
        </h2>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="hidden sm:flex items-center gap-4">
          <LanguageSwitcher />
          <CurrencySwitcher />
        </div>
        <ClientOnly fallback={<Skeleton className="h-8 w-8 sm:h-10 sm:w-10 rounded-full" />}>
          <NotificationsMenu />
        </ClientOnly>

        <UserMenu />
      </div>
    </header>
  );
}
