"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { BusinessUnitWithAccess } from "@/types/business-unit";
import type { User } from "@/types/auth";
import type { UserPermissions } from "@/types/rbac";
import { useAuthStore } from "@/stores/authStore";
import { usePermissionStore } from "@/stores/permissionStore";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { QuickActionSidebar } from "@/components/layout/QuickActionSidebar";
import { UnitConverterPanel } from "@/components/layout/UnitConverterPanel";
import { NavigationActivityLogger } from "@/components/activity-logging/NavigationActivityLogger";
import { BusinessUnitProvider } from "@/components/business-unit/BusinessUnitProvider";
import { useLoadPermissions } from "@/hooks/usePermissions";
import { useSidebarStore } from "@/stores/sidebarStore";
import { cn } from "@/lib/utils";

type DashboardShellProps = {
  children: React.ReactNode;
  initialBusinessUnit: BusinessUnitWithAccess | null;
  initialBusinessUnitId: string | null;
  sessionBusinessUnitId: string | null;
  initialUser: User;
  initialToken: string | null;
  initialPermissions: UserPermissions | null;
  initialPermissionScopeKey: string | null;
  initialBusinessUnitName: string | null;
};

export function DashboardShell(props: DashboardShellProps) {
  const router = useRouter();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const isLoggingOut = useAuthStore((state) => state.isLoggingOut);
  const staleAccount = Boolean(currentUserId && currentUserId !== props.initialUser.id);
  const refreshRequested = useRef(false);

  useEffect(() => {
    if (!staleAccount) {
      refreshRequested.current = false;
      return;
    }
    if (isLoggingOut || refreshRequested.current) return;
    refreshRequested.current = true;
    router.refresh();
  }, [isLoggingOut, router, staleAccount]);

  // Do not mount old-account permissions, BU initialization, or page consumers.
  if (staleAccount || isLoggingOut) return null;
  return <DashboardSessionShell key={props.initialUser.id} {...props} />;
}

function DashboardSessionShell({
  children,
  initialBusinessUnit,
  initialBusinessUnitId,
  sessionBusinessUnitId,
  initialUser,
  initialToken,
  initialPermissions,
  initialPermissionScopeKey,
  initialBusinessUnitName,
}: DashboardShellProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoggingOut = useAuthStore((state) => state.isLoggingOut);
  const hydrateFromServer = useAuthStore((state) => state.hydrateFromServer);
  const hasHydratedAuth = useRef(false);
  const setPermissionScope = usePermissionStore((state) => state.setScope);
  const setPermissions = usePermissionStore((state) => state.setPermissions);
  const isSidebarOpen = useSidebarStore((state) => state.isOpen);
  const [hasMounted, setHasMounted] = useState(false);
  const [isUnitConverterOpen, setIsUnitConverterOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sidebarOpen = hasMounted ? isSidebarOpen : true;
  const isManufacturingFloorFullscreen =
    pathname === "/manufacturing/floor" && searchParams.get("fullscreen") === "1";

  // Hydrate auth store from server-rendered user/session to avoid post-mount auth flicker.
  useEffect(() => {
    if (hasHydratedAuth.current) return;
    hasHydratedAuth.current = true;
    hydrateFromServer(initialUser, initialToken);
  }, [hydrateFromServer, initialUser, initialToken]);

  // Hydrate permission store from server-rendered permissions so sidebar can render immediately.
  useEffect(() => {
    if (!isAuthenticated || isLoggingOut || !initialPermissionScopeKey) return;
    setPermissionScope(initialPermissionScopeKey);
    if (initialPermissions) {
      setPermissions(initialPermissions);
    }
  }, [
    isAuthenticated,
    isLoggingOut,
    initialPermissionScopeKey,
    initialPermissions,
    setPermissionScope,
    setPermissions,
  ]);

  // Load user permissions for sidebar/page UI
  useLoadPermissions({
    userId: initialUser.id,
    businessUnitId: initialBusinessUnitId,
    permissions: initialPermissions,
  });

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Unmount protected consumers while sign-out and navigation finish.
  if (isLoggingOut || (hasMounted && !isAuthenticated)) return null;

  return (
    <BusinessUnitProvider
      initialBusinessUnit={initialBusinessUnit}
      initialBusinessUnitId={initialBusinessUnitId}
      sessionBusinessUnitId={sessionBusinessUnitId}
    >
      <NavigationActivityLogger />
      <div className="flex h-screen min-h-0 flex-col overflow-hidden">
        {!isManufacturingFloorFullscreen ? (
          <Sidebar
            initialPermissions={initialPermissions}
            initialBusinessUnitName={initialBusinessUnitName}
          />
        ) : null}
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden transition-[margin] duration-300",
            !isManufacturingFloorFullscreen && (sidebarOpen ? "md:ml-64" : "md:ml-20")
          )}
        >
          {!isManufacturingFloorFullscreen ? <Header /> : null}
          <div className="relative flex min-h-0 flex-1 overflow-hidden">
            <main
              className={cn(
                "min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background",
                isManufacturingFloorFullscreen ? "p-0" : "p-4 sm:p-6"
              )}
            >
              {children}
            </main>
            {!isManufacturingFloorFullscreen ? (
              <>
                <UnitConverterPanel
                  open={isUnitConverterOpen}
                  onClose={() => setIsUnitConverterOpen(false)}
                />
                <QuickActionSidebar
                  initialPermissions={initialPermissions}
                  isUnitConverterOpen={isUnitConverterOpen}
                  onUnitConverterToggle={() => setIsUnitConverterOpen((current) => !current)}
                />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </BusinessUnitProvider>
  );
}
