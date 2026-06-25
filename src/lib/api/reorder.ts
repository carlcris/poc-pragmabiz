import { apiClient } from "@/lib/api";
import type {
  StockLevel,
  ReorderSuggestion,
  ReorderRule,
  ReorderAlert,
  ReorderStatistics,
  ReorderSeason,
  ReorderSeasonItemPolicy,
} from "@/types/reorder";
import type { PaginatedResponse, ApiQueryParams } from "@/types/api";
import type {
  ReorderRuleInput,
  ReorderSuggestionUpdate,
  AcknowledgeAlertInput,
  ReorderSeasonInput,
  ReorderSeasonUpdate,
  ReorderSeasonItemPolicyInput,
  ReorderSeasonItemPolicyUpdate,
} from "@/lib/validations/reorder";

export const reorderApi = {
  // Stock Levels
  getStockLevels: async (params?: ApiQueryParams) => {
    const queryString = params
      ? `?${new URLSearchParams(params as Record<string, string>).toString()}`
      : "";
    const response = await apiClient.get<PaginatedResponse<StockLevel>>(
      `/api/reorder/stock-levels${queryString}`
    );
    return response;
  },

  // Reorder Suggestions
  getReorderSuggestions: async (params?: ApiQueryParams) => {
    const queryString = params
      ? `?${new URLSearchParams(params as Record<string, string>).toString()}`
      : "";
    const response = await apiClient.get<ReorderSuggestion[]>(
      `/api/reorder/suggestions${queryString}`
    );
    return response;
  },

  getReorderSuggestion: async (id: string) => {
    const response = await apiClient.get<ReorderSuggestion>(`/inventory/reorder-suggestions/${id}`);
    return response;
  },

  updateReorderSuggestion: async (id: string, data: ReorderSuggestionUpdate) => {
    const response = await apiClient.patch<ReorderSuggestion>(
      `/inventory/reorder-suggestions/${id}`,
      data
    );
    return response;
  },

  approveReorderSuggestion: async (id: string) => {
    const response = await apiClient.post<ReorderSuggestion>(
      `/inventory/reorder-suggestions/${id}/approve`,
      {}
    );
    return response;
  },

  rejectReorderSuggestion: async (id: string) => {
    const response = await apiClient.post<ReorderSuggestion>(
      `/inventory/reorder-suggestions/${id}/reject`,
      {}
    );
    return response;
  },

  // Reorder Rules
  getReorderRules: async (params?: ApiQueryParams) => {
    const response = await apiClient.get<PaginatedResponse<ReorderRule>>(
      "/inventory/reorder-rules",
      {
        params,
      }
    );
    return response;
  },

  getReorderRule: async (id: string) => {
    const response = await apiClient.get<ReorderRule>(`/inventory/reorder-rules/${id}`);
    return response;
  },

  createReorderRule: async (data: ReorderRuleInput) => {
    const response = await apiClient.post<ReorderRule>("/inventory/reorder-rules", data);
    return response;
  },

  updateReorderRule: async (id: string, data: Partial<ReorderRuleInput>) => {
    const response = await apiClient.patch<ReorderRule>(`/inventory/reorder-rules/${id}`, data);
    return response;
  },

  deleteReorderRule: async (id: string) => {
    const response = await apiClient.delete(`/inventory/reorder-rules/${id}`);
    return response;
  },

  // Reorder Alerts
  getReorderAlerts: async (params?: ApiQueryParams) => {
    const queryString = params
      ? `?${new URLSearchParams(params as Record<string, string>).toString()}`
      : "";
    const response = await apiClient.get<PaginatedResponse<ReorderAlert>>(
      `/api/reorder/alerts${queryString}`
    );
    return response;
  },

  // Reorder Seasons
  getReorderSeasons: async (params?: ApiQueryParams) => {
    const response = await apiClient.get<PaginatedResponse<ReorderSeason>>(
      "/api/reorder/seasons",
      { params }
    );
    return response;
  },

  createReorderSeason: async (data: ReorderSeasonInput) => {
    const response = await apiClient.post<{ data: ReorderSeason }>("/api/reorder/seasons", data);
    return response;
  },

  updateReorderSeason: async (id: string, data: ReorderSeasonUpdate) => {
    const response = await apiClient.patch<{ data: ReorderSeason }>(
      `/api/reorder/seasons/${id}`,
      data
    );
    return response;
  },

  deleteReorderSeason: async (id: string) => {
    const response = await apiClient.delete<{ message: string }>(`/api/reorder/seasons/${id}`);
    return response;
  },

  // Seasonal Reorder Policies
  getReorderSeasonItemPolicies: async (params?: ApiQueryParams) => {
    const response = await apiClient.get<PaginatedResponse<ReorderSeasonItemPolicy>>(
      "/api/reorder/season-policies",
      { params }
    );
    return response;
  },

  createReorderSeasonItemPolicy: async (data: ReorderSeasonItemPolicyInput) => {
    const response = await apiClient.post<{ data: ReorderSeasonItemPolicy }>(
      "/api/reorder/season-policies",
      data
    );
    return response;
  },

  updateReorderSeasonItemPolicy: async (id: string, data: ReorderSeasonItemPolicyUpdate) => {
    const response = await apiClient.patch<{ data: ReorderSeasonItemPolicy }>(
      `/api/reorder/season-policies/${id}`,
      data
    );
    return response;
  },

  deleteReorderSeasonItemPolicy: async (id: string) => {
    const response = await apiClient.delete<{ message: string }>(
      `/api/reorder/season-policies/${id}`
    );
    return response;
  },

  acknowledgeAlerts: async (data: AcknowledgeAlertInput) => {
    const response = await apiClient.post("/api/reorder/alerts/acknowledge", data);
    return response;
  },

  unacknowledgeAlerts: async (data: AcknowledgeAlertInput) => {
    const response = await apiClient.post("/api/reorder/alerts/unacknowledge", data);
    return response;
  },

  // Statistics
  getReorderStatistics: async () => {
    const response = await apiClient.get<ReorderStatistics>("/api/reorder/statistics");
    return response;
  },

  // Generate suggestions manually
  generateReorderSuggestions: async () => {
    const response = await apiClient.post<{ generated: number }>(
      "/inventory/reorder-suggestions/generate",
      {}
    );
    return response;
  },
};
