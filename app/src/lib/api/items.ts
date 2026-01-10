import { apiClient } from "@/lib/api";
import type {
  ItemsListResponse,
  ItemResponse,
  CreateItemRequest,
  UpdateItemRequest,
  ItemFilters,
} from "@/types/item";

export const itemsApi = {
  getItems: async (filters?: ItemFilters): Promise<ItemsListResponse> => {
    const params = new URLSearchParams();

    if (filters?.search) params.append("search", filters.search);
    if (filters?.category) params.append("category", filters.category);
    if (filters?.itemType) params.append("itemType", filters.itemType);
    if (filters?.isActive !== undefined) params.append("isActive", String(filters.isActive));
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.limit) params.append("limit", String(filters.limit));

    const queryString = params.toString();
    const endpoint = `/api/items${queryString ? `?${queryString}` : ""}`;

    return apiClient.get<ItemsListResponse>(endpoint);
  },

  getItem: async (id: string): Promise<ItemResponse> => {
    return apiClient.get<ItemResponse>(`/api/items/${id}`);
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
