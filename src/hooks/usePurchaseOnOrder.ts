import { useQuery } from "@tanstack/react-query";
import { PURCHASE_ON_ORDER_QUERY_KEY } from "@/hooks/queryKeys";
import { useRealtimeDomainInvalidation } from "@/hooks/useRealtimeDomainInvalidation";
import { purchaseOnOrderApi } from "@/lib/api/purchase-on-order";
import { useAuthStore } from "@/stores/authStore";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import type { PurchaseOnOrderFilters } from "@/types/purchase-on-order";

// Status counts cover every status, so a previous response stays valid for the
// status and page the user is moving to as long as the counted scope is the
// same. Any change to the business unit or to a count-affecting filter makes
// the previous counts wrong, so no placeholder is served for those.
const hasSameCountScope = (
  previousFilters: PurchaseOnOrderFilters | undefined,
  filters: PurchaseOnOrderFilters
) =>
  previousFilters?.search === filters.search &&
  previousFilters?.supplierId === filters.supplierId &&
  previousFilters?.expectedFrom === filters.expectedFrom &&
  previousFilters?.expectedTo === filters.expectedTo;

export function usePurchaseOnOrderItems(filters: PurchaseOnOrderFilters) {
  const businessUnitId = useBusinessUnitStore((state) => state.currentBusinessUnit?.id);
  const isBusinessUnitLoading = useBusinessUnitStore((state) => state.isLoading);
  const isSwitching = useBusinessUnitStore((state) => state.isSwitching);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoggingOut = useAuthStore((state) => state.isLoggingOut);
  // The request is scoped by the authenticated server session, so it must not
  // run while the session or the business-unit context is still resolving.
  const isActive = isAuthenticated && !isLoggingOut && !isBusinessUnitLoading && !isSwitching;

  useRealtimeDomainInvalidation("purchasing", {
    queryKeys: [PURCHASE_ON_ORDER_QUERY_KEY],
    enabled: isActive,
  });

  const query = useQuery({
    queryKey: [PURCHASE_ON_ORDER_QUERY_KEY, businessUnitId ?? null, filters],
    enabled: isActive,
    queryFn: ({ signal }) => purchaseOnOrderApi.getOnOrderItems(filters, signal),
    placeholderData: (previousData, previousQuery) => {
      if (!previousData || !previousQuery) return undefined;
      const [, previousBusinessUnitId, previousFilters] = previousQuery.queryKey as [
        string,
        string | null,
        PurchaseOnOrderFilters | undefined,
      ];

      if (previousBusinessUnitId !== (businessUnitId ?? null)) return undefined;
      return hasSameCountScope(previousFilters, filters) ? previousData : undefined;
    },
  });

  // A disabled query reports its cached result with `isLoading` false, which
  // would leave stale counts and rows on screen while the scope is unready.
  // Reporting the unready state as loading keeps the page on its skeleton.
  if (!isActive) {
    return {
      ...query,
      data: undefined,
      error: null,
      isLoading: true,
      isPlaceholderData: false,
    };
  }

  return query;
}
