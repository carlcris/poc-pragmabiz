import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { ITEM_LOCATIONS_QUERY_KEY } from "@/hooks/queryKeys";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import type { ItemStockPagination, ItemWarehouseStock } from "@/types/inventory-location";

export function useItemWarehouseStock(itemId: string, page: number) {
  const businessUnitId = useBusinessUnitStore((state) => state.currentBusinessUnit?.id);
  return useQuery({
    queryKey: [ITEM_LOCATIONS_QUERY_KEY, itemId, businessUnitId ?? null, "warehouses", page],
    queryFn: () =>
      apiClient.get<{ data: ItemWarehouseStock[]; pagination: ItemStockPagination }>(
        `/api/items/${itemId}/warehouse-stock`,
        { params: { page, limit: 20 } }
      ),
    enabled: Boolean(itemId),
  });
}
