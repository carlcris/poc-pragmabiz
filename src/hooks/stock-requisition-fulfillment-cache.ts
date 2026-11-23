import type { QueryClient } from "@tanstack/react-query";
import { PURCHASE_ON_ORDER_QUERY_KEY, STOCK_REQUISITIONS_QUERY_KEY } from "@/hooks/queryKeys";
import type { WidgetName } from "@/types/purchasing-dashboard";

const fulfillmentWidgets = [
  "outstandingRequisitions",
  "activeRequisitions",
  "incomingDeliveriesWithSRs",
] satisfies WidgetName[];

export function invalidatePurchasingDashboardWidgets(
  queryClient: QueryClient,
  widgets: readonly WidgetName[]
) {
  return queryClient.invalidateQueries({
    queryKey: ["purchasing-dashboard"],
    predicate: ({ queryKey: [, scope] }) => {
      if (typeof scope === "string") return widgets.some((widget) => widget === scope);
      if (typeof scope === "object" && scope !== null && "widgets" in scope) {
        const requested = scope.widgets;
        if (Array.isArray(requested) && requested.length > 0) {
          return widgets.some((widget) => requested.includes(widget));
        }
      }
      // The aggregate dashboard requests all widgets when no selection is specified.
      return true;
    },
  });
}

export function invalidateStockRequisitionFulfillment(
  queryClient: QueryClient,
  additionalWidgets: readonly WidgetName[] = []
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [STOCK_REQUISITIONS_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: [PURCHASE_ON_ORDER_QUERY_KEY] }),
    invalidatePurchasingDashboardWidgets(queryClient, [
      ...fulfillmentWidgets,
      ...additionalWidgets,
    ]),
  ]);
}
