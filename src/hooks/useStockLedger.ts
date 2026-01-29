import { useQuery } from "@tanstack/react-query";

export interface StockLedgerEntry {
  id: string;
  postingDate: string;
  postingTime: string;
  voucherType: string;
  voucherNo: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  actualQty: number;
  qtyAfterTransaction: number;
  incomingRate: number;
  valuationRate: number;
  stockValue: number;
  stockValueDiff: number;
  uom: string;
  transactionId: string;
  transactionCode: string;
  transactionType: string;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
}

export interface StockLedgerFilters {
  itemId?: string;
  warehouseId?: string;
  startDate?: string;
  endDate?: string;
  voucherType?: string;
  page?: number;
  limit?: number;
}

export interface StockLedgerResponse {
  data: StockLedgerEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  openingBalance: number;
}

export function useStockLedger(filters: StockLedgerFilters) {
  return useQuery<StockLedgerResponse>({
    queryKey: ["stock-ledger", filters],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters.itemId) params.append("itemId", filters.itemId);
      if (filters.warehouseId) params.append("warehouseId", filters.warehouseId);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.voucherType) params.append("voucherType", filters.voucherType);
      if (filters.page) params.append("page", filters.page.toString());
      if (filters.limit) params.append("limit", filters.limit.toString());

      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";
      const response = await fetch(`${API_BASE_URL}/stock-ledger?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch stock ledger");
      }

      return response.json();
    },
    enabled: !!filters.itemId && !!filters.warehouseId, // Only fetch when item and warehouse are selected
    staleTime: 1000 * 30, // 30 seconds
  });
}
