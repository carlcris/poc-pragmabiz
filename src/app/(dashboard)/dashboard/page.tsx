"use client";

import { Package, ClipboardList, TruckIcon } from "lucide-react";
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

// Get time-based greeting
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour === 12) return "Good noon"
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

export default function WarehouseDashboardPage() {
  const { data, isLoading, error, refetch } = useWarehouseDashboard();
  const { data: inTransitLoadLists, isLoading: incomingShipmentsLoading } = useLoadLists({
    status: "in_transit",
    page: 1,
    limit: 1,
  });
  const user = useAuthStore((state) => state.user);
  const greeting = getGreeting();
  const incomingShipmentsCount = inTransitLoadLists?.pagination.total || 0;

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load dashboard data. Please try again.
            <button onClick={() => refetch()} className="ml-2 font-medium underline">
              Retry
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
          {greeting}, {user?.firstName || "User"}!
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening in your warehouse today
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
              title="Incoming Shipments"
              count={incomingShipmentsLoading ? 0 : incomingShipmentsCount}
              subtitle="In Transit"
              icon={TruckIcon}
              iconColor="text-blue-600"
              href="/purchasing/load-lists"
            />
            <SummaryCard
              title="Stock Requests"
              count={data?.summary.pending_stock_requests || 0}
              subtitle="Pending"
              icon={ClipboardList}
              iconColor="text-orange-600"
              href="/inventory/stock-requests"
            />
            <SummaryCard
              title="Pick List"
              count={data?.summary.pick_list_to_pick || 0}
              subtitle="To Pick"
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
        />
      </ClientOnly>

      {/* Last 5 Stock Movements */}
      <StockMovementsList movements={data?.last_stock_movements || []} isLoading={isLoading} />
    </div>
  );
}
