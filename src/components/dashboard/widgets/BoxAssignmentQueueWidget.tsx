"use client";

import Link from "next/link";
import { Package, BoxIcon, ArrowRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBoxAssignmentQueue } from "@/hooks/usePurchasingDashboard";
import { WidgetEmptyState } from "./WidgetEmptyState";

export function BoxAssignmentQueueWidget() {
  const { data, isLoading, error } = useBoxAssignmentQueue();

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BoxIcon className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Box Assignment Queue</CardTitle>
              <CardDescription>Items awaiting box assignment</CardDescription>
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
            <BoxIcon className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Box Assignment Queue</CardTitle>
              <CardDescription>Items awaiting box assignment</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
            <p className="text-sm text-destructive">Failed to load box assignment queue</p>
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
            <BoxIcon className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Box Assignment Queue</CardTitle>
              <CardDescription>Items awaiting box assignment</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <WidgetEmptyState
            icon={BoxIcon}
            title="All items assigned!"
            description="No items awaiting box assignment"
            variant="success"
          />
        </CardContent>
      </Card>
    );
  }

  // Sort by highest quantity first (priority)
  const sortedItems = [...data.items].sort((a, b) => b.receivedQty - a.receivedQty);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BoxIcon className="h-5 w-5 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <CardTitle>Box Assignment Queue</CardTitle>
            <CardDescription>Items awaiting box assignment</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Count */}
        <div className="rounded-lg border bg-muted/50 p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Package className="h-4 w-4" />
            <span>Items Pending</span>
          </div>
          <p className="mt-2 text-2xl font-bold">{data.count}</p>
        </div>

        {/* Queue Items */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Queue</p>
          <div className="space-y-2">
            {sortedItems.slice(0, 6).map((item) => (
              <Link
                key={`${item.grnId}-${item.itemId}`}
                href={`/purchasing/grns/${item.grnId}/boxes`}
                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.grnNumber}</span>
                    <Badge variant="outline" className="text-xs">
                      {item.itemCode}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{item.itemName}</span>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Package className="h-3 w-3" />
                    <span>
                      {item.receivedQty} {item.receivedQty === 1 ? "unit" : "units"} received
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="default">
                    Assign
                  </Button>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* View All Link */}
        {data.count > 6 && (
          <Button asChild variant="outline" className="w-full">
            <Link href="/purchasing/grns?tab=box-assignment">
              View All Items
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
