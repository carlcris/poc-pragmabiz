import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { ITEMS_QUERY_KEY } from "@/hooks/queryKeys";
import { useAuthStore } from "@/stores/authStore";
import type { ReportItemOptionsResponse } from "@/types/report-item-options";

const ITEM_OPTIONS_PAGE_SIZE = 6;
const ITEM_OPTIONS_SEARCH_MAX_LENGTH = 100;

/**
 * Pages the shared report item filter: six items per request, search and
 * ordering owned by the shared report item catalog endpoint, and later pages
 * appended when the person scrolls the combobox. Keyed under `ITEMS_QUERY_KEY`
 * so the existing item mutation invalidation refreshes these options without a
 * bespoke cache family.
 */
export function useReportItemOptions({
  search = "",
  enabled = true,
}: { search?: string; enabled?: boolean } = {}) {
  const companyId = useAuthStore((state) => state.user?.companyId);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // The endpoint rejects a longer term, so the request is bounded here rather
  // than failing the first page on a pasted search.
  const normalizedSearch = search.trim().slice(0, ITEM_OPTIONS_SEARCH_MAX_LENGTH);
  return useInfiniteQuery({
    queryKey: [ITEMS_QUERY_KEY, "report-item-options", companyId, normalizedSearch],
    queryFn: ({ pageParam, signal }) =>
      apiClient.get<ReportItemOptionsResponse>("/api/reports/item-options", {
        params: {
          page: pageParam,
          limit: ITEM_OPTIONS_PAGE_SIZE,
          search: normalizedSearch || undefined,
        },
        signal,
      }),
    initialPageParam: 1,
    // The response reports only whether another page exists, so the next page
    // number comes from the page that was just requested.
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.hasMore ? lastPageParam + 1 : undefined,
    enabled: enabled && isAuthenticated && Boolean(companyId),
    staleTime: 5 * 60 * 1000,
  });
}
