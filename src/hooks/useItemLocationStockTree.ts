import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { ITEM_LOCATIONS_QUERY_KEY } from "@/hooks/queryKeys";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import type { ItemLocationStockNode, ItemStockPagination } from "@/types/inventory-location";

// One bounded level of an item's stock tree; deeper levels load only when opened.
export function useItemLocationStockTree(
  itemId: string,
  warehouseId: string,
  parentId: string | null,
  page = 1
) {
  const businessUnitId = useBusinessUnitStore((state) => state.currentBusinessUnit?.id);
  return useQuery({
    queryKey: [
      ITEM_LOCATIONS_QUERY_KEY,
      itemId,
      businessUnitId ?? null,
      "tree",
      warehouseId,
      parentId ?? "root",
      page,
    ],
    queryFn: () =>
      apiClient.get<{ data: ItemLocationStockNode[]; pagination: ItemStockPagination }>(
        `/api/items/${itemId}/location-stock-tree`,
        { params: { warehouseId, parentId: parentId ?? undefined, page, limit: 50 } }
      ),
    enabled: Boolean(itemId && warehouseId),
  });
}
