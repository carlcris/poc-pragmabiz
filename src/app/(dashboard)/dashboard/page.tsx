"use client";

import { Package, ClipboardList, TruckIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useWarehouseDashboard } from "@/hooks/useWarehouseDashboard";
import { useAuthStore } from "@/stores/authStore";
import { SummaryCard } from "@/components/warehouse-dashboard/SummaryCard";
import { InventoryHealthPanel } from "@/components/warehouse-dashboard/InventoryHealthPanel";
import { OperationalQueueTabs } from "@/components/warehouse-dashboard/OperationalQueueTabs";
import { StockMovementsList } from "@/components/warehouse-dashboard/StockMovementsList";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientOnly } from "@/components/shared/ClientOnly";

const getGreetingKey = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "goodMorning";
  if (hour === 12) return "goodNoon";
  if (hour < 18) return "goodAfternoon";
  return "goodEvening";
};

export default function WarehouseDashboardPage() {
  const t = useTranslations("dashboardPage");
  const locale = useLocale();
  const { data, isLoading, error, refetch } = useWarehouseDashboard();
  const user = useAuthStore((state) => state.user);
  const greeting = t(getGreetingKey());
  const canViewStockValue = data?.capabilities?.canViewStockValue ?? false;
  const canViewReorderValue = data?.capabilities?.canViewReorderValue ?? false;
  const canViewIncomingShipmentsCard =
    data?.capabilities?.canViewIncomingShipmentsCard ?? false;
  const canViewStockRequestsCard = data?.capabilities?.canViewStockRequestsCard ?? false;
  const canViewPickListCard = data?.capabilities?.canViewPickListCard ?? false;
  const canViewPickListQueue = data?.capabilities?.canViewPickListQueue ?? false;
  const canViewIncomingDeliveriesQueue =
    data?.capabilities?.canViewIncomingDeliveriesQueue ?? false;
  const canViewStockRequestsQueue = data?.capabilities?.canViewStockRequestsQueue ?? false;
  const canViewInventoryHealth = isLoading || canViewStockValue || canViewReorderValue;
  const canViewSummaryCards =
    isLoading || canViewIncomingShipmentsCard || canViewStockRequestsCard || canViewPickListCard;
  const canViewOperationalQueue =
    isLoading ||
    canViewPickListQueue ||
    canViewIncomingDeliveriesQueue ||
    canViewStockRequestsQueue;

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t("loadError")}
            <button onClick={() => refetch()} className="ml-2 font-medium underline">
              {t("retry")}
            </button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-4 md:p-6">
      {/* Page Header */}
      <div className="border-b border-gray-200 pb-5">
        <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
          {greeting}, {user?.firstName || t("fallbackUser")}!
        </h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{t("subtitle")}</p>
      </div>

      {/* Summary Cards - 3 columns */}
      {canViewSummaryCards && (
        <div className="grid gap-4 md:grid-cols-3">
          {isLoading ? (
            <>
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </>
          ) : (
            <>
              {canViewIncomingShipmentsCard && (
                <SummaryCard
                  title={t("incomingShipments")}
                  count={data?.summary.incoming_deliveries_today || 0}
                  subtitle={t("inTransit")}
                  icon={TruckIcon}
                  iconColor="text-blue-600"
                  href="/purchasing/load-lists"
                />
              )}
              {canViewStockRequestsCard && (
                <SummaryCard
                  title={t("stockRequests")}
                  count={data?.summary.pending_stock_requests || 0}
                  subtitle={t("pending")}
                  icon={ClipboardList}
                  iconColor="text-orange-600"
                  href="/inventory/stock-requests"
                />
              )}
              {canViewPickListCard && (
                <SummaryCard
                  title={t("pickList")}
                  count={data?.summary.pick_list_to_pick || 0}
                  subtitle={t("toPick")}
                  icon={Package}
                  iconColor="text-green-600"
                  href="/inventory/stock-requests"
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Inventory Health - 2 columns */}
      {canViewInventoryHealth && (
        <InventoryHealthPanel
          lowStocks={canViewReorderValue ? data?.low_stocks || [] : []}
          outOfStocks={canViewStockValue ? data?.out_of_stocks || [] : []}
          isLoading={isLoading}
          locale={locale}
        />
      )}

      {/* Operational Queue - Tabs */}
      {canViewOperationalQueue && (
        <ClientOnly
          fallback={
            <div className="rounded-lg border bg-background p-6">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-5 w-40" />
              </div>
              <div className="mt-4 space-y-3">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            </div>
          }
        >
          <OperationalQueueTabs
            queues={
              data?.queues || {
                pick_list: [],
                incoming_deliveries: [],
                stock_requests: [],
              }
            }
            isLoading={isLoading}
            locale={locale}
            capabilities={{
              canViewPickListQueue: isLoading || canViewPickListQueue,
              canViewIncomingDeliveriesQueue: isLoading || canViewIncomingDeliveriesQueue,
              canViewStockRequestsQueue: isLoading || canViewStockRequestsQueue,
            }}
          />
        </ClientOnly>
      )}

      {/* Last 5 Stock Movements */}
      {(isLoading || canViewStockValue) && (
        <StockMovementsList
          movements={data?.last_stock_movements || []}
          isLoading={isLoading}
          locale={locale}
        />
      )}
    </div>
  );
}
