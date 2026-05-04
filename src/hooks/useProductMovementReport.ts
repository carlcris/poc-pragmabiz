import { useQuery } from "@tanstack/react-query";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export type ProductMovementReportType = "fast" | "slow";

export type ProductMovementReportFilters = {
  movementType: ProductMovementReportType;
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
  categoryId?: string;
  search?: string;
  enabled?: boolean;
};

export type ProductMovementReportRow = {
  itemId: string;
  itemCode: string;
  itemName: string;
  categoryId: string | null;
  categoryName: string | null;
  uom: string | null;
  quantitySold: number;
  revenue: number;
  transactionCount: number;
  currentStock: number;
  availableStock: number;
  unitCost: number;
  stockValue: number;
  averageDailyQuantity: number;
  daysOfCover: number | null;
  lastSoldAt: string | null;
  movementRank: number;
};

export type ProductMovementReportResponse = {
  data: ProductMovementReportRow[];
  summary: {
    rowCount: number;
    totalQuantitySold: number;
    totalRevenue: number;
    totalStockValue: number;
    zeroSalesCount: number;
    averageDailyQuantity: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    movementType: ProductMovementReportType;
    dateFrom: string | null;
    dateTo: string | null;
    categoryId: string | null;
    search: string | null;
    currentBusinessUnitId: string | null;
  };
};

export function useProductMovementReport(filters: ProductMovementReportFilters) {
  const { enabled = true, ...queryFilters } = filters;

  return useQuery<ProductMovementReportResponse>({
    queryKey: ["product-movement-report", queryFilters],
    enabled,
    queryFn: async () => {
      const params = new URLSearchParams();

      params.append("movementType", queryFilters.movementType);
      if (queryFilters.page) params.append("page", String(queryFilters.page));
      if (queryFilters.limit) params.append("limit", String(queryFilters.limit));
      if (queryFilters.dateFrom) params.append("dateFrom", queryFilters.dateFrom);
      if (queryFilters.dateTo) params.append("dateTo", queryFilters.dateTo);
      if (queryFilters.categoryId) params.append("categoryId", queryFilters.categoryId);
      if (queryFilters.search) params.append("search", queryFilters.search);

      const response = await fetch(`${API_BASE_URL}/reports/product-movement?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch product movement report");
      }

      return response.json();
    },
    staleTime: 60_000,
  });
}
