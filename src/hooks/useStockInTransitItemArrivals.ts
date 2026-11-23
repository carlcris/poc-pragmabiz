import { useInfiniteQuery } from "@tanstack/react-query";
import { STOCK_IN_TRANSIT_QUERY_KEY } from "@/hooks/queryKeys";
import { stockInTransitApi } from "@/lib/api/stock-in-transit";

const STOCK_IN_TRANSIT_ARRIVALS_PAGE_SIZE = 25;

export function useStockInTransitItemArrivals(
  itemId: string,
  { enabled, companyId }: { enabled: boolean; companyId?: string }
) {
  return useInfiniteQuery({
    queryKey: [
      STOCK_IN_TRANSIT_QUERY_KEY,
      companyId,
      "arrivals",
      itemId,
      STOCK_IN_TRANSIT_ARRIVALS_PAGE_SIZE,
    ],
    queryFn: ({ pageParam, signal }) =>
      stockInTransitApi.listItemArrivals(
        { itemId, page: pageParam, limit: STOCK_IN_TRANSIT_ARRIVALS_PAGE_SIZE },
        signal
      ),
    initialPageParam: 1,
    getNextPageParam: ({ pagination }) =>
      pagination.page < pagination.totalPages ? pagination.page + 1 : undefined,
    enabled,
  });
}
