import { useQuery } from "@tanstack/react-query";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export type StockAgingAgeBucket =
  | "all"
  | "0_30"
  | "31_60"
  | "61_90"
  | "91_180"
  | "181_plus"
  | "90_plus";

export type StockAgingReportFilters = {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  ageBucket?: StockAgingAgeBucket;
};

export type StockAgingReportRow = {
  id: string;
  itemId: string;
  itemCode: string | null;
  itemName: string | null;
  itemSku: string | null;
  category: string;
  warehouseId: string;
  warehouseCode: string | null;
  warehouseName: string | null;
  locationId: string;
  locationCode: string | null;
  locationName: string | null;
  itemBatchId: string;
  batchCode: string | null;
  batchReceivedAt: string | null;
  batchAgeDays: number;
  ageBucket: Exclude<StockAgingAgeBucket, "all">;
  qtyOnHand: number;
  qtyReserved: number;
  qtyAvailable: number;
  unitCost: number;
  stockValue: number;
  batchLocationSku: string | null;
  updatedAt: string;
};

export type StockAgingReportResponse = {
  data: StockAgingReportRow[];
  summary: {
    rowCount: number;
    totalQtyOnHand: number;
    totalQtyReserved: number;
    totalQtyAvailable: number;
    totalStockValue: number;
    aged90PlusRows: number;
    aged90PlusQty: number;
    oldestAgeDays: number;
    uniqueLocations: number;
    uniqueBatches: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    search: string | null;
    category: string | null;
    ageBucket: StockAgingAgeBucket;
    currentBusinessUnitId: string | null;
  };
};

export function useStockAgingReport(filters: StockAgingReportFilters) {
  return useQuery<StockAgingReportResponse>({
    queryKey: ["stock-aging-report", filters],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters.page) params.append("page", String(filters.page));
      if (filters.limit) params.append("limit", String(filters.limit));
      if (filters.search) params.append("search", filters.search);
      if (filters.category) params.append("category", filters.category);
      if (filters.ageBucket) params.append("ageBucket", filters.ageBucket);

      const response = await fetch(`${API_BASE_URL}/reports/stock-aging?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch stock aging report");
      }

      return response.json();
    },
    staleTime: 60_000,
  });
}
