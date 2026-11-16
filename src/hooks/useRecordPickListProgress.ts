import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { PickList } from "@/types/pick-list";
import * as keys from "@/hooks/queryKeys";

const affectedPrefixes = new Set<string>([
  keys.PICK_LISTS_QUERY_KEY,
  keys.DELIVERY_NOTES_QUERY_KEY,
  keys.INVENTORY_RESERVATIONS_QUERY_KEY,
  keys.WAREHOUSE_DASHBOARD_QUERY_KEY,
  keys.ITEMS_QUERY_KEY,
  keys.ITEMS_STOCK_QUERY_KEY,
  keys.ITEM_LOCATIONS_QUERY_KEY,
  keys.STOCK_ADJUSTMENT_BATCH_LOCATIONS_QUERY_KEY,
  keys.STOCK_BALANCES_QUERY_KEY,
  keys.INVENTORY_REPORT_QUERY_KEY,
  keys.ITEM_LOCATION_BATCH_REPORT_QUERY_KEY,
  keys.STOCK_AGING_REPORT_QUERY_KEY,
  keys.EXPIRED_BATCHES_REPORT_QUERY_KEY,
  "warehouse-locations",
  "warehouses",
]);

export type RecordPickListProgress = {
  pickListItemId: string;
  operationId: string;
  pickedQty: number;
  batchLocationSku: string;
  isMismatchWarningAcknowledged: boolean;
  mismatchReason: string | null;
};

export function useRecordPickListProgress(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: RecordPickListProgress) =>
      apiClient.post<PickList>(`/api/pick-lists/${id}/record-pick`, payload),
    onSuccess: async (updated) => {
      client.setQueryData([keys.PICK_LISTS_QUERY_KEY, id], updated);
      await client.invalidateQueries({
        predicate: ({ queryKey: [prefix, scope] }) =>
          (typeof prefix === "string" && affectedPrefixes.has(prefix)) ||
          (prefix === "lookups" && scope === "stock-request-batches"),
      });
    },
  });
}
