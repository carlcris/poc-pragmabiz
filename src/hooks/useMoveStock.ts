import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import * as queryKeys from "@/hooks/queryKeys";
import type { StockMovePayload } from "@/lib/validations/stock-move";
import type { StockMoveResponse } from "@/types/stock-move";

const AFFECTED_QUERY_KEYS = new Set<string>([
  queryKeys.ITEMS_QUERY_KEY,
  queryKeys.ITEMS_STATS_QUERY_KEY,
  queryKeys.ITEMS_STOCK_QUERY_KEY,
  queryKeys.ITEM_LOCATIONS_QUERY_KEY,
  queryKeys.STOCK_ADJUSTMENT_BATCH_LOCATIONS_QUERY_KEY,
  queryKeys.STOCK_BALANCES_QUERY_KEY,
  queryKeys.STOCK_TRANSACTIONS_QUERY_KEY,
  queryKeys.STOCK_REQUESTS_QUERY_KEY,
  queryKeys.WAREHOUSE_DASHBOARD_QUERY_KEY,
  queryKeys.REORDER_ALERTS_QUERY_KEY,
  queryKeys.REORDER_STATISTICS_QUERY_KEY,
  queryKeys.REORDER_SUGGESTIONS_QUERY_KEY,
  queryKeys.REORDER_STOCK_LEVELS_QUERY_KEY,
  queryKeys.NOTIFICATIONS_QUERY_KEY,
  queryKeys.INVENTORY_REPORT_QUERY_KEY,
  queryKeys.ITEM_LOCATION_BATCH_REPORT_QUERY_KEY,
  queryKeys.STOCK_AGING_REPORT_QUERY_KEY,
  queryKeys.STOCK_MOVEMENT_REPORT_QUERY_KEY,
  queryKeys.PRODUCT_MOVEMENT_REPORT_QUERY_KEY,
  queryKeys.STOCK_LEDGER_QUERY_KEY,
  "warehouses",
  "warehouse-locations",
  "stock-valuation-report",
]);

export function useMoveStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: StockMovePayload) =>
      apiClient.post<StockMoveResponse>("/api/stock-transactions", payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        predicate: ({ queryKey: [prefix, scope] }) =>
          (typeof prefix === "string" && AFFECTED_QUERY_KEYS.has(prefix)) ||
          (prefix === queryKeys.DELIVERY_NOTES_QUERY_KEY &&
            scope === queryKeys.DELIVERY_NOTE_ALLOCATION_AVAILABILITY_QUERY_KEY) ||
          (prefix === "lookups" && scope === "stock-request-batches"),
      });
    },
  });
}
