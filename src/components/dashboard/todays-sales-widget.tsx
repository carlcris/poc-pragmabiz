"use client";

import { TrendingUp } from "lucide-react";
import { KPICard } from "./kpi-card";
import { useDashboardWidgets } from "@/hooks/useAnalytics";
import { useCurrency } from "@/hooks/useCurrency";

export function TodaysSalesWidget() {
  const { data, isLoading } = useDashboardWidgets();
  const { formatCurrency } = useCurrency();

  const todaysSales = data?.todaysSales;
  const canViewTotalSales = data?.capabilities?.canViewTotalSales ?? false;

  if (!isLoading && data && !canViewTotalSales) {
    return null;
  }

  return (
    <KPICard
      title="Today's Sales"
      value={todaysSales ? formatCurrency(todaysSales.amount ?? 0) : "--"}
      description={`${todaysSales?.transactions || 0} transactions today`}
      icon={TrendingUp}
      iconColor="text-green-600"
      trend={
        canViewTotalSales && todaysSales?.growth
          ? {
              value: todaysSales.growth,
              label: "vs yesterday",
              isPositive: todaysSales.growth >= 0,
            }
          : undefined
      }
      isLoading={isLoading}
    />
  );
}
