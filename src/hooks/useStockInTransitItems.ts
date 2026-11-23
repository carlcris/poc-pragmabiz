import { useInfiniteQuery } from "@tanstack/react-query";
import { STOCK_IN_TRANSIT_QUERY_KEY } from "@/hooks/queryKeys";
import { useRealtimeDomainInvalidation } from "@/hooks/useRealtimeDomainInvalidation";
import { stockInTransitApi } from "@/lib/api/stock-in-transit";

const STOCK_IN_TRANSIT_ITEMS_PAGE_SIZE = 25;

export function useStockInTransitItems(
  search: string | undefined,
  { enabled, companyId }: { enabled: boolean; companyId?: string }
) {
  useRealtimeDomainInvalidation("purchasing", {
    queryKeys: [STOCK_IN_TRANSIT_QUERY_KEY],
    enabled,
  });

  return useInfiniteQuery({
    queryKey: [
      STOCK_IN_TRANSIT_QUERY_KEY,
      companyId,
      "items",
      search,
      STOCK_IN_TRANSIT_ITEMS_PAGE_SIZE,
    ],
    queryFn: ({ pageParam, signal }) =>
      stockInTransitApi.listItems(
        { search, page: pageParam, limit: STOCK_IN_TRANSIT_ITEMS_PAGE_SIZE },
        signal
      ),
    initialPageParam: 1,
    getNextPageParam: ({ pagination }) =>
      pagination.page < pagination.totalPages ? pagination.page + 1 : undefined,
    enabled,
  });
}
