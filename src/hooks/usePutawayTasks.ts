import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DELIVERY_NOTE_ALLOCATION_AVAILABILITY_QUERY_KEY,
  DELIVERY_NOTES_QUERY_KEY,
  INVENTORY_REPORT_QUERY_KEY,
  ITEM_LOCATIONS_QUERY_KEY,
  ITEM_LOCATION_BATCH_REPORT_QUERY_KEY,
  ITEM_PACKAGES_QUERY_KEY,
  ITEMS_QUERY_KEY,
  ITEMS_STATS_QUERY_KEY,
  ITEMS_STOCK_QUERY_KEY,
  NOTIFICATIONS_QUERY_KEY,
  PRODUCT_MOVEMENT_REPORT_QUERY_KEY,
  PUTAWAY_TASKS_QUERY_KEY,
  REORDER_ALERTS_QUERY_KEY,
  REORDER_STATISTICS_QUERY_KEY,
  STOCK_AGING_REPORT_QUERY_KEY,
  STOCK_ADJUSTMENT_BATCH_LOCATIONS_QUERY_KEY,
  STOCK_BALANCES_QUERY_KEY,
  STOCK_LEDGER_QUERY_KEY,
  STOCK_MOVEMENT_REPORT_QUERY_KEY,
  STOCK_REQUESTS_QUERY_KEY,
  STOCK_TRANSACTIONS_QUERY_KEY,
  WAREHOUSE_DASHBOARD_QUERY_KEY,
} from "@/hooks/queryKeys";
import { putawayTasksApi } from "@/lib/api/putaway-tasks";
import type { PostPutawayTaskRequest, PutawayTaskFilters } from "@/types/putaway-task";

const PUTAWAY_AFFECTED_QUERY_PREFIXES = new Set([
  PUTAWAY_TASKS_QUERY_KEY,
  ITEMS_QUERY_KEY,
  ITEMS_STATS_QUERY_KEY,
  ITEMS_STOCK_QUERY_KEY,
  ITEM_LOCATIONS_QUERY_KEY,
  STOCK_ADJUSTMENT_BATCH_LOCATIONS_QUERY_KEY,
  STOCK_BALANCES_QUERY_KEY,
  STOCK_TRANSACTIONS_QUERY_KEY,
  WAREHOUSE_DASHBOARD_QUERY_KEY,
  STOCK_REQUESTS_QUERY_KEY,
  REORDER_ALERTS_QUERY_KEY,
  REORDER_STATISTICS_QUERY_KEY,
  NOTIFICATIONS_QUERY_KEY,
  INVENTORY_REPORT_QUERY_KEY,
  ITEM_LOCATION_BATCH_REPORT_QUERY_KEY,
  STOCK_AGING_REPORT_QUERY_KEY,
  STOCK_MOVEMENT_REPORT_QUERY_KEY,
  PRODUCT_MOVEMENT_REPORT_QUERY_KEY,
  STOCK_LEDGER_QUERY_KEY,
]);

const isPutawayAffectedQuery = (queryKey: readonly unknown[]) => {
  const [prefix, scope, itemSubresource] = queryKey;
  if (prefix === DELIVERY_NOTES_QUERY_KEY) {
    return scope === DELIVERY_NOTE_ALLOCATION_AVAILABILITY_QUERY_KEY;
  }
  if (prefix === ITEMS_QUERY_KEY && itemSubresource === ITEM_PACKAGES_QUERY_KEY) return false;
  return typeof prefix === "string" && PUTAWAY_AFFECTED_QUERY_PREFIXES.has(prefix);
};

export function usePutawayTasks(params?: PutawayTaskFilters) {
  return useQuery({
    queryKey: [PUTAWAY_TASKS_QUERY_KEY, params],
    queryFn: () => putawayTasksApi.list(params),
  });
}

export function usePostPutawayTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: PostPutawayTaskRequest }) =>
      putawayTasksApi.postTask(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        predicate: (query) => isPutawayAffectedQuery(query.queryKey),
      });
    },
  });
}
