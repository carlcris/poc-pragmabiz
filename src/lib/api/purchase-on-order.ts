import { apiClient } from "@/lib/api";
import type { PurchaseOnOrderFilters, PurchaseOnOrderResponse } from "@/types/purchase-on-order";

const API_BASE = "/api/purchasing/on-order";

export const purchaseOnOrderApi = {
  getOnOrderItems: async (
    filters?: PurchaseOnOrderFilters
  ): Promise<PurchaseOnOrderResponse> => {
    const params = new URLSearchParams();
    if (filters?.search) params.append("search", filters.search);
    if (filters?.supplierId) params.append("supplierId", filters.supplierId);
    if (filters?.status && filters.status !== "all") params.append("status", filters.status);
    if (filters?.expectedFrom) params.append("expectedFrom", filters.expectedFrom);
    if (filters?.expectedTo) params.append("expectedTo", filters.expectedTo);
    if (filters?.page) params.append("page", filters.page.toString());
    if (filters?.limit) params.append("limit", filters.limit.toString());

    return apiClient.get<PurchaseOnOrderResponse>(`${API_BASE}?${params.toString()}`);
  },
};
