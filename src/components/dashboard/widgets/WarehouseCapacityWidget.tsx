"use client";

import { Warehouse, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useWarehouseCapacity } from "@/hooks/usePurchasingDashboard";
import { cn } from "@/lib/utils";
import { WidgetEmptyState } from "./WidgetEmptyState";

type WarehouseCapacityWidgetProps = {
  warehouseId?: string;
};

export function WarehouseCapacityWidget({ warehouseId }: WarehouseCapacityWidgetProps) {
  const { data, isLoading, error } = useWarehouseCapacity({ warehouseId });

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Warehouse Capacity</CardTitle>
              <CardDescription>Space utilization metrics</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Warehouse Capacity</CardTitle>
              <CardDescription>Space utilization metrics</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
            <p className="text-sm text-destructive">Failed to load capacity data</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {error instanceof Error ? error.message : "An error occurred"}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty/no data state
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Warehouse Capacity</CardTitle>
              <CardDescription>Space utilization metrics</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <WidgetEmptyState
            icon={Warehouse}
            title="No capacity data available"
          />
        </CardContent>
      </Card>
    );
  }

  const utilizationPercent = data.utilizationPercent;
  const isHighCapacity = utilizationPercent >= 90;
  const isMediumCapacity = utilizationPercent >= 75 && utilizationPercent < 90;

  // Determine status color
  const statusConfig = {
    label: isHighCapacity ? "Critical" : isMediumCapacity ? "Warning" : "Good",
    color: isHighCapacity ? "text-red-600" : isMediumCapacity ? "text-amber-600" : "text-green-600",
    bgColor: isHighCapacity
      ? "bg-red-100 text-red-700"
      : isMediumCapacity
        ? "bg-amber-100 text-amber-700"
        : "bg-green-100 text-green-700",
    progressColor: isHighCapacity ? "bg-red-500" : isMediumCapacity ? "bg-amber-500" : "bg-green-500",
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Warehouse className="h-5 w-5 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <CardTitle>Warehouse Capacity</CardTitle>
            <CardDescription>Space utilization metrics</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* High Capacity Alert */}
        {isHighCapacity && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Warehouse is at {utilizationPercent.toFixed(1)}% capacity. Consider expanding or optimizing
              storage.
            </AlertDescription>
          </Alert>
        )}

        {/* Utilization Gauge */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Utilization</span>
            <span className={cn("text-xl sm:text-2xl font-bold", statusConfig.color)}>
              {utilizationPercent.toFixed(1)}%
            </span>
          </div>
          <div className="relative h-4 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", statusConfig.progressColor)}
              style={{ width: `${utilizationPercent}%` }}
            />
          </div>
          <div className="flex justify-center">
            <div className={cn("rounded-full px-3 py-1 text-xs font-semibold", statusConfig.bgColor)}>
              {statusConfig.label}
            </div>
          </div>
        </div>

        {/* Location Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-lg border bg-muted/50 p-2 sm:p-3 text-center">
            <div className="text-xs text-muted-foreground">Total</div>
            <p className="mt-1 text-base sm:text-lg font-bold">{data.totalLocations}</p>
          </div>
          <div className="rounded-lg border bg-muted/50 p-2 sm:p-3 text-center">
            <div className="text-xs text-muted-foreground">Occupied</div>
            <p className="mt-1 text-base sm:text-lg font-bold">{data.occupiedLocations}</p>
          </div>
          <div className="rounded-lg border bg-muted/50 p-2 sm:p-3 text-center">
            <div className="text-xs text-muted-foreground">Available</div>
            <p className="mt-1 text-base sm:text-lg font-bold text-green-600">{data.availableSpace}</p>
          </div>
        </div>

        {/* Capacity Breakdown */}
        <div className="space-y-2 rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Capacity Used</span>
            <span className="font-semibold">
              {data.occupiedLocations} / {data.totalLocations}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Space Remaining</span>
            <span className="font-semibold text-green-600">{data.availableSpace} locations</span>
          </div>
        </div>

        {/* Recommendations */}
        {isHighCapacity && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-800">Recommendations:</p>
            <ul className="mt-1 space-y-1 text-xs text-amber-700">
              <li>• Review slow-moving inventory</li>
              <li>• Optimize bin assignments</li>
              <li>• Consider warehouse expansion</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
