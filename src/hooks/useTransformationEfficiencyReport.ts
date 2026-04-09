import { useQuery } from "@tanstack/react-query";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export type TransformationEfficiencyFilters = {
  startDate?: string;
  endDate?: string;
  warehouseId?: string;
  templateId?: string;
  groupBy?: "template" | "warehouse";
  status?: "COMPLETED" | "PREPARING" | "DRAFT" | "CANCELLED" | "ALL";
  enabled?: boolean;
};

export type TransformationEfficiencyGroupRow = {
  key: string;
  groupType: "template" | "warehouse";
  templateId: string | null;
  templateCode: string | null;
  templateName: string | null;
  warehouseId: string | null;
  warehouseCode: string | null;
  warehouseName: string | null;
  orderCount: number;
  completedCount: number;
  completionRatePct: number;
  plannedQty: number;
  actualQty: number;
  inputConsumedQty: number;
  outputProducedQty: number;
  wastedQty: number;
  yieldPct: number;
  wasteRatePct: number;
  planAdherencePct: number;
  totalInputCost: number;
  totalOutputCost: number;
  totalCostVariance: number;
  avgCostVariancePerOrder: number;
  averageCycleSeconds: number;
};

export type TransformationEfficiencyReportResponse = {
  data: TransformationEfficiencyGroupRow[];
  templatePerformance: TransformationEfficiencyGroupRow[];
  warehousePerformance: TransformationEfficiencyGroupRow[];
  dailyTrend: Array<{
    date: string;
    orderCount: number;
    completedCount: number;
    completionRatePct: number;
    outputProducedQty: number;
    wastedQty: number;
    yieldPct: number;
    wasteRatePct: number;
    avgCycleSeconds: number;
    totalCostVariance: number;
  }>;
  wasteReasons: Array<{ reason: string; count: number }>;
  summary: {
    totalOrders: number;
    completedOrders: number;
    completionRatePct: number;
    totalPlannedQty: number;
    totalActualQty: number;
    totalInputConsumedQty: number;
    totalOutputProducedQty: number;
    totalWastedQty: number;
    yieldPct: number;
    wasteRatePct: number;
    planAdherencePct: number;
    totalInputCost: number;
    totalOutputCost: number;
    totalCostVariance: number;
    averageCycleSeconds: number;
    templateCount: number;
    warehouseCount: number;
  };
  filters: TransformationEfficiencyFilters & {
    warehouseId: string | null;
    templateId: string | null;
    groupBy: "template" | "warehouse";
    status: "COMPLETED" | "PREPARING" | "DRAFT" | "CANCELLED" | "ALL";
  };
};

export function useTransformationEfficiencyReport(filters: TransformationEfficiencyFilters) {
  const { enabled = true, ...queryFilters } = filters;

  return useQuery<TransformationEfficiencyReportResponse>({
    queryKey: ["transformation-efficiency-report", queryFilters],
    enabled,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (queryFilters.startDate) params.append("startDate", queryFilters.startDate);
      if (queryFilters.endDate) params.append("endDate", queryFilters.endDate);
      if (queryFilters.warehouseId) params.append("warehouseId", queryFilters.warehouseId);
      if (queryFilters.templateId) params.append("templateId", queryFilters.templateId);
      if (queryFilters.groupBy) params.append("groupBy", queryFilters.groupBy);
      if (queryFilters.status) params.append("status", queryFilters.status);

      const response = await fetch(
        `${API_BASE_URL}/reports/transformation-efficiency?${params.toString()}`
      );
      if (!response.ok) throw new Error("Failed to fetch transformation efficiency report");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}
