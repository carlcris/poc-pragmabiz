import { useQuery } from "@tanstack/react-query";
import type { ItemWithStock } from "@/app/api/items-enhanced/route";

export interface ItemsEnhancedFilters {
  search?: string;
  category?: string;
  warehouseId?: string;
  supplierId?: string;
  status?: "all" | "normal" | "low_stock" | "out_of_stock" | "overstock" | "discontinued";
  itemType?: string;
  includeStats?: boolean;
  page?: number;
  limit?: number;
}

export interface ItemsEnhancedResponse {
  data: ItemWithStock[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  statistics?: {
    totalAvailableValue: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
}

export function useItemsEnhanced(filters?: ItemsEnhancedFilters) {
  return useQuery<ItemsEnhancedResponse>({
    queryKey: ["items-enhanced", filters],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters?.search) params.append("search", filters.search);
      if (filters?.category) params.append("category", filters.category);
      if (filters?.warehouseId) params.append("warehouseId", filters.warehouseId);
      if (filters?.supplierId) params.append("supplierId", filters.supplierId);
      if (filters?.status && filters.status !== "all") params.append("status", filters.status);
      if (filters?.itemType) params.append("itemType", filters.itemType);
      if (filters?.includeStats) params.append("includeStats", "true");
      if (filters?.page) params.append("page", filters.page.toString());
      if (filters?.limit) params.append("limit", filters.limit.toString());

      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";
      const response = await fetch(`${API_BASE_URL}/items-enhanced?${params.toString()}`, {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to fetch enhanced items");
      }

      return response.json();
    },
    staleTime: 1000 * 30, // 30 seconds
  });
}
