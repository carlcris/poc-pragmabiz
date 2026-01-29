import type {
  StockTransaction,
  CreateStockTransactionRequest,
  StockTransactionFilters,
  StockTransactionListResponse,
  StockBalance,
} from "@/types/stock-transaction";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export const stockTransactionsApi = {
  async getTransactions(filters?: StockTransactionFilters): Promise<StockTransactionListResponse> {
    const params = new URLSearchParams();
    if (filters?.search) params.append("search", filters.search);
    if (filters?.transactionType && filters.transactionType !== "all") {
      params.append("transactionType", filters.transactionType);
    }
    if (filters?.itemId) params.append("itemId", filters.itemId);
    if (filters?.warehouseId) params.append("warehouseId", filters.warehouseId);
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.limit) params.append("limit", String(filters.limit));

    const response = await fetch(`${API_BASE_URL}/stock-transactions?${params.toString()}`);
    if (!response.ok) throw new Error("Failed to fetch stock transactions");
    return response.json();
  },

  async getTransaction(id: string): Promise<StockTransaction> {
    const response = await fetch(`${API_BASE_URL}/stock-transactions/${id}`);
    if (!response.ok) throw new Error("Failed to fetch stock transaction");
    return response.json();
  },

  async createTransaction(data: CreateStockTransactionRequest): Promise<StockTransaction> {
    const response = await fetch(`${API_BASE_URL}/stock-transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to create stock transaction");
    return response.json();
  },

  async getStockBalances(filters?: {
    warehouseId?: string;
    itemId?: string;
  }): Promise<StockBalance[]> {
    const params = new URLSearchParams();
    if (filters?.warehouseId) params.append("warehouseId", filters.warehouseId);
    if (filters?.itemId) params.append("itemId", filters.itemId);

    const response = await fetch(`${API_BASE_URL}/stock-balances?${params.toString()}`);
    if (!response.ok) throw new Error("Failed to fetch stock balances");
    return response.json();
  },
};
