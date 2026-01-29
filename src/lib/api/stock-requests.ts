import { apiClient } from "@/lib/api";
import type {
  StockRequest,
  StockRequestListParams,
  StockRequestListResponse,
  CreateStockRequestPayload,
  UpdateStockRequestPayload,
  ReceiveStockRequestPayload,
} from "@/types/stock-request";

export const stockRequestsApi = {
  /**
   * Get list of stock requests
   */
  async list(params?: StockRequestListParams): Promise<StockRequestListResponse> {
    const searchParams = new URLSearchParams();

    if (params?.search) searchParams.append("search", params.search);
    if (params?.fromLocationId) searchParams.append("fromLocationId", params.fromLocationId);
    if (params?.toLocationId) searchParams.append("toLocationId", params.toLocationId);
    if (params?.status) searchParams.append("status", params.status);
    if (params?.priority) searchParams.append("priority", params.priority);
    if (params?.startDate) searchParams.append("startDate", params.startDate);
    if (params?.endDate) searchParams.append("endDate", params.endDate);
    if (params?.page) searchParams.append("page", params.page.toString());
    if (params?.limit) searchParams.append("limit", params.limit.toString());

    const url = `/api/stock-requests${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    return apiClient.get<StockRequestListResponse>(url);
  },

  /**
   * Get single stock request by ID
   */
  async getById(id: string): Promise<StockRequest> {
    return apiClient.get<StockRequest>(`/api/stock-requests/${id}`);
  },

  /**
   * Create new stock request
   */
  async create(data: CreateStockRequestPayload): Promise<StockRequest> {
    return apiClient.post<StockRequest>("/api/stock-requests", data);
  },

  /**
   * Update stock request (draft only)
   */
  async update(id: string, data: UpdateStockRequestPayload): Promise<StockRequest> {
    return apiClient.patch<StockRequest>(`/api/stock-requests/${id}`, data);
  },

  /**
   * Delete stock request (draft only)
   */
  async delete(id: string): Promise<void> {
    return apiClient.delete(`/api/stock-requests/${id}`);
  },

  /**
   * Submit stock request for approval (draft → submitted)
   */
  async submit(id: string): Promise<StockRequest> {
    return apiClient.post<StockRequest>(`/api/stock-requests/${id}/submit`, {});
  },

  /**
   * Approve stock request (submitted → approved)
   */
  async approve(id: string): Promise<StockRequest> {
    return apiClient.post<StockRequest>(`/api/stock-requests/${id}/approve`, {});
  },

  /**
   * Reject stock request (submitted → cancelled)
   */
  async reject(id: string, reason?: string): Promise<StockRequest> {
    return apiClient.post<StockRequest>(`/api/stock-requests/${id}/reject`, { reason });
  },

  /**
   * Mark stock request as ready for picking (approved → ready_for_pick)
   */
  async markReadyForPick(id: string): Promise<StockRequest> {
    return apiClient.post<StockRequest>(`/api/stock-requests/${id}/ready-for-pick`, {});
  },

  /**
   * Mark stock request as delivered (ready_for_pick → delivered)
   */
  async markDelivered(id: string): Promise<StockRequest> {
    return apiClient.post<StockRequest>(`/api/stock-requests/${id}/picked`, {});
  },

  /**
   * Complete stock request (received → completed)
   */
  async complete(id: string): Promise<StockRequest> {
    return apiClient.post<StockRequest>(`/api/stock-requests/${id}/complete`, {});
  },

  /**
   * Cancel stock request (any status → cancelled)
   */
  async cancel(id: string, reason?: string): Promise<StockRequest> {
    return apiClient.post<StockRequest>(`/api/stock-requests/${id}/cancel`, { reason });
  },

  /**
   * Receive delivered stock request
   */
  async receive(id: string, data: ReceiveStockRequestPayload): Promise<StockRequest> {
    return apiClient.post<StockRequest>(`/api/stock-requests/${id}/receive`, data);
  },
};
