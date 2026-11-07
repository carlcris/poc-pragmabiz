import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { WarehouseLocation } from "@/types/inventory-location";

const WAREHOUSE_LOCATION_TREE_PAGE_SIZE = 50;

type WarehouseLocationChildrenResponse = {
  data: WarehouseLocation[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

// Loads one bounded level of the structure tree; deeper levels load only when expanded.
export function useWarehouseLocationChildren(
  warehouseId: string,
  parentId: string | null,
  page = 1
) {
  return useQuery({
    queryKey: ["warehouse-locations", warehouseId, "children", parentId ?? "root", page],
    queryFn: () =>
      apiClient.get<WarehouseLocationChildrenResponse>(`/api/warehouses/${warehouseId}/locations`, {
        params: {
          page,
          limit: WAREHOUSE_LOCATION_TREE_PAGE_SIZE,
          parentId: parentId ?? undefined,
          rootsOnly: parentId ? "false" : "true",
        },
      }),
    enabled: Boolean(warehouseId),
  });
}
