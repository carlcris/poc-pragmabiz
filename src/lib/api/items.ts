import { apiClient } from "@/lib/api";
import type {
  ItemsListResponse,
  ItemResponse,
  CreateItemRequest,
  UpdateItemRequest,
  ItemFilters,
} from "@/types/item";

export type ItemBatchOption = {
  id: string;
  batchCode: string;
  receivedAt: string;
  qtyOnHand: number;
  qtyReserved: number;
  qtyAvailable: number;
};

export type ItemBatchOptionsResponse = {
  data: ItemBatchOption[];
  pagination: {
    total: number;
    limit: number;
  };
};

export const itemsApi = {
  getItems: async (filters?: ItemFilters): Promise<ItemsListResponse> => {
    const params = new URLSearchParams();

    if (filters?.search) params.append("search", filters.search);
    if (filters?.category) params.append("category", filters.category);
    if (filters?.itemType) params.append("itemType", filters.itemType);
    if (filters?.isActive !== undefined) params.append("isActive", String(filters.isActive));
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.limit) params.append("limit", String(filters.limit));
    params.append("includeStock", "false");

    const queryString = params.toString();
    const endpoint = `/api/items${queryString ? `?${queryString}` : ""}`;
    return apiClient.get<ItemsListResponse>(endpoint);
  },

  getItem: async (id: string): Promise<ItemResponse> => {
    return apiClient.get<ItemResponse>(`/api/items/${id}`);
  },

  getItemBatches: async (
    id: string,
    params: { warehouseId: string; search?: string; limit?: number }
  ): Promise<ItemBatchOptionsResponse> => {
    const searchParams = new URLSearchParams();
    searchParams.append("warehouseId", params.warehouseId);
    if (params.search) searchParams.append("search", params.search);
    if (params.limit) searchParams.append("limit", String(params.limit));

    return apiClient.get<ItemBatchOptionsResponse>(
      `/api/items/${id}/batches?${searchParams.toString()}`
    );
  },

  createItem: async (data: CreateItemRequest): Promise<ItemResponse> => {
    return apiClient.post<ItemResponse>("/api/items", data);
  },

  updateItem: async (id: string, data: UpdateItemRequest): Promise<ItemResponse> => {
    return apiClient.put<ItemResponse>(`/api/items/${id}`, data);
  },

  deleteItem: async (id: string): Promise<{ message: string }> => {
    return apiClient.delete<{ message: string }>(`/api/items/${id}`);
  },
};
