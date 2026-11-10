import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { EXPIRED_BATCHES_REPORT_QUERY_KEY } from "@/hooks/queryKeys";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import type { ExpiredBatchesFilters, ExpiredBatchesResponse } from "@/types/expired-batches-report";

export const fetchExpiredBatchesReport = (filters: ExpiredBatchesFilters) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value !== undefined && value !== "") params.set(key, String(value));
  return apiClient.get<ExpiredBatchesResponse>(`/api/reports/expired-batches?${params.toString()}`);
};
export function useExpiredBatchesReport(filters: ExpiredBatchesFilters, enabled = true) {
  const businessUnitId = useBusinessUnitStore((state) => state.currentBusinessUnit?.id);
  return useQuery({
    queryKey: [EXPIRED_BATCHES_REPORT_QUERY_KEY, businessUnitId, filters],
    queryFn: () => fetchExpiredBatchesReport(filters),
    enabled,
  });
}
