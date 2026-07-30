import { apiClient } from "@/lib/api";
import type { StockInTransitFilters, StockInTransitResponse } from "@/types/stock-in-transit";

export const stockInTransitApi = {
  list: (filters: StockInTransitFilters): Promise<StockInTransitResponse> =>
    apiClient.get<StockInTransitResponse>("/api/stock-in-transit", {
      params: {
        search: filters.search,
        page: filters.page,
        limit: filters.limit,
      },
    }),
};
