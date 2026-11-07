import { useQueryClient } from "@tanstack/react-query";
import {
  ITEM_LOCATIONS_QUERY_KEY,
  ITEM_LOCATION_BATCH_REPORT_QUERY_KEY,
  STOCK_AGING_REPORT_QUERY_KEY,
} from "@/hooks/queryKeys";

// A location edit can change descendant addresses and preferred names for many items.
// Item summaries/searches and aging reports span warehouses, so invalidate their families.
export function useInvalidateWarehouseLocations(warehouseId: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      predicate: ({ queryKey }) => {
        const [family, scope] = queryKey;
        switch (family) {
          case "warehouse-locations":
            return scope === warehouseId;
          case "lookups":
            return scope === "warehouse_locations" && queryKey[2] === warehouseId;
          case "purchasing-dashboard":
            return scope === "warehouseCapacity";
          case ITEM_LOCATIONS_QUERY_KEY:
            // Tree/detail keys carry a warehouse; paginated summaries and searches do not.
            return queryKey[3] === "tree" || queryKey[3] === "node"
              ? queryKey[4] === warehouseId
              : true;
          case STOCK_AGING_REPORT_QUERY_KEY:
            return true;
          case ITEM_LOCATION_BATCH_REPORT_QUERY_KEY:
            return (
              typeof scope !== "object" ||
              scope === null ||
              !("warehouseId" in scope) ||
              !scope.warehouseId ||
              scope.warehouseId === warehouseId
            );
          default:
            return false;
        }
      },
    });
}
