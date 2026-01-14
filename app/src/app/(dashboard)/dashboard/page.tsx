"use client";

import { Package, ClipboardList, TruckIcon } from 'lucide-react';
import { useWarehouseDashboard } from '@/hooks/useWarehouseDashboard';
import { SummaryCard } from '@/components/warehouse-dashboard/SummaryCard';
import { InventoryHealthPanel } from '@/components/warehouse-dashboard/InventoryHealthPanel';
import { OperationalQueueTabs } from '@/components/warehouse-dashboard/OperationalQueueTabs';
import { StockMovementsList } from '@/components/warehouse-dashboard/StockMovementsList';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function WarehouseDashboardPage() {
  const { data, isLoading, error, refetch } = useWarehouseDashboard();

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load dashboard data. Please try again.
            <button
              onClick={() => refetch()}
              className="ml-2 underline font-medium"
            >
              Retry
            </button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Warehouse Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor operations and inventory status
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
              title="Incoming Deliveries"
              count={data?.summary.incoming_deliveries_today || 0}
              subtitle="Today"
              icon={TruckIcon}
              iconColor="text-blue-600"
              href="/purchase-orders?filter=incoming_today"
            />
            <SummaryCard
              title="Stock Requests"
              count={data?.summary.pending_stock_requests || 0}
              subtitle="Pending"
              icon={ClipboardList}
              iconColor="text-orange-600"
              href="/stock-requests?filter=pending"
            />
            <SummaryCard
              title="Pick List"
              count={data?.summary.pick_list_to_pick || 0}
              subtitle="To Pick"
              icon={Package}
              iconColor="text-green-600"
              href="/stock-requests?filter=to_pick"
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

      {/* Last 5 Stock Movements */}
      <StockMovementsList
        movements={data?.last_stock_movements || []}
        isLoading={isLoading}
      />
    </div>
  );
}
