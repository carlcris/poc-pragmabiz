import type {
  Quotation,
  QuotationFilters,
  CreateQuotationRequest,
  UpdateQuotationRequest,
} from "@/types/quotation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export interface QuotationsResponse {
  data: Quotation[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const quotationsApi = {
  async getQuotations(filters?: QuotationFilters): Promise<QuotationsResponse> {
    const params = new URLSearchParams();

    if (filters?.search) params.append("search", filters.search);
    if (filters?.status && filters.status !== "all") params.append("status", filters.status);
    if (filters?.customerId) params.append("customerId", filters.customerId);
    if (filters?.dateFrom) params.append("dateFrom", filters.dateFrom);
    if (filters?.dateTo) params.append("dateTo", filters.dateTo);
    if (filters?.page) params.append("page", filters.page.toString());
    if (filters?.limit) params.append("limit", filters.limit.toString());

    const response = await fetch(`${API_BASE_URL}/quotations?${params.toString()}`);
    if (!response.ok) throw new Error("Failed to fetch quotations");
    return response.json();
  },

  async getQuotation(id: string): Promise<Quotation> {
    const response = await fetch(`${API_BASE_URL}/quotations/${id}`);
    if (!response.ok) throw new Error("Failed to fetch quotation");
    return response.json();
  },

  async createQuotation(data: CreateQuotationRequest): Promise<Quotation> {
    const response = await fetch(`${API_BASE_URL}/quotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      console.error("Create quotation failed:", { status: response.status, error, data });
      throw new Error(error.error || `Failed to create quotation (${response.status})`);
    }
    return response.json();
  },

  async updateQuotation(
    id: string,
    data: UpdateQuotationRequest
  ): Promise<Quotation> {
    const response = await fetch(`${API_BASE_URL}/quotations/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to update quotation");
    return response.json();
  },

  async deleteQuotation(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/quotations/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete quotation");
  },

  async convertToOrder(id: string): Promise<{ success: boolean; message: string; salesOrder: { id: string; orderNumber: string } }> {
    const response = await fetch(`${API_BASE_URL}/quotations/${id}/convert-to-sales-order`, {
      method: "POST",
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to convert quotation" }));
      throw new Error(error.error || "Failed to convert quotation to sales order");
    }
    return response.json();
  },

  async changeStatus(id: string, status: string): Promise<Quotation> {
    const response = await fetch(`${API_BASE_URL}/quotations/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to change status" }));
      throw new Error(error.error || "Failed to change quotation status");
    }
    return response.json();
  },
};
