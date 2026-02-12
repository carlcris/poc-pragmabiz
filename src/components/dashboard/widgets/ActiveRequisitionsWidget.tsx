"use client";

import Link from "next/link";
import { ClipboardList, ArrowRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useActiveRequisitions } from "@/hooks/usePurchasingDashboard";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { WidgetEmptyState } from "./WidgetEmptyState";

type ActiveRequisitionsWidgetProps = {
  businessUnitId?: string;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8", // gray
  submitted: "#3b82f6", // blue
  partiallyFulfilled: "#f59e0b", // amber
  fulfilled: "#22c55e", // green
  cancelled: "#ef4444", // red
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  partiallyFulfilled: "Partially Fulfilled",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
};

export function ActiveRequisitionsWidget({ businessUnitId }: ActiveRequisitionsWidgetProps) {
  const { data, isLoading, error } = useActiveRequisitions({ businessUnitId });

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Active Requisitions</CardTitle>
              <CardDescription>Requisition status breakdown</CardDescription>
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
              <CardTitle>Active Requisitions</CardTitle>
              <CardDescription>Requisition status breakdown</CardDescription>
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
  if (!data || data.total === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Active Requisitions</CardTitle>
              <CardDescription>Requisition status breakdown</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <WidgetEmptyState
            icon={ClipboardList}
            title="No active requisitions"
          />
        </CardContent>
      </Card>
    );
  }

  // Prepare chart data (exclude zero values)
  const chartData = [
    { name: "Draft", value: data.draft, status: "draft" },
    { name: "Submitted", value: data.submitted, status: "submitted" },
    { name: "Partially Fulfilled", value: data.partiallyFulfilled, status: "partiallyFulfilled" },
    { name: "Fulfilled", value: data.fulfilled, status: "fulfilled" },
    { name: "Cancelled", value: data.cancelled, status: "cancelled" },
  ].filter((item) => item.value > 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <CardTitle>Active Requisitions</CardTitle>
            <CardDescription>Requisition status breakdown</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Count */}
        <div className="rounded-lg border bg-muted/50 p-4">
          <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>Total Requisitions</span>
            <span className="text-2xl sm:text-3xl font-bold text-right text-gray-900">{data.total}</span>
          </div>
        </div>

        {/* Donut Chart */}
        {chartData.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Status Distribution</p>
            <div className="rounded-lg border bg-card p-3">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Status Breakdown List */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">By Status</p>
          <div className="space-y-2">
            {Object.entries(data).map(([key, value]) => {
              if (key === "total" || value === 0) return null;
              const status = key as keyof typeof STATUS_LABELS;
              const label = STATUS_LABELS[status];
              const color = STATUS_COLORS[status];
              const percentage = data.total > 0 ? ((value / data.total) * 100).toFixed(0) : 0;

              return (
                <Link
                  key={key}
                  href={`/purchasing/stock-requisitions?status=${key}`}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-sm font-medium truncate">{label}</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                    <span className="text-sm text-muted-foreground">{percentage}%</span>
                    <span className="text-sm font-bold">{value}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* View All Link */}
        <Button asChild variant="outline" className="w-full">
          <Link href="/purchasing/stock-requisitions">
            View All Requisitions
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
