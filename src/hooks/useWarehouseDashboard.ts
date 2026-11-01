import { useQuery } from "@tanstack/react-query";
import { WAREHOUSE_DASHBOARD_QUERY_KEY } from "@/hooks/queryKeys";
import { useRealtimeDomainInvalidation } from "@/hooks/useRealtimeDomainInvalidation";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import type { DashboardData } from "@/types/warehouse-dashboard";
import { useAuthStore } from "@/stores/authStore";

export const useWarehouseDashboard = () => {
  const currentBusinessUnitId = useBusinessUnitStore((state) => state.currentBusinessUnit?.id);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoggingOut = useAuthStore((state) => state.isLoggingOut);
  const isActive = isAuthenticated && !isLoggingOut;

  useRealtimeDomainInvalidation("inventory", {
    queryKeys: [WAREHOUSE_DASHBOARD_QUERY_KEY],
    enabled: isActive,
  });

  return useQuery<DashboardData>({
    queryKey: [WAREHOUSE_DASHBOARD_QUERY_KEY, currentBusinessUnitId ?? null],
    enabled: isActive,
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/warehouse-dashboard", { signal });

      if (!response.ok) {
        throw new Error("Failed to fetch dashboard data");
      }

      return response.json();
    },
    staleTime: 30 * 1000, // Match polling window to avoid immediate focus-triggered refetches
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    refetchOnWindowFocus: true, // Refresh when user returns to tab
    retry: 2, // Retry failed requests twice
  });
};
