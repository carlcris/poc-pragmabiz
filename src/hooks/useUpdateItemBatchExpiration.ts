import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { ITEM_LOCATIONS_QUERY_KEY, EXPIRED_BATCHES_REPORT_QUERY_KEY } from "@/hooks/queryKeys";
import { STOCK_ADJUSTMENTS_QUERY_KEY } from "@/hooks/useStockAdjustments";

export function useUpdateItemBatchExpiration(itemId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      batchLocationId,
      expirationDate,
    }: {
      batchLocationId: string;
      expirationDate: string | null;
    }) =>
      apiClient.patch<{ expirationDate: string | null }>(
        `/api/items/${itemId}/batch-locations/${batchLocationId}/expiration`,
        { expirationDate }
      ),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: [EXPIRED_BATCHES_REPORT_QUERY_KEY] }),
        client.invalidateQueries({ queryKey: [ITEM_LOCATIONS_QUERY_KEY, itemId] }),
        client.invalidateQueries({ queryKey: [STOCK_ADJUSTMENTS_QUERY_KEY] }),
      ]);
    },
  });
}
