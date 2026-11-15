"use client";

import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useWarehouseDashboard } from "@/hooks/useWarehouseDashboard";
import { useAuthStore } from "@/stores/authStore";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import {
  DashboardSummaryStrip,
  type DashboardSummaryMetric,
} from "@/components/warehouse-dashboard/DashboardSummaryStrip";
import { StockAttentionPanel } from "@/components/warehouse-dashboard/StockAttentionPanel";
import { OperationalQueueTabs } from "@/components/warehouse-dashboard/OperationalQueueTabs";
import { StockMovementsList } from "@/components/warehouse-dashboard/StockMovementsList";
import { OperationsOverview } from "@/components/warehouse-dashboard/operations-overview/OperationsOverview";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientOnly } from "@/components/shared/ClientOnly";
import { cn } from "@/lib/utils";

const getGreetingKey = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "goodMorning";
  if (hour < 18) return "goodAfternoon";
  return "goodEvening";
};

const EMPTY_QUEUES = {
  pick_list: [],
  incoming_deliveries: [],
  stock_requests: [],
  totals: { pick_list: 0, incoming_deliveries: 0, stock_requests: 0 },
};

export default function WarehouseDashboardPage() {
  const t = useTranslations("dashboardPage");
  const locale = useLocale();
  const isSwitching = useBusinessUnitStore((state) => state.isSwitching);
  const {
    data: dashboard,
    error,
    isPending,
    isFetching,
    isRefetchError,
    dataUpdatedAt,
    refetch,
  } = useWarehouseDashboard();
  const data = isSwitching ? undefined : dashboard;
  const isRefreshing = isSwitching || isFetching;
  const user = useAuthStore((state) => state.user);

  // A disabled query (session still hydrating) is pending, not loading, so gate the
  // skeletons on missing data rather than on isLoading.
  const isLoading = isSwitching || (isPending && !error);
  const capabilities = data?.capabilities;
  const canViewStockValue = capabilities?.canViewStockValue ?? false;
  const canViewReorderValue = capabilities?.canViewReorderValue ?? false;
  const canViewPickListQueue = capabilities?.canViewPickListQueue ?? false;
  const canViewIncomingDeliveriesQueue = capabilities?.canViewIncomingDeliveriesQueue ?? false;
  const canViewStockRequestsQueue = capabilities?.canViewStockRequestsQueue ?? false;
  const canViewAnyQueue =
    canViewPickListQueue || canViewIncomingDeliveriesQueue || canViewStockRequestsQueue;

  const metrics: DashboardSummaryMetric[] = [];
  if (data && capabilities?.canViewPickListCard) {
    metrics.push({
      key: "pick-list",
      href: "/inventory/pick-lists",
      count: data.summary.pick_list_to_pick,
      label: t("toPick"),
      hint: t("toPickHint"),
    });
  }
  if (data && capabilities?.canViewIncomingShipmentsCard) {
    metrics.push({
      key: "incoming",
      href: "/purchasing/load-lists",
      count: data.summary.incoming_deliveries_today,
      label: t("incomingShipments"),
      hint: t("incomingShipmentsHint"),
    });
  }
  if (data && capabilities?.canViewStockRequestsCard) {
    metrics.push({
      key: "requests",
      href: "/inventory/stock-requests",
      count: data.summary.pending_stock_requests,
      label: t("stockRequests"),
      hint: t("stockRequestsHint"),
      urgentCount: data.summary.urgent_stock_requests,
    });
  }

  const queues = data?.queues ?? EMPTY_QUEUES;
  const visibleQueueTotal =
    (canViewPickListQueue ? queues.totals.pick_list : 0) +
    (canViewIncomingDeliveriesQueue ? queues.totals.incoming_deliveries : 0) +
    (canViewStockRequestsQueue ? queues.totals.stock_requests : 0);
  const isAllClear =
    Boolean(data) &&
    (metrics.length > 0 || canViewAnyQueue) &&
    metrics.every((metric) => metric.count === 0) &&
    visibleQueueTotal === 0;

  const updatedTime =
    data && dataUpdatedAt
      ? new Date(dataUpdatedAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
      : null;
  const todayLabel = new Date().toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const greeting = t(getGreetingKey());

  return (
    <div className="container mx-auto space-y-6 p-4 md:p-6">
      <header className="flex items-center justify-between gap-4 border-b pb-4 sm:items-end sm:pb-5">
        <div className="min-w-0 space-y-1">
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
            {user ? (
              user.firstName ? (
                t("greetingWithName", { greeting, name: user.firstName })
              ) : (
                t("greetingWithoutName", { greeting })
              )
            ) : (
              <span className="flex items-center gap-2">
                {greeting}
                <Skeleton className="h-5 w-20" />
              </span>
            )}
          </h1>
          {/* The date is formatted in the viewer's time zone, which can differ from the server's. */}
          <p className="text-sm text-muted-foreground" suppressHydrationWarning>
            {todayLabel}
            {updatedTime ? ` · ${t("updatedAt", { time: updatedTime })}` : null}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => refetch()}
          disabled={isRefreshing}
          aria-label={isRefreshing ? t("refreshing") : t("refresh")}
          className="h-11 w-11 shrink-0 px-0 sm:w-auto sm:px-3 lg:h-9"
        >
          <RefreshCw aria-hidden="true" className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          <span className="hidden sm:inline">{isRefreshing ? t("refreshing") : t("refresh")}</span>
        </Button>
      </header>

      {!isSwitching && error && !data ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("loadErrorTitle")}</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{t("loadError")}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="h-11 lg:h-9"
            >
              {t("retry")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {isRefetchError && updatedTime ? (
            <p
              role="status"
              className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground"
            >
              <AlertCircle aria-hidden="true" className="h-4 w-4 text-red-700 dark:text-red-400" />
              {t("refreshError", { time: updatedTime })}
              <button
                type="button"
                onClick={() => refetch()}
                className="min-h-11 font-medium text-foreground underline underline-offset-4 lg:min-h-0"
              >
                {t("retry")}
              </button>
            </p>
          ) : null}

          {isAllClear ? (
            <div className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-sm">
              <CheckCircle2
                aria-hidden="true"
                className="h-6 w-6 shrink-0 text-green-700 dark:text-green-400"
              />
              <div>
                <p className="font-semibold">{t("allClearTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("allClearDescription")}</p>
              </div>
            </div>
          ) : (
            <DashboardSummaryStrip metrics={metrics} isLoading={isLoading} locale={locale} />
          )}

          <OperationsOverview locale={locale} />

          <div className="grid gap-6 xl:grid-cols-3 xl:items-start">
            {!isAllClear && (isLoading || canViewAnyQueue) ? (
              <div className="min-w-0 xl:col-span-2">
                <ClientOnly fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
                  <OperationalQueueTabs
                    queues={queues}
                    isLoading={isLoading}
                    locale={locale}
                    capabilities={{
                      canViewPickListQueue: isLoading || canViewPickListQueue,
                      canViewIncomingDeliveriesQueue: isLoading || canViewIncomingDeliveriesQueue,
                      canViewStockRequestsQueue: isLoading || canViewStockRequestsQueue,
                    }}
                  />
                </ClientOnly>
              </div>
            ) : null}

            <div
              className={cn(
                "flex min-w-0 flex-col gap-6",
                (isAllClear || (!isLoading && !canViewAnyQueue)) && "xl:col-span-3"
              )}
            >
              <StockAttentionPanel
                outOfStocks={data?.out_of_stocks ?? []}
                lowStocks={data?.low_stocks ?? []}
                showOutOfStock={isLoading || canViewStockValue}
                showLowStock={isLoading || canViewReorderValue}
                isLoading={isLoading}
                locale={locale}
              />
              {isLoading || canViewStockValue ? (
                <StockMovementsList
                  movements={data?.last_stock_movements ?? []}
                  isLoading={isLoading}
                  locale={locale}
                />
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
