import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { STOCK_IN_TRANSIT_QUERY_KEY } from "@/hooks/queryKeys";
import { useRealtimeDomainInvalidation } from "@/hooks/useRealtimeDomainInvalidation";
import { stockInTransitApi } from "@/lib/api/stock-in-transit";
import type { StockInTransitFilters } from "@/types/stock-in-transit";

export function useStockInTransit(
  filters: StockInTransitFilters,
  options?: { enabled?: boolean; businessUnitId?: string }
) {
  useRealtimeDomainInvalidation("purchasing", {
    queryKeys: [STOCK_IN_TRANSIT_QUERY_KEY],
    enabled: options?.enabled,
  });

  return useQuery({
    queryKey: [STOCK_IN_TRANSIT_QUERY_KEY, options?.businessUnitId, filters],
    queryFn: () => stockInTransitApi.list(filters),
    placeholderData: keepPreviousData,
    enabled: options?.enabled,
  });
}
