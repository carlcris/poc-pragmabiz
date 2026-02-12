"use client";

import Link from "next/link";
import { PackageCheck, Clock, ArrowRight, Loader2, PlayCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTodaysReceivingQueue } from "@/hooks/usePurchasingDashboard";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { WidgetEmptyState } from "./WidgetEmptyState";

type TodaysReceivingQueueWidgetProps = {
  warehouseId?: string;
  businessUnitId?: string;
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  arrived: { label: "Arrived", className: "bg-amber-100 text-amber-700 border-amber-200" },
  receiving: { label: "Receiving", className: "bg-purple-100 text-purple-700 border-purple-200" },
};

export function TodaysReceivingQueueWidget({
  warehouseId,
  businessUnitId,
}: TodaysReceivingQueueWidgetProps) {
  const { data, isLoading, error } = useTodaysReceivingQueue({
    warehouseId,
    businessUnitId,
  });

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Today&apos;s Receiving Queue</CardTitle>
              <CardDescription>Load lists that arrived today</CardDescription>
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
            <PackageCheck className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Today&apos;s Receiving Queue</CardTitle>
              <CardDescription>Load lists that arrived today</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
            <p className="text-sm text-destructive">Failed to load receiving queue</p>
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
            <PackageCheck className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Today&apos;s Receiving Queue</CardTitle>
              <CardDescription>Load lists that arrived today</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <WidgetEmptyState
            icon={PackageCheck}
            title="No items in receiving queue"
            description="No load lists arrived today"
          />
        </CardContent>
      </Card>
    );
  }

  // Sort: "arrived" status first (needs to be started), then "receiving" (in progress)
  const sortedItems = [...data.items].sort((a, b) => {
    if (a.status === "arrived" && b.status === "receiving") return -1;
    if (a.status === "receiving" && b.status === "arrived") return 1;
    return 0;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <PackageCheck className="h-5 w-5 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <CardTitle>Today&apos;s Receiving Queue</CardTitle>
            <CardDescription>Load lists that arrived today</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Count */}
        <div className="rounded-lg border bg-muted/50 p-4">
          <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <PackageCheck className="h-4 w-4" />
              <span>To Receive</span>
            </div>
            <span className="text-2xl font-bold text-right text-primary">{data.count}</span>
          </div>
        </div>

        {/* Queue Items */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Queue</p>
          <div className="space-y-2">
            {sortedItems.map((item) => {
              const statusConfig = STATUS_CONFIG[item.status] || {
                label: item.status,
                className: "bg-gray-100 text-gray-700 border-gray-200",
              };
              const isArrived = item.status === "arrived";

              return (
                <Link
                  key={item.id}
                  href={`/tablet/receiving/${item.id}`}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50",
                    isArrived && "border-l-4 border-l-amber-500"
                  )}
                >
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{item.ll_number}</span>
                      {isArrived && (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Clock className="h-3 w-3" />
                          Pending
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {item.supplier?.supplier_name || "Unknown Supplier"}
                    </span>
                    {item.actual_arrival_date && (
                      <span className="text-xs text-muted-foreground">
                        Arrived: {format(parseISO(item.actual_arrival_date), "h:mm a")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={statusConfig.className}>{statusConfig.label}</Badge>
                    <Button size="sm" variant={isArrived ? "default" : "outline"}>
                      {isArrived ? (
                        <>
                          <PlayCircle className="mr-1 h-3.5 w-3.5" />
                          Start
                        </>
                      ) : (
                        "Resume"
                      )}
                    </Button>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* View All Link */}
        <Button asChild variant="outline" className="w-full">
          <Link href="/tablet/receiving">
            View All Receiving
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
