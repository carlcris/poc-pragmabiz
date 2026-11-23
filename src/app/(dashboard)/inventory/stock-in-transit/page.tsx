"use client";

import { ProtectedRoute } from "@/components/permissions/ProtectedRoute";
import { RESOURCES } from "@/constants/resources";
import { useAuthStore } from "@/stores/authStore";
import { StockInTransitSplitView } from "./StockInTransitSplitView";

function StockInTransitPageContent({
  isPermissionPending = false,
}: {
  isPermissionPending?: boolean;
}) {
  const companyId = useAuthStore((state) => state.user?.companyId);
  const isAuthPending = useAuthStore((state) => state.isLoading || state.isLoggingOut);
  const isScopeReady = !isPermissionPending && !isAuthPending;

  return (
    <StockInTransitSplitView key={companyId} companyId={companyId} isScopeReady={isScopeReady} />
  );
}

export default function StockInTransitPage() {
  return (
    <ProtectedRoute
      resource={RESOURCES.ITEMS}
      loadingComponent={<StockInTransitPageContent isPermissionPending />}
    >
      <StockInTransitPageContent />
    </ProtectedRoute>
  );
}
