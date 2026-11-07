import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { ITEM_LOCATIONS_QUERY_KEY } from "@/hooks/queryKeys";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import type { ItemLocationStockNode, ItemStockPagination } from "@/types/inventory-location";

// Exact selection shares stock-move invalidation without depending on the visible tree page.
export function useItemLocationStockNode(
  itemId: string,
  warehouseId: string | undefined,
  locationId: string | undefined
) {
  const businessUnitId = useBusinessUnitStore((state) => state.currentBusinessUnit?.id);
  return useQuery({
    queryKey: [
      ITEM_LOCATIONS_QUERY_KEY,
      itemId,
      businessUnitId ?? null,
      "node",
      warehouseId,
      locationId,
    ],
    queryFn: () =>
      apiClient.get<{ data: ItemLocationStockNode[]; pagination: ItemStockPagination }>(
        `/api/items/${itemId}/location-stock-tree`,
        { params: { warehouseId, locationId, limit: 1 } }
      ),
    enabled: Boolean(itemId && warehouseId && locationId),
  });
}
