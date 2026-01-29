import type {
  Supplier,
  CreateSupplierRequest,
  UpdateSupplierRequest,
  SupplierFilters,
  SuppliersResponse,
} from "@/types/supplier";

const API_BASE = "/api/suppliers";

export const suppliersApi = {
  getSuppliers: async (filters?: SupplierFilters): Promise<SuppliersResponse> => {
    const params = new URLSearchParams();
    if (filters?.search) params.append("search", filters.search);
    if (filters?.status && filters.status !== "all") params.append("status", filters.status);
    if (filters?.page) params.append("page", filters.page.toString());
    if (filters?.limit) params.append("limit", filters.limit.toString());

    const response = await fetch(`${API_BASE}?${params.toString()}`);
    if (!response.ok) throw new Error("Failed to fetch suppliers");
    return response.json();
  },

  getSupplier: async (id: string): Promise<Supplier> => {
    const response = await fetch(`${API_BASE}/${id}`);
    if (!response.ok) throw new Error("Failed to fetch supplier");
    return response.json();
  },

  createSupplier: async (data: CreateSupplierRequest): Promise<Supplier> => {
    const response = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to create supplier");
    return response.json();
  },

  updateSupplier: async (id: string, data: UpdateSupplierRequest): Promise<Supplier> => {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to update supplier");
    return response.json();
  },

  deleteSupplier: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete supplier");
  },
};
