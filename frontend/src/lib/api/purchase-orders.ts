import type {
  PurchaseOrder,
  CreatePurchaseOrderRequest,
  UpdatePurchaseOrderRequest,
  PurchaseOrderFilters,
  PurchaseOrdersResponse,
} from "@/types/purchase-order";

const API_BASE = "/api/purchase-orders";

export const purchaseOrdersApi = {
  getPurchaseOrders: async (filters?: PurchaseOrderFilters): Promise<PurchaseOrdersResponse> => {
    const params = new URLSearchParams();
    if (filters?.search) params.append("search", filters.search);
    if (filters?.status && filters.status !== "all") params.append("status", filters.status);
    if (filters?.supplierId) params.append("supplierId", filters.supplierId);
    if (filters?.dateFrom) params.append("dateFrom", filters.dateFrom);
    if (filters?.dateTo) params.append("dateTo", filters.dateTo);
    if (filters?.page) params.append("page", filters.page.toString());
    if (filters?.limit) params.append("limit", filters.limit.toString());

    const response = await fetch(`${API_BASE}?${params.toString()}`);
    if (!response.ok) throw new Error("Failed to fetch purchase orders");
    return response.json();
  },

  getPurchaseOrder: async (id: string): Promise<PurchaseOrder> => {
    const response = await fetch(`${API_BASE}/${id}`);
    if (!response.ok) throw new Error("Failed to fetch purchase order");
    return response.json();
  },

  createPurchaseOrder: async (data: CreatePurchaseOrderRequest): Promise<PurchaseOrder> => {
    const response = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to create purchase order");
    return response.json();
  },

  updatePurchaseOrder: async (id: string, data: UpdatePurchaseOrderRequest): Promise<PurchaseOrder> => {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to update purchase order");
    return response.json();
  },

  deletePurchaseOrder: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete purchase order");
  },
};
