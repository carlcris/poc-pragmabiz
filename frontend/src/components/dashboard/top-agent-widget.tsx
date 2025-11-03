"use client";

import { Award } from "lucide-react";
import { KPICard } from "./kpi-card";
import { useDashboardWidgets } from "@/hooks/useAnalytics";
import { useCurrency } from "@/hooks/useCurrency";

export function TopAgentWidget() {
  const { data, isLoading } = useDashboardWidgets();
  const { formatCurrency } = useCurrency();

  const topAgent = data?.topAgent;

  return (
    <KPICard
      title="Top Sales Agent"
      value={topAgent?.name || "-"}
      description={
        topAgent
          ? `${formatCurrency(topAgent.sales)} • ${topAgent.transactions} transactions`
          : "No data available"
      }
      icon={Award}
      iconColor="text-yellow-600"
      isLoading={isLoading}
    />
  );
}
