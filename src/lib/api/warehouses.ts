import { apiClient } from "@/lib/api";
import type {
  Warehouse,
  CreateWarehouseRequest,
  UpdateWarehouseRequest,
  WarehouseFilters,
  WarehouseListResponse,
} from "@/types/warehouse";

export const warehousesApi = {
  getWarehouses: async (filters?: WarehouseFilters): Promise<WarehouseListResponse> => {
    const params = new URLSearchParams();

    if (filters?.search) params.append("search", filters.search);
    if (filters?.isActive !== undefined) params.append("isActive", String(filters.isActive));
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.limit) params.append("limit", String(filters.limit));

    const queryString = params.toString();
    const endpoint = `/api/warehouses${queryString ? `?${queryString}` : ""}`;

    return apiClient.get<WarehouseListResponse>(endpoint);
  },

  getWarehouse: async (id: string): Promise<{ data: Warehouse }> => {
    return apiClient.get<{ data: Warehouse }>(`/api/warehouses/${id}`);
  },

  createWarehouse: async (data: CreateWarehouseRequest): Promise<{ data: Warehouse }> => {
    return apiClient.post<{ data: Warehouse }>("/api/warehouses", data);
  },

  updateWarehouse: async (
    id: string,
    data: UpdateWarehouseRequest
  ): Promise<{ data: Warehouse }> => {
    return apiClient.put<{ data: Warehouse }>(`/api/warehouses/${id}`, data);
  },

  deleteWarehouse: async (id: string): Promise<{ message: string }> => {
    return apiClient.delete<{ message: string }>(`/api/warehouses/${id}`);
  },
};
