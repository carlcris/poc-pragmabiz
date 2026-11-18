import { useInfiniteQuery } from "@tanstack/react-query";
import { itemCategoriesApi } from "@/lib/api/item-categories";
import { useAuthStore } from "@/stores/authStore";
import type { ItemCategoriesResponse, ItemCategoryFilters } from "@/types/item-category";

const CATEGORY_PAGE_SIZE = 6;

/**
 * Pages categories for every category consumer: the first request returns six
 * categories and the combobox appends the next page when the person scrolls to
 * the end, while callers that only need the first rows read `data.pages[0]`.
 * `CATEGORY_PAGE_SIZE` is the one page size for all of them, so appended pages
 * continue the first one without a gap. Search and ordering stay server-owned
 * and each request stays bounded.
 */
export function useItemCategories({
  search = "",
  limit = CATEGORY_PAGE_SIZE,
}: Pick<ItemCategoryFilters, "search" | "limit"> = {}) {
  const companyId = useAuthStore((state) => state.user?.companyId);
  const normalizedSearch = search.trim();
  return useInfiniteQuery({
    queryKey: ["item-categories", companyId, { search: normalizedSearch, limit }],
    queryFn: ({ pageParam }) =>
      itemCategoriesApi.getCategories({ search: normalizedSearch, page: pageParam, limit }),
    initialPageParam: 1,
    getNextPageParam: (lastPage: ItemCategoriesResponse) =>
      lastPage.pagination.page < lastPage.pagination.totalPages
        ? lastPage.pagination.page + 1
        : undefined,
    enabled: Boolean(companyId),
    staleTime: 5 * 60 * 1000,
  });
}
