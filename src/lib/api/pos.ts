import { apiClient } from "@/lib/api";
import type { POSTransaction, POSTransactionCreate } from "@/types/pos";
import type { PaginatedResponse, ApiQueryParams } from "@/types/api";

// POS API endpoints - Updated 2025-11-20
export const posApi = {
  // Get all transactions
  getTransactions: async (params?: ApiQueryParams) => {
    const response = await apiClient.get<PaginatedResponse<POSTransaction>>(
      "/api/pos/transactions",
      {
        params,
      }
    );
    return response;
  },

  // Get single transaction
  getTransaction: async (id: string) => {
    const response = await apiClient.get<POSTransaction>(`/api/pos/transactions/${id}`);
    return response.data;
  },

  // Create transaction
  createTransaction: async (data: POSTransactionCreate) => {
    const response = await apiClient.post<POSTransaction>("/api/pos/transactions", data);
    return response.data;
  },

  // Void transaction
  voidTransaction: async (id: string) => {
    const response = await apiClient.post<POSTransaction>(`/api/pos/transactions/${id}/void`);
    return response.data;
  },

  // Print receipt
  printReceipt: async (id: string) => {
    const response = await apiClient.get(`/api/pos/transactions/${id}/receipt`, {
      responseType: "blob",
    });
    return response.data;
  },
};
