"use client";

import { Package, ClipboardList, TruckIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useWarehouseDashboard } from "@/hooks/useWarehouseDashboard";
import { useLoadLists } from "@/hooks/useLoadLists";
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
  const { data: inTransitLoadLists, isLoading: incomingShipmentsLoading } = useLoadLists({
    status: "in_transit",
    page: 1,
    limit: 1,
  });
  const user = useAuthStore((state) => state.user);
  const greeting = t(getGreetingKey());
  const incomingShipmentsCount = inTransitLoadLists?.pagination.total || 0;

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
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight">
          {greeting}, {user?.firstName || t("fallbackUser")}!
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      {/* Summary Cards - 3 columns */}
      <div className="grid gap-4 md:grid-cols-3">
        {isLoading ? (
          <>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </>
        ) : (
          <>
            <SummaryCard
              title={t("incomingShipments")}
              count={incomingShipmentsLoading ? 0 : incomingShipmentsCount}
              subtitle={t("inTransit")}
              icon={TruckIcon}
              iconColor="text-blue-600"
              href="/purchasing/load-lists"
            />
            <SummaryCard
              title={t("stockRequests")}
              count={data?.summary.pending_stock_requests || 0}
              subtitle={t("pending")}
              icon={ClipboardList}
              iconColor="text-orange-600"
              href="/inventory/stock-requests"
            />
            <SummaryCard
              title={t("pickList")}
              count={data?.summary.pick_list_to_pick || 0}
              subtitle={t("toPick")}
              icon={Package}
              iconColor="text-green-600"
              href="/inventory/stock-requests"
            />
          </>
        )}
      </div>

      {/* Inventory Health - 2 columns */}
      <InventoryHealthPanel
        lowStocks={data?.low_stocks || []}
        outOfStocks={data?.out_of_stocks || []}
        isLoading={isLoading}
        locale={locale}
      />

      {/* Operational Queue - Tabs */}
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
        />
      </ClientOnly>

      {/* Last 5 Stock Movements */}
      <StockMovementsList
        movements={data?.last_stock_movements || []}
        isLoading={isLoading}
        locale={locale}
      />
    </div>
  );
}
