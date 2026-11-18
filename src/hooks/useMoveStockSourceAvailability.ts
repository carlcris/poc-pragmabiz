import { useQuery } from "@tanstack/react-query";
import { moveStockSourceBatchesKey, type MoveStockSourceScope } from "./useMoveStockSourceBatches";
import { apiClient } from "@/lib/api";
import type { StockMoveBatchSelection } from "@/lib/validations/stock-move";
import {
  MAX_STOCK_MOVE_BATCH_SELECTION,
  type StockMoveSourceAvailabilityResponse,
} from "@/types/stock-move";

export function useMoveStockSourceAvailability(
  source: MoveStockSourceScope,
  { mode, batchLocationIds }: StockMoveBatchSelection
) {
  const { itemId, businessUnitId, warehouseId, locationId } = source;
  const sortedIds = [...batchLocationIds].sort();
  return useQuery({
    queryKey: [...moveStockSourceBatchesKey(source), "availability", mode, sortedIds],
    enabled:
      Boolean(itemId && businessUnitId && warehouseId && locationId) &&
      (mode === "exclude" || sortedIds.length > 0) &&
      sortedIds.length <= MAX_STOCK_MOVE_BATCH_SELECTION,
    staleTime: 0,
    queryFn: ({ signal }) =>
      apiClient.get<StockMoveSourceAvailabilityResponse>("/api/lookups/stock-move-batches", {
        params: {
          view: "availability",
          itemId,
          warehouseId,
          locationId,
          selectionMode: mode,
          batchLocationIds: sortedIds.length ? sortedIds.join(",") : undefined,
        },
        signal,
      }),
  });
}
