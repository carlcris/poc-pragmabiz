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
};

export type ItemLocationBatchReportRow = {
  id: string;
  itemId: string;
  itemCode: string | null;
  itemName: string | null;
  itemSku: string | null;
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
  return useQuery<ItemLocationBatchReportResponse>({
    queryKey: ["item-location-batch-report", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.page) params.append("page", String(filters.page));
      if (filters.limit) params.append("limit", String(filters.limit));
      if (filters.warehouseId) params.append("warehouseId", filters.warehouseId);
      if (filters.itemId) params.append("itemId", filters.itemId);
      if (filters.search) params.append("search", filters.search);
      if (filters.stockStatus) params.append("stockStatus", filters.stockStatus);
      if (filters.sortBy) params.append("sortBy", filters.sortBy);
      if (filters.sortOrder) params.append("sortOrder", filters.sortOrder);

      const response = await fetch(`${API_BASE_URL}/reports/item-location-batch?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch item location batch report");
      return response.json();
    },
    staleTime: 60_000,
  });
}

