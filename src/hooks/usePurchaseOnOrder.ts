import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PURCHASE_ON_ORDER_QUERY_KEY } from "@/hooks/queryKeys";
import { useRealtimeDomainInvalidation } from "@/hooks/useRealtimeDomainInvalidation";
import { purchaseOnOrderApi } from "@/lib/api/purchase-on-order";
import type { PurchaseOnOrderFilters } from "@/types/purchase-on-order";

export function usePurchaseOnOrderItems(filters?: PurchaseOnOrderFilters) {
  useRealtimeDomainInvalidation("purchasing", {
    queryKeys: [PURCHASE_ON_ORDER_QUERY_KEY],
  });

  return useQuery({
    queryKey: [PURCHASE_ON_ORDER_QUERY_KEY, filters],
    queryFn: () => purchaseOnOrderApi.getOnOrderItems(filters),
    placeholderData: keepPreviousData,
  });
}
