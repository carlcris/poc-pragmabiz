import { API_BASE_URL, apiClient } from "@/lib/api";
import { isSessionInvalidStatus, notifySessionInvalid } from "@/lib/auth/sessionInvalidation";
import type {
  TransformationTemplateApi,
  TransformationTemplateFilters,
  TransformationTemplateListResponse,
  CreateTransformationTemplateRequest,
  UpdateTransformationTemplateRequest,
  TransformationTemplateCopySource,
  TransformationTemplateCopySourceFilters,
  TransformationTemplateCopySourceListResponse,
  TransformationAdditionalOutputImage,
} from "@/types/transformation-template";

export const transformationTemplatesApi = {
  /**
   * Get list of transformation templates
   */
  async list(params?: TransformationTemplateFilters): Promise<TransformationTemplateListResponse> {
    const searchParams = new URLSearchParams();

    if (params?.search) searchParams.append("search", params.search);
    if (params?.isActive !== undefined) searchParams.append("isActive", params.isActive.toString());
    if (params?.itemId) searchParams.append("itemId", params.itemId);
    if (params?.page) searchParams.append("page", params.page.toString());
    if (params?.limit) searchParams.append("limit", params.limit.toString());

    const url = `/api/transformations/templates${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    return apiClient.get<TransformationTemplateListResponse>(url);
  },

  /**
   * Get single transformation template by ID
   */
  async getById(id: string, signal?: AbortSignal): Promise<{ data: TransformationTemplateApi }> {
    return apiClient.get<{ data: TransformationTemplateApi }>(
      `/api/transformations/templates/${id}`,
      { signal }
    );
  },

  async listCopySources(
    params: TransformationTemplateCopySourceFilters
  ): Promise<TransformationTemplateCopySourceListResponse> {
    const searchParams = new URLSearchParams({
      scope: params.scope,
      templateKind: params.templateKind,
      page: String(params.page ?? 1),
      limit: String(params.limit ?? 5),
    });
    if (params.search) searchParams.set("search", params.search);

    return apiClient.get<TransformationTemplateCopySourceListResponse>(
      `/api/transformations/templates/copy-sources?${searchParams.toString()}`
    );
  },

  async getCopySource(id: string): Promise<{ data: TransformationTemplateCopySource }> {
    return apiClient.get<{ data: TransformationTemplateCopySource }>(
      `/api/transformations/templates/copy-sources/${id}`
    );
  },

  async uploadAdditionalOutputImage(file: File): Promise<TransformationAdditionalOutputImage> {
    const body = new FormData();
    body.set("file", file);
    const response = await fetch(
      `${API_BASE_URL}/api/transformations/templates/additional-output-images`,
      {
        method: "POST",
        credentials: "include",
        body,
      }
    );

    if (!response.ok) {
      if (isSessionInvalidStatus(response.status)) {
        notifySessionInvalid({ status: response.status });
      }
      const cause: unknown =
        response.status === 413
          ? { code: "ADDITIONAL_OUTPUT_IMAGE_TOO_LARGE" }
          : await response.json().catch(() => null);
      throw new Error("Additional output image upload failed", { cause });
    }

    const { data }: { data: TransformationAdditionalOutputImage } = await response.json();
    return data;
  },

  /**
   * Create new transformation template
   */
  async create(
    data: CreateTransformationTemplateRequest
  ): Promise<{ data: TransformationTemplateApi }> {
    return apiClient.post<{ data: TransformationTemplateApi }>(
      "/api/transformations/templates",
      data
    );
  },

  /**
   * Update transformation template (limited fields)
   * Only name, description, and isActive can be updated
   * Structural changes blocked if template is used (usage_count > 0)
   */
  async update(
    id: string,
    data: UpdateTransformationTemplateRequest
  ): Promise<{ data: TransformationTemplateApi }> {
    return apiClient.patch<{ data: TransformationTemplateApi }>(
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
  async deactivate(id: string): Promise<{ data: TransformationTemplateApi }> {
    return apiClient.patch<{ data: TransformationTemplateApi }>(
      `/api/transformations/templates/${id}`,
      { isActive: false }
    );
  },

  /**
   * Activate transformation template
   * Sets isActive = true
   */
  async activate(id: string): Promise<{ data: TransformationTemplateApi }> {
    return apiClient.patch<{ data: TransformationTemplateApi }>(
      `/api/transformations/templates/${id}`,
      { isActive: true }
    );
  },
};
