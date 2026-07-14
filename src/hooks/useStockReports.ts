import { useQuery } from "@tanstack/react-query";
import { STOCK_MOVEMENT_REPORT_QUERY_KEY } from "@/hooks/queryKeys";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export interface StockMovementFilters {
  startDate?: string;
  endDate?: string;
  warehouseId?: string;
  itemId?: string;
  groupBy?: "item" | "warehouse" | "item-warehouse";
  enabled?: boolean;
}

export interface StockMovementData {
  itemId: string;
  itemCode: string;
  itemName: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  uom: string;
  totalIn: number;
  totalOut: number;
  netMovement: number;
  totalInValue: number;
  totalOutValue: number;
  netValue: number;
  transactionCount: number;
}

export interface StockMovementResponse {
  data: StockMovementData[];
  summary: {
    totalIn: number;
    totalOut: number;
    netMovement: number;
    totalInValue: number;
    totalOutValue: number;
    netValue: number;
    totalTransactions: number;
    itemCount: number;
    warehouseCount: number;
  };
  periodComparison: {
    previousPeriod: {
      startDate: string;
      endDate: string;
      totalIn: number;
      totalOut: number;
      totalInValue: number;
      totalOutValue: number;
    };
    changes: {
      totalInChange: number;
      totalInChangePercent: number;
      totalOutChange: number;
      totalOutChangePercent: number;
      totalInValueChange: number;
      totalInValueChangePercent: number;
      totalOutValueChange: number;
      totalOutValueChangePercent: number;
    };
  } | null;
  filters: StockMovementFilters;
}

export function useStockMovement(filters: StockMovementFilters) {
  const { enabled = true, ...queryFilters } = filters;

  return useQuery<StockMovementResponse>({
    queryKey: [STOCK_MOVEMENT_REPORT_QUERY_KEY, queryFilters],
    enabled,
    queryFn: async () => {
      const params = new URLSearchParams();

      if (queryFilters.startDate) params.append("startDate", queryFilters.startDate);
      if (queryFilters.endDate) params.append("endDate", queryFilters.endDate);
      if (queryFilters.warehouseId) params.append("warehouseId", queryFilters.warehouseId);
      if (queryFilters.itemId) params.append("itemId", queryFilters.itemId);
      if (queryFilters.groupBy) params.append("groupBy", queryFilters.groupBy);

      const response = await fetch(`${API_BASE_URL}/reports/stock-movement?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch stock movement report");
      }

      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export interface StockValuationFilters {
  warehouseId?: string;
  itemId?: string;
  category?: string;
  groupBy?: "item" | "warehouse" | "category" | "item-warehouse";
  enabled?: boolean;
}

export interface StockValuationData {
  groupKey: string;
  groupName: string;
  itemId: string | null;
  itemCode: string | null;
  itemName: string | null;
  category: string;
  warehouseId: string | null;
  warehouseCode: string | null;
  warehouseName: string | null;
  totalQuantity: number;
  totalValue: number;
  averageRate: number;
  uom: string;
  warehouseCount: number;
  itemCount: number;
}

export interface StockValuationResponse {
  data: StockValuationData[];
  summary: {
    totalStockValue: number;
    totalQuantity: number;
    itemCount: number;
    warehouseCount: number;
    categoryCount: number;
    averageItemValue: number;
  };
  topItems: StockValuationData[];
  lowValueItems: StockValuationData[];
  categoryBreakdown: {
    category: string;
    totalValue: number;
    itemCount: number;
    percentage: number;
  }[];
  filters: StockValuationFilters;
}

export function useStockValuation(filters: StockValuationFilters) {
  const { enabled = true, ...queryFilters } = filters;

  return useQuery<StockValuationResponse>({
    queryKey: ["stock-valuation-report", queryFilters],
    enabled,
    queryFn: async () => {
      const params = new URLSearchParams();

      if (queryFilters.warehouseId) params.append("warehouseId", queryFilters.warehouseId);
      if (queryFilters.itemId) params.append("itemId", queryFilters.itemId);
      if (queryFilters.category) params.append("category", queryFilters.category);
      if (queryFilters.groupBy) params.append("groupBy", queryFilters.groupBy);

      const response = await fetch(`${API_BASE_URL}/reports/stock-valuation?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch stock valuation report");
      }

      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
