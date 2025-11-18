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
            <Skeleton className="h-16 w-16 rounded-full flex-shrink-0" />
            <div className="flex-1">
              <Skeleton className="h-6 w-32 mb-2" />
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
          <p className="text-sm text-muted-foreground text-center py-8">
            No sales data available
          </p>
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
          <div className="flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 text-yellow-600 flex-shrink-0">
            <Award className="h-8 w-8" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-bold truncate">{topAgent.name}</p>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm font-medium text-muted-foreground">
                {formatCurrency(topAgent.sales)}
              </p>
              <span className="text-muted-foreground">•</span>
              <p className="text-sm text-muted-foreground">
                {topAgent.transactions} transactions
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
