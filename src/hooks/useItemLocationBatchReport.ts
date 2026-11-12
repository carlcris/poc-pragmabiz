import type {
  ItemLocationGroupSubtotal,
  ItemLocationReportGroupBy,
} from "@/lib/reports/item-location-report-groups";
import type { Locale } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { ITEM_LOCATION_BATCH_REPORT_QUERY_KEY } from "@/hooks/queryKeys";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export type ItemLocationBatchReportFilters = {
  warehouseId?: string;
  itemId?: string;
  groupBy: ItemLocationReportGroupBy;
  includeEmptyBatches: boolean;
  locale: Locale;
  enabled?: boolean;
};

export type ItemLocationBatchReportRow = {
  id: string;
  itemId: string;
  itemCode: string | null;
  itemName: string | null;
  warehouseId: string;
  warehouseCode: string | null;
  warehouseName: string | null;
  locationId: string;
  locationCode: string | null;
  locationName: string | null;
  locationPath: string | null;
  itemBatchId: string;
  batchCode: string | null;
  batchReceivedAt: string | null;
  batchAgeDays: number | null;
  batchLocationSku: string | null;
  qtyOnHand: number;
  qtyReserved: number;
  qtyAvailable: number;
  updatedAt: string;
};

export type ItemLocationBatchReportResponse = {
  data: ItemLocationBatchReportRow[];
  groupSubtotals: Record<string, ItemLocationGroupSubtotal>;
  summary: {
    rowCount: number;
    totalRows: number;
    totalQtyOnHand: number;
    totalQtyReserved: number;
    totalQtyAvailable: number;
    uniqueItems: number;
    uniqueLocations: number;
    uniqueBatches: number;
    rowsWithReserved: number;
    zeroStockRows: number;
  };
  filters: {
    warehouseId: string | null;
    itemId: string | null;
    groupBy: ItemLocationReportGroupBy;
    includeEmptyBatches: boolean;
  };
};

export function useItemLocationBatchReport(filters: ItemLocationBatchReportFilters) {
  const { enabled = true, ...queryFilters } = filters;

  return useQuery<ItemLocationBatchReportResponse>({
    queryKey: [ITEM_LOCATION_BATCH_REPORT_QUERY_KEY, queryFilters],
    enabled,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (queryFilters.warehouseId) params.append("warehouseId", queryFilters.warehouseId);
      if (queryFilters.itemId) params.append("itemId", queryFilters.itemId);
      params.set("groupBy", queryFilters.groupBy);
      params.set("includeEmptyBatches", String(queryFilters.includeEmptyBatches));
      params.set("locale", queryFilters.locale);

      const response = await fetch(
        `${API_BASE_URL}/reports/item-location-batch?${params.toString()}`
      );
      if (!response.ok)
        throw new Error(
          response.status === 413
            ? "REPORT_TOO_LARGE"
            : response.status === 409
              ? "REPORT_INCOMPLETE"
              : "REPORT_LOAD_FAILED"
        );
      return response.json();
    },
    staleTime: 60_000,
  });
}
