"use client";

import Link from "next/link";
import { Truck, FileText, ArrowRight, Loader2, Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useIncomingDeliveriesWithSRs } from "@/hooks/usePurchasingDashboard";
import { format, parseISO } from "date-fns";
import { WidgetEmptyState } from "./WidgetEmptyState";

type IncomingDeliveriesWidgetProps = {
  warehouseId?: string;
  businessUnitId?: string;
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  confirmed: { label: "Confirmed", className: "bg-blue-100 text-blue-700 border-blue-200" },
  in_transit: { label: "In Transit", className: "bg-purple-100 text-purple-700 border-purple-200" },
  arrived: { label: "Arrived", className: "bg-amber-100 text-amber-700 border-amber-200" },
};

export function IncomingDeliveriesWidget({
  warehouseId,
  businessUnitId,
}: IncomingDeliveriesWidgetProps) {
  const { data, isLoading, error } = useIncomingDeliveriesWithSRs({
    warehouseId,
    businessUnitId,
  });

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Incoming Deliveries</CardTitle>
              <CardDescription>Deliveries linked to stock requisitions</CardDescription>
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
            <Truck className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Incoming Deliveries</CardTitle>
              <CardDescription>Deliveries linked to stock requisitions</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
            <p className="text-sm text-destructive">Failed to load deliveries data</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {error instanceof Error ? error.message : "An error occurred"}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (!data || data.count === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Incoming Deliveries</CardTitle>
              <CardDescription>Deliveries linked to stock requisitions</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <WidgetEmptyState
            icon={Truck}
            title="No incoming deliveries"
            description="No load lists with linked requisitions"
          />
        </CardContent>
      </Card>
    );
  }

  // Sort by estimated arrival date (earliest first)
  const sortedItems = [...data.items].sort((a, b) => {
    const dateA = a.loadList.estimated_arrival_date
      ? new Date(a.loadList.estimated_arrival_date).getTime()
      : 0;
    const dateB = b.loadList.estimated_arrival_date
      ? new Date(b.loadList.estimated_arrival_date).getTime()
      : 0;
    return dateA - dateB;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <CardTitle>Incoming Deliveries</CardTitle>
            <CardDescription>Deliveries linked to stock requisitions</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Count */}
        <div className="rounded-lg border bg-muted/50 p-4">
          <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              <span>Deliveries</span>
            </div>
            <span className="text-xl sm:text-2xl font-bold text-right text-gray-900">{data.count}</span>
          </div>
        </div>

        {/* Deliveries List */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Expected Deliveries</p>
          <div className="space-y-2">
            {sortedItems.slice(0, 5).map((delivery) => {
              const ll = delivery.loadList;
              const statusConfig = STATUS_CONFIG[ll.status] || {
                label: ll.status,
                className: "bg-gray-100 text-gray-700 border-gray-200",
              };
              const srCount = delivery.linkedRequisitions.length;

              return (
                <Link
                  key={ll.id}
                  href={`/purchasing/load-lists/${ll.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{ll.ll_number}</span>
                      <Badge variant="outline" className="gap-1 flex-shrink-0">
                        <FileText className="h-3 w-3" />
                        {srCount} {srCount === 1 ? "SR" : "SRs"}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground truncate">
                      {ll.supplier?.supplier_name || "Unknown Supplier"}
                    </span>
                    {ll.estimated_arrival_date && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3 flex-shrink-0" />
                        <span>
                          ETA: {format(parseISO(ll.estimated_arrival_date), "MMM d, yyyy")}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <Badge className={statusConfig.className}>{statusConfig.label}</Badge>
                    {ll.container_number && (
                      <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                        {ll.container_number}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* View All Link */}
        {data.count > 5 && (
          <Button asChild variant="outline" className="w-full">
            <Link href="/purchasing/load-lists?withSRs=true">
              View All Deliveries
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
