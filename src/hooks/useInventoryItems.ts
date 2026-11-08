import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { ITEMS_QUERY_KEY } from "@/hooks/queryKeys";
import { useRealtimeDomainInvalidation } from "@/hooks/useRealtimeDomainInvalidation";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import type { ItemInventoryResponse, ItemInventoryRow } from "@/types/item-inventory";

type InventoryItemsFilters = {
  search?: string;
  category?: string;
  warehouseId?: string;
  status?: ItemInventoryRow["status"] | "all";
  page: number;
  limit: number;
  enabled: boolean;
};

export function useInventoryItems({ enabled, ...filters }: InventoryItemsFilters) {
  const businessUnitId = useBusinessUnitStore((state) => state.currentBusinessUnit?.id);
  useRealtimeDomainInvalidation("stock", { enabled });
  return useQuery({
    queryKey: [ITEMS_QUERY_KEY, "inventory", businessUnitId, filters],
    enabled,
    queryFn: () => {
      const params = new URLSearchParams({
        view: "inventory",
        page: String(filters.page),
        limit: String(filters.limit),
      });
      if (filters.search) params.set("search", filters.search);
      if (filters.category) params.set("category", filters.category);
      if (filters.warehouseId) params.set("warehouseId", filters.warehouseId);
      if (filters.status && filters.status !== "all") params.set("status", filters.status);
      return apiClient.get<ItemInventoryResponse>(`/api/items?${params}`);
    },
    placeholderData: (previousData, previousQuery) =>
      businessUnitId && previousQuery?.queryKey[2] === businessUnitId ? previousData : undefined,
    staleTime: 30_000,
  });
}
