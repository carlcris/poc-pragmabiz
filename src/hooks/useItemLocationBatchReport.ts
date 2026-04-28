import { useQuery } from "@tanstack/react-query";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export type ItemLocationBatchReportFilters = {
  page?: number;
  limit?: number;
  warehouseId?: string;
  itemId?: string;
  search?: string;
  stockStatus?: "all" | "zero" | "available_only" | "reserved";
  sortBy?: "updated_at" | "qty_on_hand" | "received_at";
  sortOrder?: "asc" | "desc";
  enabled?: boolean;
};

export type ItemLocationBatchReportRow = {
  id: string;
  itemId: string;
  itemCode: string | null;
  itemName: string | null;
  warehouseId: string;
  warehouseCode: string | null;
  warehouseName: string | null;
  locationId: string;
  locationCode: string | null;
  locationName: string | null;
  itemBatchId: string;
  batchCode: string | null;
  batchReceivedAt: string | null;
  batchAgeDays: number | null;
  batchLocationSku: string | null;
  qtyOnHand: number;
  qtyReserved: number;
  qtyAvailable: number;
  updatedAt: string;
};

export type ItemLocationBatchReportResponse = {
  data: ItemLocationBatchReportRow[];
  summary: {
    rowCount: number;
    totalRows: number;
    totalQtyOnHand: number;
    totalQtyReserved: number;
    totalQtyAvailable: number;
    uniqueItems: number;
    uniqueLocations: number;
    uniqueBatches: number;
    rowsWithReserved: number;
    zeroStockRows: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    warehouseId: string | null;
    itemId: string | null;
    search: string | null;
    stockStatus: string;
    sortBy: string;
    sortOrder: "asc" | "desc";
  };
};

export function useItemLocationBatchReport(filters: ItemLocationBatchReportFilters) {
  const { enabled = true, ...queryFilters } = filters;

  return useQuery<ItemLocationBatchReportResponse>({
    queryKey: ["item-location-batch-report", queryFilters],
    enabled,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (queryFilters.page) params.append("page", String(queryFilters.page));
      if (queryFilters.limit) params.append("limit", String(queryFilters.limit));
      if (queryFilters.warehouseId) params.append("warehouseId", queryFilters.warehouseId);
      if (queryFilters.itemId) params.append("itemId", queryFilters.itemId);
      if (queryFilters.search) params.append("search", queryFilters.search);
      if (queryFilters.stockStatus) params.append("stockStatus", queryFilters.stockStatus);
      if (queryFilters.sortBy) params.append("sortBy", queryFilters.sortBy);
      if (queryFilters.sortOrder) params.append("sortOrder", queryFilters.sortOrder);

      const response = await fetch(
        `${API_BASE_URL}/reports/item-location-batch?${params.toString()}`
      );
      if (!response.ok) throw new Error("Failed to fetch item location batch report");
      return response.json();
    },
    staleTime: 60_000,
  });
}
