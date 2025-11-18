"use client";

import { DollarSign, Trophy } from "lucide-react";
import { KPICard } from "./kpi-card";
import { useDashboardWidgets } from "@/hooks/useAnalytics";
import { useCurrency } from "@/hooks/useCurrency";

export function MySalesWidget() {
  const { data, isLoading } = useDashboardWidgets();
  const { formatCurrency } = useCurrency();

  const mySales = data?.mySales;

  if (!mySales && !isLoading) {
    // Don't show this widget if user is not a sales agent
    return null;
  }

  return (
    <KPICard
      title="My Sales"
      value={mySales ? formatCurrency(mySales.amount) : formatCurrency(0)}
      description={
        mySales
          ? `${formatCurrency(mySales.commission)} commission • Rank #${mySales.rank}`
          : "No sales yet"
      }
      icon={DollarSign}
      iconColor="text-blue-600"
      isLoading={isLoading}
    />
  );
}
