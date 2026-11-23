import { apiClient } from "@/lib/api";
import type {
  StockInTransitItemArrivalFilters,
  StockInTransitItemArrivalsResponse,
  StockInTransitItemFilters,
  StockInTransitItemsResponse,
} from "@/types/stock-in-transit";

export const stockInTransitApi = {
  listItems: (filters: StockInTransitItemFilters, signal?: AbortSignal) =>
    apiClient.get<StockInTransitItemsResponse>("/api/stock-in-transit", {
      params: { view: "items", ...filters },
      signal,
    }),
  listItemArrivals: (filters: StockInTransitItemArrivalFilters, signal?: AbortSignal) =>
    apiClient.get<StockInTransitItemArrivalsResponse>("/api/stock-in-transit", {
      params: { view: "arrivals", ...filters },
      signal,
    }),
};
