"use client";

import Link from "next/link";
import { Container, Ship, Calendar, ArrowRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useActiveContainers } from "@/hooks/usePurchasingDashboard";
import { format, parseISO, isBefore, startOfToday } from "date-fns";
import { cn } from "@/lib/utils";
import { WidgetEmptyState } from "./WidgetEmptyState";

type ActiveContainersWidgetProps = {
  businessUnitId?: string;
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  confirmed: { label: "Confirmed", className: "bg-blue-100 text-blue-700 border-blue-200" },
  in_transit: { label: "In Transit", className: "bg-purple-100 text-purple-700 border-purple-200" },
  arrived: { label: "Arrived", className: "bg-green-100 text-green-700 border-green-200" },
};

export function ActiveContainersWidget({ businessUnitId }: ActiveContainersWidgetProps) {
  const { data, isLoading, error } = useActiveContainers({ businessUnitId });

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Container className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Active Containers</CardTitle>
              <CardDescription>Containers currently in transit</CardDescription>
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
            <Container className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Active Containers</CardTitle>
              <CardDescription>Containers currently in transit</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
            <p className="text-sm text-destructive">Failed to load containers data</p>
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
            <Container className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Active Containers</CardTitle>
              <CardDescription>Containers currently in transit</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <WidgetEmptyState
            icon={Container}
            title="No active containers"
            description="All containers have been received"
          />
        </CardContent>
      </Card>
    );
  }

  // Sort by ETA (earliest first)
  const sortedItems = [...data.items].sort((a, b) => {
    const dateA = a.estimatedArrival ? new Date(a.estimatedArrival).getTime() : 0;
    const dateB = b.estimatedArrival ? new Date(b.estimatedArrival).getTime() : 0;
    return dateA - dateB;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Container className="h-5 w-5 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <CardTitle>Active Containers</CardTitle>
            <CardDescription>Containers currently in transit</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Count */}
        <div className="rounded-lg border bg-muted/50 p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Ship className="h-4 w-4" />
            <span>In Transit</span>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-bold">{data.count}</p>
        </div>

        {/* Containers List */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Tracked Containers</p>
          <div className="space-y-2">
            {sortedItems.slice(0, 5).map((container) => {
              const statusConfig = STATUS_CONFIG[container.status] || {
                label: container.status,
                className: "bg-gray-100 text-gray-700 border-gray-200",
              };
              const eta = container.estimatedArrival ? parseISO(container.estimatedArrival) : null;
              const isOverdue = eta
                ? isBefore(eta, startOfToday()) && container.status !== "arrived"
                : false;

              return (
                <Link
                  key={container.loadListId}
                  href={`/purchasing/load-lists/${container.loadListId}`}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50",
                    isOverdue && "border-l-4 border-l-destructive"
                  )}
                >
                  <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Container className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm font-medium truncate">{container.containerNumber}</span>
                    </div>
                    <span className="text-xs text-muted-foreground truncate">{container.llNumber}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {container.supplierName || "Unknown Supplier"}
                    </span>
                    {eta && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3 flex-shrink-0" />
                        <span className={cn(isOverdue && "text-destructive font-medium")}>
                          {isOverdue ? "Overdue: " : "ETA: "}
                          {format(eta, "MMM d, yyyy")}
                        </span>
                      </div>
                    )}
                  </div>
                  <Badge className={cn(statusConfig.className, "flex-shrink-0")}>{statusConfig.label}</Badge>
                </Link>
              );
            })}
          </div>
        </div>

        {/* View All Link */}
        {data.count > 5 && (
          <Button asChild variant="outline" className="w-full">
            <Link href="/purchasing/load-lists?hasContainer=true">
              View All Containers
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
