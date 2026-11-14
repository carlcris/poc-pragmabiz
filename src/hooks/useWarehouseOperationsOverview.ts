import { useQuery } from "@tanstack/react-query";
import { WAREHOUSE_DASHBOARD_QUERY_KEY } from "@/hooks/queryKeys";
import { useAuthStore } from "@/stores/authStore";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import type {
  OperationsOverviewRange,
  WarehouseOperationsOverview,
} from "@/types/warehouse-operations-overview";

export const OPERATIONS_OVERVIEW_QUERY_SEGMENT = "operations-overview";

// Nested under the warehouse dashboard key so every mutation that already invalidates
// the dashboard (stock adjustments, moves, putaway, business-unit switches) refreshes
// the overview too. The server derives "today" from the time zone on every fetch.
export const getWarehouseOperationsOverviewQueryKey = (
  businessUnitId: string | null,
  days: OperationsOverviewRange,
  timeZone: string
) => [
  WAREHOUSE_DASHBOARD_QUERY_KEY,
  OPERATIONS_OVERVIEW_QUERY_SEGMENT,
  businessUnitId,
  days,
  timeZone,
];

export const useWarehouseOperationsOverview = (days: OperationsOverviewRange) => {
  const businessUnitId = useBusinessUnitStore((state) => state.currentBusinessUnit?.id ?? null);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoggingOut = useAuthStore((state) => state.isLoggingOut);
  const isActive = isAuthenticated && !isLoggingOut;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return useQuery<WarehouseOperationsOverview>({
    queryKey: getWarehouseOperationsOverviewQueryKey(businessUnitId, days, timeZone),
    enabled: isActive,
    placeholderData: (previous) => previous,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ timeZone, days: String(days) });
      const response = await fetch(`/api/warehouse-dashboard/operations-overview?${params}`, {
        signal,
      });
      if (!response.ok) {
        throw new Error("Failed to fetch warehouse operations overview");
      }
      return response.json();
    },
    // Trend data is an expensive aggregate: the user's own mutations invalidate it, and
    // other users' changes arrive by gentle polling rather than per-row realtime events.
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 2,
  });
};
