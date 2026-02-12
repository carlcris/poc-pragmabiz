"use client";

import Link from "next/link";
import { AlertCircle, Clock, ArrowRight, Loader2, TruckIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useDelayedShipments } from "@/hooks/usePurchasingDashboard";
import { format, parseISO, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { WidgetEmptyState } from "./WidgetEmptyState";

type DelayedShipmentsWidgetProps = {
  warehouseId?: string;
  businessUnitId?: string;
};

export function DelayedShipmentsWidget({
  warehouseId,
  businessUnitId,
}: DelayedShipmentsWidgetProps) {
  const { data, isLoading, error } = useDelayedShipments({
    warehouseId,
    businessUnitId,
  });

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Delayed Shipments</CardTitle>
              <CardDescription>Shipments past estimated arrival date</CardDescription>
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
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Delayed Shipments</CardTitle>
              <CardDescription>Shipments past estimated arrival date</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
            <p className="text-sm text-destructive">Failed to load delayed shipments</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {error instanceof Error ? error.message : "An error occurred"}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state (good news!)
  if (!data || data.count === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Delayed Shipments</CardTitle>
              <CardDescription>Shipments past estimated arrival date</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <WidgetEmptyState
            icon={TruckIcon}
            title="No delayed shipments"
            description="All deliveries are on track!"
            variant="success"
          />
        </CardContent>
      </Card>
    );
  }

  // Calculate days overdue for each item and sort by most overdue
  const today = new Date();
  const itemsWithOverdue = data.items
    .map((item) => {
      const estimatedDate = item.estimated_arrival_date
        ? parseISO(item.estimated_arrival_date)
        : null;
      const daysOverdue = estimatedDate ? differenceInDays(today, estimatedDate) : 0;

      return {
        ...item,
        daysOverdue,
        severity: daysOverdue > 7 ? "critical" : daysOverdue > 3 ? "high" : "medium",
      };
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  const criticalCount = itemsWithOverdue.filter((item) => item.severity === "critical").length;

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <div className="flex flex-col gap-1">
            <CardTitle className="text-destructive">Delayed Shipments</CardTitle>
            <CardDescription>Shipments past estimated arrival date</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Critical Alert */}
        {criticalCount > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {criticalCount} critical {criticalCount === 1 ? "delay" : "delays"} (7+ days overdue).
              Immediate attention required.
            </AlertDescription>
          </Alert>
        )}

        {/* Total Count */}
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex items-center justify-between gap-2 text-sm text-destructive">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Overdue Shipments</span>
            </div>
            <span className="text-xl sm:text-2xl font-bold text-right text-destructive">{data.count}</span>
          </div>
        </div>

        {/* Delayed Items List */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Most Overdue First</p>
          <div className="space-y-2">
            {itemsWithOverdue.slice(0, 5).map((item) => (
              <Link
                key={item.id}
                href={`/purchasing/load-lists/${item.id}`}
                className={cn(
                  "flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50",
                  item.severity === "critical" && "border-red-500/50 bg-red-50",
                  item.severity === "high" && "border-orange-500/50 bg-orange-50",
                  item.severity === "medium" && "border-yellow-500/50 bg-yellow-50"
                )}
              >
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{item.ll_number}</span>
                    {item.severity === "critical" && (
                      <AlertCircle className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground truncate">
                    {item.supplier?.supplier_name || "Unknown Supplier"}
                  </span>
                  {item.estimated_arrival_date && (
                    <span className="text-xs text-muted-foreground">
                      Expected: {format(parseISO(item.estimated_arrival_date), "MMM d, yyyy")}
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <div
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap",
                      item.severity === "critical" && "bg-red-600 text-white",
                      item.severity === "high" && "bg-orange-600 text-white",
                      item.severity === "medium" && "bg-yellow-600 text-white"
                    )}
                  >
                    {item.daysOverdue} {item.daysOverdue === 1 ? "day" : "days"} late
                  </div>
                  <span className="text-xs capitalize text-muted-foreground">{item.status?.replace("_", " ")}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* View All Link */}
        {data.count > 5 && (
          <Button asChild variant="outline" className="w-full">
            <Link href="/purchasing/load-lists?status=delayed">
              View All Delayed Shipments
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
