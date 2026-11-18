import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { ITEM_LOCATIONS_QUERY_KEY } from "@/hooks/queryKeys";
import type { StockMoveBatchLookupResponse } from "@/types/stock-move";

export type MoveStockSourceScope = {
  itemId: string;
  businessUnitId: string | undefined;
  warehouseId: string;
  locationId: string;
};

export const moveStockSourceBatchesKey = ({
  itemId,
  businessUnitId,
  warehouseId,
  locationId,
}: MoveStockSourceScope) =>
  [
    ITEM_LOCATIONS_QUERY_KEY,
    itemId,
    businessUnitId,
    "move-batches",
    warehouseId,
    locationId,
  ] as const;

// Keyed under the item locations family so existing inventory and Move Stock
// invalidation refreshes the pinned-batch choices without a bespoke cache entry.
export function useMoveStockSourceBatches({
  page,
  ...source
}: MoveStockSourceScope & { page: number }) {
  const { itemId, warehouseId, locationId } = source;
  return useQuery<StockMoveBatchLookupResponse>({
    queryKey: [...moveStockSourceBatchesKey(source), page],
    queryFn: () =>
      apiClient.get("/api/lookups/stock-move-batches", {
        params: { itemId, warehouseId, locationId, page },
      }),
    enabled: Boolean(itemId && warehouseId && locationId),
  });
}
