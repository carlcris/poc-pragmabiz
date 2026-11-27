import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import type { InventoryBoxCountBusinessUnitsResponse } from "@/types/inventory-box-count-report";

export const INVENTORY_BOX_COUNT_BUSINESS_UNIT_SEARCH_MAX_LENGTH = 100;
const BUSINESS_UNIT_PAGE_SIZE = 5;

export function useInventoryBoxCountBusinessUnits({
  companyId,
  currentBusinessUnitId,
  search,
  enabled,
}: {
  companyId?: string;
  currentBusinessUnitId?: string;
  search: string;
  enabled: boolean;
}) {
  const userId = useAuthStore((state) => state.user?.id);
  const signedIn = useAuthStore((state) => state.isAuthenticated && !state.isLoggingOut);
  const normalizedSearch = search
    .trim()
    .slice(0, INVENTORY_BOX_COUNT_BUSINESS_UNIT_SEARCH_MAX_LENGTH);

  return useInfiniteQuery({
    // Role assignment and removal already invalidate business-unit memberships.
    queryKey: [
      "business-units",
      "inventory-box-count",
      userId,
      companyId,
      currentBusinessUnitId,
      normalizedSearch,
    ],
    queryFn: ({ pageParam, signal }) =>
      apiClient.get<InventoryBoxCountBusinessUnitsResponse>(
        "/api/reports/inventory-box-count/business-units",
        {
          params: {
            page: pageParam,
            limit: BUSINESS_UNIT_PAGE_SIZE,
            search: normalizedSearch || undefined,
          },
          signal,
        }
      ),
    initialPageParam: 1,
    getNextPageParam: ({ pagination }) =>
      pagination.page < pagination.totalPages ? pagination.page + 1 : undefined,
    enabled: enabled && signedIn && Boolean(userId && companyId),
    staleTime: 60_000,
  });
}
