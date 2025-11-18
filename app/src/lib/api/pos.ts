import { apiClient } from "@/lib/api";
import type { POSTransaction, POSTransactionCreate } from "@/types/pos";
import type { PaginatedResponse, ApiQueryParams } from "@/types/api";

export const posApi = {
  // Get all transactions
  getTransactions: async (params?: ApiQueryParams) => {
    const response = await apiClient.get<PaginatedResponse<POSTransaction>>("/pos/transactions", {
      params,
    });
    return response.data;
  },

  // Get single transaction
  getTransaction: async (id: string) => {
    const response = await apiClient.get<POSTransaction>(`/pos/transactions/${id}`);
    return response.data;
  },

  // Create transaction
  createTransaction: async (data: POSTransactionCreate) => {
    const response = await apiClient.post<POSTransaction>("/pos/transactions", data);
    return response.data;
  },

  // Void transaction
  voidTransaction: async (id: string) => {
    const response = await apiClient.post<POSTransaction>(`/pos/transactions/${id}/void`);
    return response.data;
  },

  // Print receipt
  printReceipt: async (id: string) => {
    const response = await apiClient.get(`/pos/transactions/${id}/receipt`, {
      responseType: "blob",
    });
    return response.data;
  },
};
