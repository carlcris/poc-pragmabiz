import { apiClient } from '@/lib/api';
import type {
  TransformationTemplate,
  TransformationTemplateFilters,
  TransformationTemplateListResponse,
  CreateTransformationTemplateRequest,
  UpdateTransformationTemplateRequest,
} from '@/types/transformation-template';

export const transformationTemplatesApi = {
  /**
   * Get list of transformation templates
   */
  async list(params?: TransformationTemplateFilters): Promise<TransformationTemplateListResponse> {
    const searchParams = new URLSearchParams();

    if (params?.search) searchParams.append('search', params.search);
    if (params?.isActive !== undefined) searchParams.append('isActive', params.isActive.toString());
    if (params?.itemId) searchParams.append('itemId', params.itemId);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());

    const url = `/api/transformations/templates${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return apiClient.get<TransformationTemplateListResponse>(url);
  },

  /**
   * Get single transformation template by ID
   */
  async getById(id: string): Promise<{ data: TransformationTemplate }> {
    return apiClient.get<{ data: TransformationTemplate }>(`/api/transformations/templates/${id}`);
  },

  /**
   * Create new transformation template
   */
  async create(data: CreateTransformationTemplateRequest): Promise<{ data: TransformationTemplate }> {
    return apiClient.post<{ data: TransformationTemplate }>('/api/transformations/templates', data);
  },

  /**
   * Update transformation template (limited fields)
   * Only name, description, and isActive can be updated
   * Structural changes blocked if template is used (usage_count > 0)
   */
  async update(
    id: string,
    data: UpdateTransformationTemplateRequest
  ): Promise<{ data: TransformationTemplate }> {
    return apiClient.patch<{ data: TransformationTemplate }>(
      `/api/transformations/templates/${id}`,
      data
    );
  },

  /**
   * Delete transformation template (only if not used)
   * Soft delete - only allowed if usage_count === 0
   */
  async delete(id: string): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>(`/api/transformations/templates/${id}`);
  },

  /**
   * Deactivate transformation template
   * Sets isActive = false
   */
  async deactivate(id: string): Promise<{ data: TransformationTemplate }> {
    return apiClient.patch<{ data: TransformationTemplate }>(
      `/api/transformations/templates/${id}`,
      { isActive: false }
    );
  },

  /**
   * Activate transformation template
   * Sets isActive = true
   */
  async activate(id: string): Promise<{ data: TransformationTemplate }> {
    return apiClient.patch<{ data: TransformationTemplate }>(
      `/api/transformations/templates/${id}`,
      { isActive: true }
    );
  },
};
