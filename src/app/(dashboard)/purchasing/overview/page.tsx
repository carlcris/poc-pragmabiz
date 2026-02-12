"use client";

import { useEffect, useState } from "react";
import { LayoutDashboard, RefreshCw, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OutstandingRequisitionsWidget } from "@/components/dashboard/widgets/OutstandingRequisitionsWidget";
import { DamagedItemsWidget } from "@/components/dashboard/widgets/DamagedItemsWidget";
import { ExpectedArrivalsWidget } from "@/components/dashboard/widgets/ExpectedArrivalsWidget";
import { DelayedShipmentsWidget } from "@/components/dashboard/widgets/DelayedShipmentsWidget";
import { TodaysReceivingQueueWidget } from "@/components/dashboard/widgets/TodaysReceivingQueueWidget";
import { PendingApprovalsWidget } from "@/components/dashboard/widgets/PendingApprovalsWidget";
import { BoxAssignmentQueueWidget } from "@/components/dashboard/widgets/BoxAssignmentQueueWidget";
import { WarehouseCapacityWidget } from "@/components/dashboard/widgets/WarehouseCapacityWidget";
import { ActiveRequisitionsWidget } from "@/components/dashboard/widgets/ActiveRequisitionsWidget";
import { IncomingDeliveriesWidget } from "@/components/dashboard/widgets/IncomingDeliveriesWidget";
import { ActiveContainersWidget } from "@/components/dashboard/widgets/ActiveContainersWidget";
import { LocationAssignmentWidget } from "@/components/dashboard/widgets/LocationAssignmentWidget";
import { useQueryClient } from "@tanstack/react-query";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import { useWarehouses } from "@/hooks/useWarehouses";
import type { Warehouse as WarehouseType } from "@/types/warehouse";

export default function PurchasingOverviewPage() {
  const queryClient = useQueryClient();
  const currentBusinessUnit = useBusinessUnitStore((state) => state.currentBusinessUnit);
  const { data: warehousesData } = useWarehouses();
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");

  useEffect(() => {
    document.title = "Purchasing Overview | ERP";
  }, []);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["purchasing-dashboard"] });
  };

  const warehouses = (warehousesData?.data || []) as WarehouseType[];
  const warehouseId = selectedWarehouse === "all" ? undefined : selectedWarehouse;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          </div>
          <p className="mt-2 text-muted-foreground">
            Strategic and operational overview of purchasing
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
            <SelectTrigger className="w-[200px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="All Warehouses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Warehouses</SelectItem>
              {warehouses.map((wh) => (
                <SelectItem key={wh.id} value={wh.id}>
                  {wh.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Owner Overview */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Owner Overview</h2>
            <p className="text-sm text-muted-foreground">
              Executive indicators for purchasing health
            </p>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <OutstandingRequisitionsWidget businessUnitId={currentBusinessUnit?.id} />
          <DamagedItemsWidget businessUnitId={currentBusinessUnit?.id} />
          <ExpectedArrivalsWidget businessUnitId={currentBusinessUnit?.id} />
          <DelayedShipmentsWidget businessUnitId={currentBusinessUnit?.id} />
        </div>
      </section>

      {/* Warehouse Operations */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Warehouse Operations</h2>
          <p className="text-sm text-muted-foreground">
            Live operational queues and capacity status
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <TodaysReceivingQueueWidget warehouseId={warehouseId} businessUnitId={currentBusinessUnit?.id} />
          <PendingApprovalsWidget />
          <BoxAssignmentQueueWidget />
          <WarehouseCapacityWidget warehouseId={warehouseId} />
          <ActiveRequisitionsWidget businessUnitId={currentBusinessUnit?.id} />
          <IncomingDeliveriesWidget warehouseId={warehouseId} businessUnitId={currentBusinessUnit?.id} />
          <ActiveContainersWidget businessUnitId={currentBusinessUnit?.id} />
          <LocationAssignmentWidget />
        </div>
      </section>

      {/* Footer Info */}
      <div className="rounded-lg border bg-muted/50 p-4 text-center">
        <p className="text-sm text-muted-foreground">
          Dashboard auto-refreshes every 2-5 minutes depending on the widget. Click refresh for
          immediate updates.
        </p>
      </div>
    </div>
  );
}
