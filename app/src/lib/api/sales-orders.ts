import type {
  SalesOrder,
  SalesOrderFilters,
  CreateSalesOrderRequest,
  UpdateSalesOrderRequest,
  SalesOrderPaymentSummary,
} from "@/types/sales-order";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export interface SalesOrdersResponse {
  data: SalesOrder[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const salesOrdersApi = {
  async getSalesOrders(filters?: SalesOrderFilters): Promise<SalesOrdersResponse> {
    const params = new URLSearchParams();

    if (filters?.search) params.append("search", filters.search);
    if (filters?.status && filters.status !== "all") params.append("status", filters.status);
    if (filters?.customerId) params.append("customerId", filters.customerId);
    if (filters?.dateFrom) params.append("dateFrom", filters.dateFrom);
    if (filters?.dateTo) params.append("dateTo", filters.dateTo);
    if (filters?.page) params.append("page", filters.page.toString());
    if (filters?.limit) params.append("limit", filters.limit.toString());

    const response = await fetch(`${API_BASE_URL}/sales-orders?${params.toString()}`);
    if (!response.ok) throw new Error("Failed to fetch sales orders");
    return response.json();
  },

  async getSalesOrder(id: string): Promise<SalesOrder> {
    const response = await fetch(`${API_BASE_URL}/sales-orders/${id}`);
    if (!response.ok) throw new Error("Failed to fetch sales order");
    return response.json();
  },

  async createSalesOrder(data: CreateSalesOrderRequest): Promise<SalesOrder> {
    const response = await fetch(`${API_BASE_URL}/sales-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to create sales order");
    return response.json();
  },

  async updateSalesOrder(
    id: string,
    data: UpdateSalesOrderRequest
  ): Promise<SalesOrder> {
    const response = await fetch(`${API_BASE_URL}/sales-orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to update sales order");
    return response.json();
  },

  async deleteSalesOrder(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/sales-orders/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete sales order");
  },

  async confirmOrder(id: string): Promise<SalesOrder> {
    const response = await fetch(`${API_BASE_URL}/sales-orders/${id}/confirm`, {
      method: "POST",
    });
    if (!response.ok) throw new Error("Failed to confirm sales order");
    return response.json();
  },

  async shipOrder(id: string): Promise<SalesOrder> {
    const response = await fetch(`${API_BASE_URL}/sales-orders/${id}/ship`, {
      method: "POST",
    });
    if (!response.ok) throw new Error("Failed to ship sales order");
    return response.json();
  },

  async deliverOrder(id: string): Promise<SalesOrder> {
    const response = await fetch(`${API_BASE_URL}/sales-orders/${id}/deliver`, {
      method: "POST",
    });
    if (!response.ok) throw new Error("Failed to deliver sales order");
    return response.json();
  },

  async cancelOrder(id: string): Promise<SalesOrder> {
    const response = await fetch(`${API_BASE_URL}/sales-orders/${id}/cancel`, {
      method: "POST",
    });
    if (!response.ok) throw new Error("Failed to cancel sales order");
    return response.json();
  },

  async convertToInvoice(id: string, warehouseId: string): Promise<{ success: boolean; message: string; invoice: { id: string; invoiceNumber: string } }> {
    const response = await fetch(`${API_BASE_URL}/sales-orders/${id}/convert-to-invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ warehouseId }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to convert to invoice" }));
      throw new Error(error.error || "Failed to convert sales order to invoice");
    }
    return response.json();
  },

  async getPaymentSummary(id: string): Promise<SalesOrderPaymentSummary> {
    const response = await fetch(`${API_BASE_URL}/sales-orders/${id}/payment-summary`);
    if (!response.ok) throw new Error("Failed to fetch payment summary");
    return response.json();
  },
};
