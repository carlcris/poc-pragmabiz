import { useQuery } from "@tanstack/react-query";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export type InventoryStockStatus = "all" | "on_hand" | "available" | "allocated" | "in_transit" | "zero";

export type InventoryReportSortBy =
  | "updated_at"
  | "current_stock"
  | "reserved_stock"
  | "available_stock"
  | "in_transit";

export type InventoryReportFilters = {
  page?: number;
  limit?: number;
  warehouseId?: string;
  category?: string;
  search?: string;
  stockStatus?: InventoryStockStatus;
  sortBy?: InventoryReportSortBy;
  sortOrder?: "asc" | "desc";
  enabled?: boolean;
};

export type InventoryReportRow = {
  id: string;
  itemId: string;
  itemCode: string | null;
  itemName: string | null;
  category: string;
  uom: string;
  warehouseId: string;
  warehouseCode: string | null;
  warehouseName: string | null;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  inTransit: number;
  reorderLevel: number;
  reorderQuantity: number;
  maxQuantity: number | null;
  stockValue: number;
  unitCost: number;
  status: InventoryStockStatus;
  updatedAt: string;
};

export type InventoryReportResponse = {
  data: InventoryReportRow[];
  summary: {
    rowCount: number;
    pageQtyOnHand: number;
    pageQtyReserved: number;
    pageQtyAvailable: number;
    pageQtyInTransit: number;
    pageStockValue: number;
    lowStockRows: number;
    outOfStockRows: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    warehouseId: string | null;
    category: string | null;
    search: string | null;
    stockStatus: InventoryStockStatus;
    sortBy: InventoryReportSortBy;
    sortOrder: "asc" | "desc";
    currentBusinessUnitId: string | null;
  };
};

export function useInventoryReport(filters: InventoryReportFilters) {
  const { enabled = true, ...queryFilters } = filters;

  return useQuery<InventoryReportResponse>({
    queryKey: ["inventory-report", queryFilters],
    enabled,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (queryFilters.page) params.append("page", String(queryFilters.page));
      if (queryFilters.limit) params.append("limit", String(queryFilters.limit));
      if (queryFilters.warehouseId) params.append("warehouseId", queryFilters.warehouseId);
      if (queryFilters.category) params.append("category", queryFilters.category);
      if (queryFilters.search) params.append("search", queryFilters.search);
      if (queryFilters.stockStatus) params.append("stockStatus", queryFilters.stockStatus);
      if (queryFilters.sortBy) params.append("sortBy", queryFilters.sortBy);
      if (queryFilters.sortOrder) params.append("sortOrder", queryFilters.sortOrder);

      const response = await fetch(`${API_BASE_URL}/reports/inventory?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch inventory report");
      }

      return response.json();
    },
    staleTime: 60_000,
  });
}
