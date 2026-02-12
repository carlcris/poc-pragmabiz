"use client";

import Link from "next/link";
import { Package, ArrowRight, Loader2, Truck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useExpectedArrivalsThisWeek } from "@/hooks/usePurchasingDashboard";
import { format, parseISO, startOfWeek, addDays, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { WidgetEmptyState } from "./WidgetEmptyState";

type ExpectedArrivalsWidgetProps = {
  warehouseId?: string;
  businessUnitId?: string;
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-blue-100 text-blue-700 border-blue-200",
  in_transit: "bg-purple-100 text-purple-700 border-purple-200",
};

export function ExpectedArrivalsWidget({
  warehouseId,
  businessUnitId,
}: ExpectedArrivalsWidgetProps) {
  const { data, isLoading, error } = useExpectedArrivalsThisWeek({
    warehouseId,
    businessUnitId,
  });

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Expected Arrivals This Week</CardTitle>
              <CardDescription>Upcoming deliveries schedule</CardDescription>
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
            <Package className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Expected Arrivals This Week</CardTitle>
              <CardDescription>Upcoming deliveries schedule</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
            <p className="text-sm text-destructive">Failed to load arrivals data</p>
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
            <Package className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Expected Arrivals This Week</CardTitle>
              <CardDescription>Upcoming deliveries schedule</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <WidgetEmptyState
            icon={Package}
            title="No expected arrivals this week"
            description="Check back later for updates"
          />
        </CardContent>
      </Card>
    );
  }

  // Group items by day
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 0 }); // Sunday
  const daysOfWeek = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const itemsByDay = daysOfWeek.map((day) => {
    const dayItems = data.items.filter((item) => {
      if (!item.estimated_arrival_date) return false;
      const itemDate = parseISO(item.estimated_arrival_date);
      return isSameDay(itemDate, day);
    });

    return {
      day,
      dayName: format(day, "EEE"),
      date: format(day, "MMM d"),
      isToday: isSameDay(day, now),
      items: dayItems,
      count: dayItems.length,
    };
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <CardTitle>Expected Arrivals This Week</CardTitle>
            <CardDescription>Upcoming deliveries schedule</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Count */}
        <div className="rounded-lg border bg-muted/50 p-4">
          <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              <span>Total Deliveries</span>
            </div>
            <span className="text-2xl font-bold text-right text-primary">{data.count}</span>
          </div>
        </div>

        {/* Timeline by Day */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Weekly Schedule</p>
          <div className="space-y-1.5">
            {itemsByDay.map((dayData) => (
              <div
                key={dayData.day.toISOString()}
                className={cn(
                  "flex items-center justify-between rounded-lg border p-3",
                  dayData.isToday && "border-primary bg-primary/5"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center">
                    <span className={cn("text-xs font-medium", dayData.isToday && "text-primary")}>
                      {dayData.dayName}
                    </span>
                    <span className={cn("text-xs text-muted-foreground", dayData.isToday && "text-primary")}>
                      {dayData.date}
                    </span>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  {dayData.count > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {dayData.items.slice(0, 3).map((item) => (
                        <Link
                          key={item.id}
                          href={`/purchasing/load-lists/${item.id}`}
                          className="group relative"
                        >
                          <div
                            className={cn(
                              "rounded border px-2 py-0.5 text-xs font-medium transition-colors hover:opacity-80",
                              STATUS_COLORS[item.status] || "bg-gray-100 text-gray-700 border-gray-200"
                            )}
                          >
                            {item.ll_number}
                          </div>
                        </Link>
                      ))}
                      {dayData.count > 3 && (
                        <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          +{dayData.count - 3}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">No deliveries</span>
                  )}
                </div>
                {dayData.count > 0 && (
                  <div className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    {dayData.count}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* View All Link */}
        <Button asChild variant="outline" className="w-full">
          <Link href="/purchasing/load-lists">
            View All Load Lists
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
