"use client";

import { useEffect, useState } from "react";
import type { User } from "@/types/auth";
import type { UserPermissions } from "@/types/rbac";
import { useAuthStore } from "@/stores/authStore";
import { usePermissionStore } from "@/stores/permissionStore";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { BusinessUnitProvider } from "@/components/business-unit/BusinessUnitProvider";
import { useLoadPermissions } from "@/hooks/usePermissions";
import { useSidebarStore } from "@/stores/sidebarStore";
import { cn } from "@/lib/utils";

type DashboardShellProps = {
  children: React.ReactNode;
  initialUser: User;
  initialToken: string | null;
  initialPermissions: UserPermissions | null;
  initialPermissionScopeKey: string | null;
  initialBusinessUnitName: string | null;
};

export function DashboardShell({
  children,
  initialUser,
  initialToken,
  initialPermissions,
  initialPermissionScopeKey,
  initialBusinessUnitName,
}: DashboardShellProps) {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const setToken = useAuthStore((state) => state.setToken);
  const setLoading = useAuthStore((state) => state.setLoading);
  const setPermissionScope = usePermissionStore((state) => state.setScope);
  const setPermissions = usePermissionStore((state) => state.setPermissions);
  const isSidebarOpen = useSidebarStore((state) => state.isOpen);
  const [hasMounted, setHasMounted] = useState(false);
  const sidebarOpen = hasMounted ? isSidebarOpen : true;

  // Hydrate auth store from server-rendered user/session to avoid post-mount auth flicker.
  useEffect(() => {
    if (!user || user.id !== initialUser.id) {
      setUser(initialUser);
    }
    setToken(initialToken);
    setLoading(false);
  }, [initialUser, initialToken, setLoading, setToken, setUser, user]);

  // Hydrate permission store from server-rendered permissions so sidebar can render immediately.
  useEffect(() => {
    if (!initialPermissionScopeKey) return;
    setPermissionScope(initialPermissionScopeKey);
    if (initialPermissions) {
      setPermissions(initialPermissions);
    }
  }, [initialPermissionScopeKey, initialPermissions, setPermissionScope, setPermissions]);

  // Load user permissions for sidebar/page UI
  useLoadPermissions();

  useEffect(() => {
    setHasMounted(true);
  }, []);

  return (
    <BusinessUnitProvider>
      <div className="flex h-screen min-h-0 flex-col overflow-hidden">
        <Sidebar
          initialPermissions={initialPermissions}
          initialBusinessUnitName={initialBusinessUnitName}
        />
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden transition-[margin] duration-300",
            sidebarOpen ? "md:ml-64" : "md:ml-20"
          )}
        >
          <Header />
          <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </BusinessUnitProvider>
  );
}
