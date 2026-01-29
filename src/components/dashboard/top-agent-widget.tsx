"use client";

import { Award } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardWidgets } from "@/hooks/useAnalytics";
import { useCurrency } from "@/hooks/useCurrency";

export function TopAgentWidget() {
  const { data, isLoading } = useDashboardWidgets();
  const { formatCurrency } = useCurrency();

  const topAgent = data?.topAgent;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Top Sales Agent
          </CardTitle>
          <CardDescription>Best performer this month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 flex-shrink-0 rounded-full" />
            <div className="flex-1">
              <Skeleton className="mb-2 h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!topAgent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Top Sales Agent
          </CardTitle>
          <CardDescription>Best performer this month</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">No sales data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          Top Sales Agent
        </CardTitle>
        <CardDescription>Best performer this month</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-yellow-100 text-yellow-600">
            <Award className="h-8 w-8" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-2xl font-bold">{topAgent.name}</p>
            <div className="mt-1 flex items-center gap-3">
              <p className="text-sm font-medium text-muted-foreground">
                {formatCurrency(topAgent.sales)}
              </p>
              <span className="text-muted-foreground">•</span>
              <p className="text-sm text-muted-foreground">{topAgent.transactions} transactions</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
