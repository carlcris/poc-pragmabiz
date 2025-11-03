import type {
  Warehouse,
  CreateWarehouseRequest,
  UpdateWarehouseRequest,
  WarehouseFilters,
  WarehouseListResponse,
} from "@/types/warehouse";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export const warehousesApi = {
  async getWarehouses(filters?: WarehouseFilters): Promise<WarehouseListResponse> {
    const params = new URLSearchParams();
    if (filters?.search) params.append("search", filters.search);
    if (filters?.isActive !== undefined) params.append("isActive", String(filters.isActive));
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.limit) params.append("limit", String(filters.limit));

    const response = await fetch(`${API_BASE_URL}/warehouses?${params.toString()}`);
    if (!response.ok) throw new Error("Failed to fetch warehouses");
    return response.json();
  },

  async getWarehouse(id: string): Promise<Warehouse> {
    const response = await fetch(`${API_BASE_URL}/warehouses/${id}`);
    if (!response.ok) throw new Error("Failed to fetch warehouse");
    return response.json();
  },

  async createWarehouse(data: CreateWarehouseRequest): Promise<Warehouse> {
    const response = await fetch(`${API_BASE_URL}/warehouses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to create warehouse");
    return response.json();
  },

  async updateWarehouse(id: string, data: UpdateWarehouseRequest): Promise<Warehouse> {
    const response = await fetch(`${API_BASE_URL}/warehouses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to update warehouse");
    return response.json();
  },

  async deleteWarehouse(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/warehouses/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete warehouse");
  },
};
