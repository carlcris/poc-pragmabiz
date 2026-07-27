import { apiClient } from "@/lib/api";
import type { TransformationAdditionalOutputItemListResponse } from "@/types/transformation-template";

export type TransformationAdditionalOutputItemFilters = {
  search?: string;
  page?: number;
  limit?: number;
  excludedItemIds?: string[];
};

export const transformationAdditionalOutputItemsApi = {
  async list(
    filters: TransformationAdditionalOutputItemFilters = {}
  ): Promise<TransformationAdditionalOutputItemListResponse> {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.page) params.set("page", String(filters.page));
    if (filters.limit) params.set("limit", String(filters.limit));
    filters.excludedItemIds?.forEach((itemId) => params.append("excludedItemId", itemId));

    return apiClient.get<TransformationAdditionalOutputItemListResponse>(
      `/api/transformations/additional-output-items?${params.toString()}`
    );
  },
};
