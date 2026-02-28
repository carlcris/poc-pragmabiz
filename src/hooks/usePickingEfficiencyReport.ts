import { useQuery } from "@tanstack/react-query";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export type PickingEfficiencyFilters = {
  startDate?: string;
  endDate?: string;
  warehouseId?: string;
  pickerUserId?: string;
  groupBy?: "picker" | "warehouse";
};

export type PickingEfficiencyGroupRow = {
  groupKey: string;
  groupType: "picker" | "warehouse";
  pickerUserId: string | null;
  pickerName: string | null;
  warehouseId: string | null;
  warehouseCode: string | null;
  warehouseName: string | null;
  pickListCount: number;
  lineCount: number;
  shortLineCount: number;
  allocatedQty: number;
  pickedQty: number;
  shortQty: number;
  activePickSeconds: number;
  activePickHours: number;
  pickLinesPerHour: number;
  averagePickSeconds: number;
  shortPickRatePct: number;
  pickAccuracyPct: number;
  quantityFillRatePct: number;
  pickerUtilizationPct: number;
};

export type PickingEfficiencyReportResponse = {
  data: PickingEfficiencyGroupRow[];
  pickerLeaderboard: PickingEfficiencyGroupRow[];
  warehousePerformance: PickingEfficiencyGroupRow[];
  dailyTrend: Array<{
    date: string;
    pickListCount: number;
    lineCount: number;
    shortLineCount: number;
    allocatedQty: number;
    pickedQty: number;
    shortQty: number;
    pickLinesPerHour: number;
    averagePickSeconds: number;
    shortPickRatePct: number;
    pickAccuracyPct: number;
  }>;
  shortReasons: Array<{
    reason: string;
    count: number;
  }>;
  summary: {
    totalPickLists: number;
    totalLines: number;
    totalAllocatedQty: number;
    totalPickedQty: number;
    totalShortQty: number;
    totalShortLines: number;
    pickLinesPerHour: number;
    averagePickSeconds: number;
    shortPickRatePct: number;
    pickAccuracyPct: number;
    quantityFillRatePct: number;
    activePickHours: number;
    pickerCount: number;
    warehouseCount: number;
  };
  filters: PickingEfficiencyFilters & {
    warehouseId: string | null;
    pickerUserId: string | null;
    groupBy: "picker" | "warehouse";
  };
};

export function usePickingEfficiencyReport(filters: PickingEfficiencyFilters) {
  return useQuery<PickingEfficiencyReportResponse>({
    queryKey: ["picking-efficiency-report", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.warehouseId) params.append("warehouseId", filters.warehouseId);
      if (filters.pickerUserId) params.append("pickerUserId", filters.pickerUserId);
      if (filters.groupBy) params.append("groupBy", filters.groupBy);

      const response = await fetch(`${API_BASE_URL}/reports/picking-efficiency?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch picking efficiency report");
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

