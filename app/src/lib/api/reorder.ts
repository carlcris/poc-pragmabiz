import { apiClient } from "@/lib/api";
import type {
  StockLevel,
  ReorderSuggestion,
  ReorderRule,
  ReorderAlert,
  ReorderStatistics,
} from "@/types/reorder";
import type { PaginatedResponse, ApiQueryParams } from "@/types/api";
import type {
  ReorderRuleInput,
  ReorderSuggestionUpdate,
  AcknowledgeAlertInput,
} from "@/lib/validations/reorder";

export const reorderApi = {
  // Stock Levels
  getStockLevels: async (params?: ApiQueryParams) => {
    const queryString = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : '';
    const response = await apiClient.get<PaginatedResponse<StockLevel>>(`/api/reorder/stock-levels${queryString}`);
    return response.data;
  },

  // Reorder Suggestions
  getReorderSuggestions: async (params?: ApiQueryParams) => {
    const queryString = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : '';
    const response = await apiClient.get<ReorderSuggestion[]>(`/api/reorder/suggestions${queryString}`);
    return response;
  },

  getReorderSuggestion: async (id: string) => {
    const response = await apiClient.get<ReorderSuggestion>(`/inventory/reorder-suggestions/${id}`);
    return response.data;
  },

  updateReorderSuggestion: async (id: string, data: ReorderSuggestionUpdate) => {
    const response = await apiClient.patch<ReorderSuggestion>(
      `/inventory/reorder-suggestions/${id}`,
      data
    );
    return response.data;
  },

  approveReorderSuggestion: async (id: string) => {
    const response = await apiClient.post<ReorderSuggestion>(
      `/inventory/reorder-suggestions/${id}/approve`
    );
    return response.data;
  },

  rejectReorderSuggestion: async (id: string) => {
    const response = await apiClient.post<ReorderSuggestion>(
      `/inventory/reorder-suggestions/${id}/reject`
    );
    return response.data;
  },

  createPurchaseOrderFromSuggestion: async (id: string) => {
    const response = await apiClient.post<{ purchaseOrderId: string }>(
      `/inventory/reorder-suggestions/${id}/create-po`
    );
    return response.data;
  },

  // Reorder Rules
  getReorderRules: async (params?: ApiQueryParams) => {
    const response = await apiClient.get<PaginatedResponse<ReorderRule>>("/inventory/reorder-rules", {
      params,
    });
    return response.data;
  },

  getReorderRule: async (id: string) => {
    const response = await apiClient.get<ReorderRule>(`/inventory/reorder-rules/${id}`);
    return response.data;
  },

  createReorderRule: async (data: ReorderRuleInput) => {
    const response = await apiClient.post<ReorderRule>("/inventory/reorder-rules", data);
    return response.data;
  },

  updateReorderRule: async (id: string, data: Partial<ReorderRuleInput>) => {
    const response = await apiClient.patch<ReorderRule>(`/inventory/reorder-rules/${id}`, data);
    return response.data;
  },

  deleteReorderRule: async (id: string) => {
    const response = await apiClient.delete(`/inventory/reorder-rules/${id}`);
    return response.data;
  },

  // Reorder Alerts
  getReorderAlerts: async (params?: ApiQueryParams) => {
    const queryString = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : '';
    const response = await apiClient.get<PaginatedResponse<ReorderAlert>>(`/api/reorder/alerts${queryString}`);
    return response;
  },

  acknowledgeAlerts: async (data: AcknowledgeAlertInput) => {
    const response = await apiClient.post("/api/reorder/alerts/acknowledge", data);
    return response.data;
  },

  // Statistics
  getReorderStatistics: async () => {
    const response = await apiClient.get<ReorderStatistics>("/api/reorder/statistics");
    return response;
  },

  // Generate suggestions manually
  generateReorderSuggestions: async () => {
    const response = await apiClient.post<{ generated: number }>("/inventory/reorder-suggestions/generate");
    return response.data;
  },
};
