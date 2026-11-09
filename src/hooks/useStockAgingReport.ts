import type { StockAgingReportFilters, StockAgingReportResponse } from "@/types/stock-aging-report";
import { useQuery } from "@tanstack/react-query";
import { STOCK_AGING_REPORT_QUERY_KEY } from "@/hooks/queryKeys";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export class StockAgingReportError extends Error {
  constructor(public readonly status: number) {
    super("Failed to fetch stock aging report");
    this.name = "StockAgingReportError";
  }
}

export function useStockAgingReport(filters: StockAgingReportFilters) {
  const { enabled = true, ...queryFilters } = filters;

  return useQuery<StockAgingReportResponse>({
    queryKey: [STOCK_AGING_REPORT_QUERY_KEY, queryFilters],
    enabled,
    queryFn: async () => {
      const params = new URLSearchParams();

      if (queryFilters.page) params.append("page", String(queryFilters.page));
      if (queryFilters.limit) params.append("limit", String(queryFilters.limit));
      if (queryFilters.search) params.append("search", queryFilters.search);
      if (queryFilters.category) params.append("category", queryFilters.category);
      if (queryFilters.ageBucket) params.append("ageBucket", queryFilters.ageBucket);

      if (queryFilters.groupBy) params.append("groupBy", queryFilters.groupBy);
      if (queryFilters.exportMode) params.append("exportMode", queryFilters.exportMode);

      const response = await fetch(`${API_BASE_URL}/reports/stock-aging?${params.toString()}`);
      if (!response.ok) {
        throw new StockAgingReportError(response.status);
      }

      return response.json();
    },
    staleTime: 60_000,
  });
}
