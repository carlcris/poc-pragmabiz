import { apiClient } from "@/lib/api";
import type {
  StockAdjustment,
  StockAdjustmentListParams,
  StockAdjustmentListResponse,
  CreateStockAdjustmentRequest,
  UpdateStockAdjustmentRequest,
  PostStockAdjustmentRequest,
  PostStockAdjustmentResponse,
  SaveStockAdjustmentResponse,
} from "@/types/stock-adjustment";

export const stockAdjustmentsApi = {
  /**
   * Get list of stock adjustments
   */
  async list(params?: StockAdjustmentListParams): Promise<StockAdjustmentListResponse> {
    const searchParams = new URLSearchParams();

    if (params?.search) searchParams.append("search", params.search);
    if (params?.warehouseId) searchParams.append("warehouseId", params.warehouseId);
    if (params?.adjustmentType) searchParams.append("adjustmentType", params.adjustmentType);
    if (params?.status) searchParams.append("status", params.status);
    if (params?.startDate) searchParams.append("startDate", params.startDate);
    if (params?.endDate) searchParams.append("endDate", params.endDate);
    if (params?.page) searchParams.append("page", params.page.toString());
    if (params?.limit) searchParams.append("limit", params.limit.toString());

    const url = `/api/stock-adjustments${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    return apiClient.get<StockAdjustmentListResponse>(url);
  },

  /**
   * Get single stock adjustment by ID
   */
  async getById(id: string): Promise<StockAdjustment> {
    return apiClient.get<StockAdjustment>(`/api/stock-adjustments/${id}`);
  },

  /**
   * Create new stock adjustment
   */
  async create(data: CreateStockAdjustmentRequest): Promise<SaveStockAdjustmentResponse> {
    return apiClient.post<SaveStockAdjustmentResponse>("/api/stock-adjustments", data);
  },

  /**
   * Update stock adjustment (draft only)
   */
  async update(
    id: string,
    data: UpdateStockAdjustmentRequest
  ): Promise<SaveStockAdjustmentResponse> {
    return apiClient.patch<SaveStockAdjustmentResponse>(`/api/stock-adjustments/${id}`, data);
  },

  /**
   * Delete stock adjustment (draft only)
   */
  async delete(id: string): Promise<void> {
    return apiClient.delete(`/api/stock-adjustments/${id}`);
  },

  /**
   * Post/approve stock adjustment (creates stock transaction)
   */
  async post(id: string, data?: PostStockAdjustmentRequest): Promise<PostStockAdjustmentResponse> {
    return apiClient.post<PostStockAdjustmentResponse>(
      `/api/stock-adjustments/${id}/post`,
      data || {}
    );
  },
};
