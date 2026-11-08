import { apiClient } from "@/lib/api";
import type { ItemCategoriesResponse, ItemCategoryFilters } from "@/types/item-category";

export const itemCategoriesApi = {
  getCategories: (filters: ItemCategoryFilters = {}): Promise<ItemCategoriesResponse> => {
    const params = new URLSearchParams({
      page: String(filters.page ?? 1),
      limit: String(filters.limit ?? 5),
    });
    if (filters.search) params.set("search", filters.search);
    return apiClient.get<ItemCategoriesResponse>(`/api/item-categories?${params}`);
  },
};
