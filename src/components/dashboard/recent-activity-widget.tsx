"use client";

import { Activity, MapPin, User } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardWidgets } from "@/hooks/useAnalytics";
import { useCurrency } from "@/hooks/useCurrency";

export function RecentActivityWidget() {
  const { data, isLoading } = useDashboardWidgets();
  const { formatCurrency } = useCurrency();

  const recentActivity = data?.recentActivity || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Sales Activity
          </CardTitle>
          <CardDescription>Latest transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 flex-shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="mb-2 h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <div className="text-right">
                  <Skeleton className="mb-1 h-4 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (recentActivity.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Sales Activity
          </CardTitle>
          <CardDescription>Latest transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">No recent activity</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Recent Sales Activity
        </CardTitle>
        <CardDescription>Latest transactions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentActivity.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Activity className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{activity.customer}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {activity.agent}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {activity.location}
                  </span>
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-sm font-bold">{formatCurrency(activity.amount)}</p>
                <p className="text-xs text-muted-foreground">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
