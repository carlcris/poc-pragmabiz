import { useQuery } from "@tanstack/react-query";
import { itemCategoriesApi } from "@/lib/api/item-categories";
import { useAuthStore } from "@/stores/authStore";
import type { ItemCategoryFilters } from "@/types/item-category";

export function useItemCategories(filters: ItemCategoryFilters = {}) {
  const companyId = useAuthStore((state) => state.user?.companyId);
  const normalizedFilters = {
    search: filters.search?.trim() ?? "",
    page: filters.page ?? 1,
    limit: filters.limit ?? 5,
  };
  return useQuery({
    queryKey: ["item-categories", companyId, normalizedFilters],
    queryFn: () => itemCategoriesApi.getCategories(normalizedFilters),
    enabled: Boolean(companyId),
    staleTime: 5 * 60 * 1000,
  });
}
