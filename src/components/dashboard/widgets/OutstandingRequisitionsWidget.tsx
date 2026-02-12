"use client";

import Link from "next/link";
import { ClipboardList, TrendingUp, ArrowRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useOutstandingRequisitions } from "@/hooks/usePurchasingDashboard";
import { formatCurrency } from "@/lib/utils/currency";
import { WidgetEmptyState } from "./WidgetEmptyState";

type OutstandingRequisitionsWidgetProps = {
  warehouseId?: string;
  businessUnitId?: string;
};

export function OutstandingRequisitionsWidget({
  warehouseId,
  businessUnitId,
}: OutstandingRequisitionsWidgetProps) {
  const { data, isLoading, error } = useOutstandingRequisitions({
    warehouseId,
    businessUnitId,
  });

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Outstanding Requisitions</CardTitle>
              <CardDescription>Active stock requisitions pending fulfillment</CardDescription>
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
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Outstanding Requisitions</CardTitle>
              <CardDescription>Active stock requisitions pending fulfillment</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
            <p className="text-sm text-destructive">Failed to load requisitions data</p>
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
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Outstanding Requisitions</CardTitle>
              <CardDescription>Active stock requisitions pending fulfillment</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <WidgetEmptyState
            icon={ClipboardList}
            title="No outstanding requisitions"
            description="All stock requisitions have been fulfilled"
          />
        </CardContent>
      </Card>
    );
  }

  const topItems = data.items.slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <CardTitle>Outstanding Requisitions</CardTitle>
            <CardDescription>Active stock requisitions pending fulfillment</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="rounded-lg border bg-muted/50 p-3 sm:p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ClipboardList className="h-4 w-4" />
              <span>Count</span>
            </div>
            <p className="mt-2 text-xl sm:text-2xl font-bold">{data.count}</p>
          </div>
          <div className="rounded-lg border bg-muted/50 p-3 sm:p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>Total Value</span>
            </div>
            <p className="mt-2 text-xl sm:text-2xl font-bold">{formatCurrency(data.totalValue)}</p>
          </div>
        </div>

        {/* Top 3 Requisitions */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Recent Requisitions</p>
          <div className="space-y-1">
            {topItems.map((sr) => (
              <Link
                key={sr.id}
                href={`/purchasing/stock-requisitions/${sr.id}`}
                className="flex items-center justify-between rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <span className="text-sm font-medium truncate">{sr.sr_number}</span>
                  <span className="text-xs text-muted-foreground">
                    {sr.business_unit?.code || "N/A"}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-3 flex-shrink-0">
                  <span className="text-sm font-semibold whitespace-nowrap">
                    {formatCurrency(sr.total_amount || 0)}
                  </span>
                  <div className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 whitespace-nowrap">
                    {sr.status === "partially_fulfilled" ? "Partial" : "Submitted"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* View All Link */}
        {data.count > 3 && (
          <Button asChild variant="outline" className="w-full">
            <Link href="/purchasing/stock-requisitions">
              View All Requisitions
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
