"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { LayoutDashboard, RefreshCw, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MultiResourceProtectedRoute } from "@/components/permissions/ProtectedRoute";
import { PURCHASING_MODULE_RESOURCES } from "@/constants/resources";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import { useWarehouses } from "@/hooks/useWarehouses";
import { usePurchasingDashboardCapabilities } from "@/hooks/usePurchasingDashboard";
import type { Warehouse as WarehouseType } from "@/types/warehouse";

const widgetFallback = () => <div className="h-36 animate-pulse rounded-lg border bg-muted/50" />;
const OutstandingRequisitionsWidget = dynamic(
  () =>
    import("@/components/dashboard/widgets/OutstandingRequisitionsWidget").then(
      (mod) => mod.OutstandingRequisitionsWidget
    ),
  { ssr: false, loading: widgetFallback }
);
const DamagedItemsWidget = dynamic(
  () =>
    import("@/components/dashboard/widgets/DamagedItemsWidget").then(
      (mod) => mod.DamagedItemsWidget
    ),
  { ssr: false, loading: widgetFallback }
);
const ExpectedArrivalsWidget = dynamic(
  () =>
    import("@/components/dashboard/widgets/ExpectedArrivalsWidget").then(
      (mod) => mod.ExpectedArrivalsWidget
    ),
  { ssr: false, loading: widgetFallback }
);
const DelayedShipmentsWidget = dynamic(
  () =>
    import("@/components/dashboard/widgets/DelayedShipmentsWidget").then(
      (mod) => mod.DelayedShipmentsWidget
    ),
  { ssr: false, loading: widgetFallback }
);
const TodaysReceivingQueueWidget = dynamic(
  () =>
    import("@/components/dashboard/widgets/TodaysReceivingQueueWidget").then(
      (mod) => mod.TodaysReceivingQueueWidget
    ),
  { ssr: false, loading: widgetFallback }
);
const PendingApprovalsWidget = dynamic(
  () =>
    import("@/components/dashboard/widgets/PendingApprovalsWidget").then(
      (mod) => mod.PendingApprovalsWidget
    ),
  { ssr: false, loading: widgetFallback }
);
const BoxAssignmentQueueWidget = dynamic(
  () =>
    import("@/components/dashboard/widgets/BoxAssignmentQueueWidget").then(
      (mod) => mod.BoxAssignmentQueueWidget
    ),
  { ssr: false, loading: widgetFallback }
);
const WarehouseCapacityWidget = dynamic(
  () =>
    import("@/components/dashboard/widgets/WarehouseCapacityWidget").then(
      (mod) => mod.WarehouseCapacityWidget
    ),
  { ssr: false, loading: widgetFallback }
);
const ActiveRequisitionsWidget = dynamic(
  () =>
    import("@/components/dashboard/widgets/ActiveRequisitionsWidget").then(
      (mod) => mod.ActiveRequisitionsWidget
    ),
  { ssr: false, loading: widgetFallback }
);
const IncomingDeliveriesWidget = dynamic(
  () =>
    import("@/components/dashboard/widgets/IncomingDeliveriesWidget").then(
      (mod) => mod.IncomingDeliveriesWidget
    ),
  { ssr: false, loading: widgetFallback }
);
const ActiveContainersWidget = dynamic(
  () =>
    import("@/components/dashboard/widgets/ActiveContainersWidget").then(
      (mod) => mod.ActiveContainersWidget
    ),
  { ssr: false, loading: widgetFallback }
);
const LocationAssignmentWidget = dynamic(
  () =>
    import("@/components/dashboard/widgets/LocationAssignmentWidget").then(
      (mod) => mod.LocationAssignmentWidget
    ),
  { ssr: false, loading: widgetFallback }
);

export default function PurchasingOverviewPage() {
  const t = useTranslations("purchasingOverviewPage");
  const queryClient = useQueryClient();
  const currentBusinessUnit = useBusinessUnitStore((state) => state.currentBusinessUnit);
  const { data: warehousesData } = useWarehouses();
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");

  useEffect(() => {
    document.title = `${t("title")} | ERP`;
  }, [t]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["purchasing-dashboard"] });
  };

  const warehouses = (warehousesData?.data || []) as WarehouseType[];
  const warehouseId = selectedWarehouse === "all" ? undefined : selectedWarehouse;
  const { data: capabilities, isLoading: loadingCapabilities } = usePurchasingDashboardCapabilities(
    {
      warehouseId,
      businessUnitId: currentBusinessUnit?.id,
    }
  );
  const showOwnerOverview =
    loadingCapabilities ||
    capabilities?.canViewOutstandingRequisitions ||
    capabilities?.canViewDamagedItems ||
    capabilities?.canViewExpectedArrivals ||
    capabilities?.canViewDelayedShipments;
  const showWarehouseOperations =
    loadingCapabilities ||
    capabilities?.canViewTodaysReceivingQueue ||
    capabilities?.canViewPendingApprovals ||
    capabilities?.canViewBoxAssignmentQueue ||
    capabilities?.canViewWarehouseCapacity ||
    capabilities?.canViewActiveRequisitions ||
    capabilities?.canViewIncomingDeliveries ||
    capabilities?.canViewActiveContainers ||
    capabilities?.canViewLocationAssignment;

  return (
    <MultiResourceProtectedRoute resources={PURCHASING_MODULE_RESOURCES}>
      <div className="space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
              <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{t("title")}</h1>
            </div>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{t("subtitle")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder={t("allWarehouses")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allWarehouses")}</SelectItem>
                {warehouses.map((wh) => (
                  <SelectItem key={wh.id} value={wh.id}>
                    {wh.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("refresh")}
            </Button>
          </div>
        </div>

        {/* Owner Overview */}
        {showOwnerOverview && (
          <section className="space-y-3 sm:space-y-4">
            <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
              {loadingCapabilities
                ? widgetFallback()
                : capabilities?.canViewOutstandingRequisitions && (
                    <OutstandingRequisitionsWidget businessUnitId={currentBusinessUnit?.id} />
                  )}
              {loadingCapabilities
                ? widgetFallback()
                : capabilities?.canViewDamagedItems && (
                    <DamagedItemsWidget businessUnitId={currentBusinessUnit?.id} />
                  )}
              {loadingCapabilities
                ? widgetFallback()
                : capabilities?.canViewExpectedArrivals && (
                    <ExpectedArrivalsWidget businessUnitId={currentBusinessUnit?.id} />
                  )}
              {loadingCapabilities
                ? widgetFallback()
                : capabilities?.canViewDelayedShipments && (
                    <DelayedShipmentsWidget businessUnitId={currentBusinessUnit?.id} />
                  )}
            </div>
          </section>
        )}

        {/* Warehouse Operations */}
        {showWarehouseOperations && (
          <section className="space-y-3 sm:space-y-4">
            <div>
              <h2 className="text-lg font-semibold sm:text-xl">{t("warehouseOperations")}</h2>
              <p className="text-xs text-muted-foreground sm:text-sm">
                {t("warehouseOperationsDescription")}
              </p>
            </div>
            <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
              {loadingCapabilities
                ? widgetFallback()
                : capabilities?.canViewTodaysReceivingQueue && (
                    <TodaysReceivingQueueWidget
                      warehouseId={warehouseId}
                      businessUnitId={currentBusinessUnit?.id}
                    />
                  )}
              {loadingCapabilities
                ? widgetFallback()
                : capabilities?.canViewPendingApprovals && <PendingApprovalsWidget />}
              {loadingCapabilities
                ? widgetFallback()
                : capabilities?.canViewBoxAssignmentQueue && <BoxAssignmentQueueWidget />}
              {loadingCapabilities
                ? widgetFallback()
                : capabilities?.canViewWarehouseCapacity && (
                    <WarehouseCapacityWidget warehouseId={warehouseId} />
                  )}
              {loadingCapabilities
                ? widgetFallback()
                : capabilities?.canViewActiveRequisitions && (
                    <ActiveRequisitionsWidget businessUnitId={currentBusinessUnit?.id} />
                  )}
              {loadingCapabilities
                ? widgetFallback()
                : capabilities?.canViewIncomingDeliveries && (
                    <IncomingDeliveriesWidget
                      warehouseId={warehouseId}
                      businessUnitId={currentBusinessUnit?.id}
                    />
                  )}
              {loadingCapabilities
                ? widgetFallback()
                : capabilities?.canViewActiveContainers && (
                    <ActiveContainersWidget businessUnitId={currentBusinessUnit?.id} />
                  )}
              {loadingCapabilities
                ? widgetFallback()
                : capabilities?.canViewLocationAssignment && <LocationAssignmentWidget />}
            </div>
          </section>
        )}

        {/* Footer Info */}
        <div className="rounded-lg border bg-muted/50 p-3 text-center sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">{t("footerAutoRefresh")}</p>
        </div>
      </div>
    </MultiResourceProtectedRoute>
  );
}
