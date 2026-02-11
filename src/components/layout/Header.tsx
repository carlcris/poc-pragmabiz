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
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold">Welcome, {user?.name || "User"}</h2>
      </div>

      <div className="flex items-center gap-4">
        <LanguageSwitcher />
        <CurrencySwitcher />
        <ClientOnly fallback={<Skeleton className="h-10 w-10 rounded-full" />}>
          <NotificationsMenu />
        </ClientOnly>

        <UserMenu />
      </div>
    </header>
  );
}
