import { useQuery } from "@tanstack/react-query";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export type DeliveryDirection = "all" | "outbound" | "inbound" | "internal";
export type DeliveryPerformanceStatus =
  | "all"
  | "on_time"
  | "late"
  | "in_transit"
  | "discrepancy";

export type DeliveryPerformanceFilters = {
  startDate?: string;
  endDate?: string;
  direction?: DeliveryDirection;
  performanceStatus?: DeliveryPerformanceStatus;
  search?: string;
  page?: number;
  limit?: number;
  enabled?: boolean;
};

export type DeliveryPerformanceRow = {
  id: string;
  dnNumber: string;
  sourceBusinessUnitName: string;
  destinationBusinessUnitName: string;
  sourceWarehouseCode: string;
  sourceWarehouseName: string;
  driverName: string | null;
  plateNumber: string | null;
  deliveryNoteStatus: string;
  dispatchedAt: string;
  requiredDate: string | null;
  receivedAt: string | null;
  direction: Exclude<DeliveryDirection, "all">;
  performanceStatus: Exclude<DeliveryPerformanceStatus, "all" | "discrepancy">;
  transitHours: number | null;
  dispatchedQty: number;
  receivedQty: number;
  varianceQty: number;
  hasDiscrepancy: boolean;
};

export type DeliveryPerformanceReportResponse = {
  data: DeliveryPerformanceRow[];
  summary: {
    totalDeliveries: number;
    completedDeliveries: number;
    onTimeDeliveries: number;
    lateDeliveries: number;
    inTransitDeliveries: number;
    discrepancyDeliveries: number;
    perfectDeliveries: number;
    averageTransitHours: number;
    onTimeRatePct: number;
    completionRatePct: number;
    perfectDeliveryRatePct: number;
    totalDispatchedQty: number;
    totalReceivedQty: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export function useDeliveryPerformanceReport(filters: DeliveryPerformanceFilters) {
  const { enabled = true, ...queryFilters } = filters;

  return useQuery<DeliveryPerformanceReportResponse>({
    queryKey: ["delivery-performance-report", queryFilters],
    enabled,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (queryFilters.startDate) params.set("startDate", queryFilters.startDate);
      if (queryFilters.endDate) params.set("endDate", queryFilters.endDate);
      if (queryFilters.direction) params.set("direction", queryFilters.direction);
      if (queryFilters.performanceStatus) {
        params.set("performanceStatus", queryFilters.performanceStatus);
      }
      if (queryFilters.search) params.set("search", queryFilters.search);
      if (queryFilters.page) params.set("page", String(queryFilters.page));
      if (queryFilters.limit) params.set("limit", String(queryFilters.limit));

      const response = await fetch(
        `${API_BASE_URL}/reports/delivery-performance?${params.toString()}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch delivery performance report");
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}
