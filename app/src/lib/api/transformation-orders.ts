import { apiClient } from '@/lib/api';
import type {
  TransformationOrder,
  TransformationOrderFilters,
  TransformationOrderListResponse,
  CreateTransformationOrderRequest,
  UpdateTransformationOrderRequest,
  ExecuteTransformationOrderRequest,
} from '@/types/transformation-order';

export const transformationOrdersApi = {
  /**
   * Get list of transformation orders
   */
  async list(params?: TransformationOrderFilters): Promise<TransformationOrderListResponse> {
    const searchParams = new URLSearchParams();

    if (params?.search) searchParams.append('search', params.search);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.templateId) searchParams.append('templateId', params.templateId);
    if (params?.warehouseId) searchParams.append('warehouseId', params.warehouseId);
    if (params?.itemId) searchParams.append('itemId', params.itemId);
    if (params?.dateFrom) searchParams.append('dateFrom', params.dateFrom);
    if (params?.dateTo) searchParams.append('dateTo', params.dateTo);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());

    const url = `/api/transformations/orders${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return apiClient.get<TransformationOrderListResponse>(url);
  },

  /**
   * Get single transformation order by ID
   */
  async getById(id: string): Promise<{ data: TransformationOrder }> {
    return apiClient.get<{ data: TransformationOrder }>(`/api/transformations/orders/${id}`);
  },

  /**
   * Create new transformation order from template
   */
  async create(data: CreateTransformationOrderRequest): Promise<{ data: TransformationOrder }> {
    return apiClient.post<{ data: TransformationOrder }>('/api/transformations/orders', data);
  },

  /**
   * Update transformation order (DRAFT only)
   */
  async update(
    id: string,
    data: UpdateTransformationOrderRequest
  ): Promise<{ data: TransformationOrder }> {
    return apiClient.patch<{ data: TransformationOrder }>(`/api/transformations/orders/${id}`, data);
  },

  /**
   * Delete transformation order (DRAFT only)
   */
  async delete(id: string): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>(`/api/transformations/orders/${id}`);
  },

  /**
   * Prepare order (DRAFT → PREPARING)
   * Validates template and stock availability
   */
  async prepare(id: string): Promise<{ data: TransformationOrder; message: string }> {
    return apiClient.post<{ data: TransformationOrder; message: string }>(
      `/api/transformations/orders/${id}/release`,
      {}
    );
  },

  /**
   * @deprecated Use prepare() instead
   * Release order (DRAFT → PREPARING)
   * Validates template and stock availability
   */
  async release(id: string): Promise<{ data: TransformationOrder; message: string }> {
    return this.prepare(id);
  },

  /**
   * Execute transformation (PREPARING → COMPLETED)
   * Consumes inputs, produces outputs, records lineage
   */
  async execute(
    id: string,
    data: ExecuteTransformationOrderRequest
  ): Promise<{
    data: TransformationOrder;
    message: string;
    stockTransactions?: { inputs: string[]; outputs: string[] };
  }> {
    return apiClient.post<{
      data: TransformationOrder;
      message: string;
      stockTransactions?: { inputs: string[]; outputs: string[] };
    }>(`/api/transformations/orders/${id}/execute`, data);
  },

  /**
   * Cancel order (DRAFT or PREPARING → CANCELLED)
   */
  async cancel(id: string): Promise<{ data: TransformationOrder; message: string }> {
    return apiClient.post<{ data: TransformationOrder; message: string }>(
      `/api/transformations/orders/${id}/cancel`,
      {}
    );
  },
};
