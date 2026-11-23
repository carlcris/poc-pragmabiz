import type {
  StockRequisition,
  CreateStockRequisitionRequest,
  UpdateStockRequisitionRequest,
  StockRequisitionFilters,
  StockRequisitionsResponse,
  StockRequisitionStatus,
  SaveStockRequisitionResponse,
} from "@/types/stock-requisition";
import { apiClient } from "@/lib/api";

const API_BASE = "/api/stock-requisitions";

export const stockRequisitionsApi = {
  getStockRequisitions: async (
    filters?: StockRequisitionFilters
  ): Promise<StockRequisitionsResponse> => {
    const params = new URLSearchParams();
    if (filters?.search) params.append("search", filters.search);
    if (filters?.status && filters.status !== "all") params.append("status", filters.status);
    if (filters?.supplierId) params.append("supplierId", filters.supplierId);
    if (filters?.dateFrom) params.append("startDate", filters.dateFrom);
    if (filters?.dateTo) params.append("endDate", filters.dateTo);
    if (filters?.page) params.append("page", filters.page.toString());
    if (filters?.limit) params.append("limit", filters.limit.toString());

    const response = await fetch(`${API_BASE}?${params.toString()}`);
    if (!response.ok) throw new Error("Failed to fetch stock requisitions");
    return response.json();
  },

  getStockRequisition: async (id: string): Promise<StockRequisition> => {
    const response = await fetch(`${API_BASE}/${id}`);
    if (!response.ok) throw new Error("Failed to fetch stock requisition");
    return response.json();
  },

  createStockRequisition: async (
    data: CreateStockRequisitionRequest
  ): Promise<SaveStockRequisitionResponse> => {
    return apiClient.post<SaveStockRequisitionResponse>(API_BASE, data);
  },

  updateStockRequisition: async (
    id: string,
    data: UpdateStockRequisitionRequest
  ): Promise<SaveStockRequisitionResponse> => {
    return apiClient.put<SaveStockRequisitionResponse>(`${API_BASE}/${id}`, data);
  },

  deleteStockRequisition: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete stock requisition");
    }
  },

  updateStockRequisitionStatus: async (
    id: string,
    status: StockRequisitionStatus
  ): Promise<{ id: string; srNumber: string; status: string; message: string }> => {
    const response = await fetch(`${API_BASE}/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update stock requisition status");
    }
    return response.json();
  },
};
