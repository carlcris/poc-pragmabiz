import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { InventoryBoxCountPackingUnitsResponse } from "@/types/inventory-box-count-report";

export const INVENTORY_BOX_COUNT_UNIT_SEARCH_MAX_LENGTH = 100;

export function useInventoryBoxCountPackingUnits({
  companyId,
  businessUnitId,
  search = "",
  enabled,
}: {
  companyId?: string;
  businessUnitId?: string;
  search?: string;
  enabled: boolean;
}) {
  const normalizedSearch = search.trim().slice(0, INVENTORY_BOX_COUNT_UNIT_SEARCH_MAX_LENGTH);
  return useInfiniteQuery({
    queryKey: ["inventory-box-count-packing-units", companyId, businessUnitId, normalizedSearch],
    queryFn: ({ pageParam, signal }) =>
      apiClient.get<InventoryBoxCountPackingUnitsResponse>(
        "/api/reports/inventory-box-count/packing-units",
        {
          params: { search: normalizedSearch || undefined, page: pageParam, limit: 5 },
          signal,
        }
      ),
    initialPageParam: 1,
    getNextPageParam: ({ pagination }) =>
      pagination.page < pagination.totalPages ? pagination.page + 1 : undefined,
    enabled: enabled && Boolean(companyId),
    staleTime: 60_000,
  });
}
