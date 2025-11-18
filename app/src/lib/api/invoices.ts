import type {
  Invoice,
  InvoiceFilters,
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
  RecordPaymentRequest,
  InvoicePayment,
} from "@/types/invoice";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export interface InvoicesResponse {
  data: Invoice[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const invoicesApi = {
  async getInvoices(filters?: InvoiceFilters): Promise<InvoicesResponse> {
    const params = new URLSearchParams();

    if (filters?.search) params.append("search", filters.search);
    if (filters?.status && filters.status !== "all") params.append("status", filters.status);
    if (filters?.customerId) params.append("customerId", filters.customerId);
    if (filters?.dateFrom) params.append("dateFrom", filters.dateFrom);
    if (filters?.dateTo) params.append("dateTo", filters.dateTo);
    if (filters?.page) params.append("page", filters.page.toString());
    if (filters?.limit) params.append("limit", filters.limit.toString());

    const response = await fetch(`${API_BASE_URL}/invoices?${params.toString()}`);
    if (!response.ok) throw new Error("Failed to fetch invoices");
    return response.json();
  },

  async getInvoice(id: string): Promise<Invoice> {
    const response = await fetch(`${API_BASE_URL}/invoices/${id}`);
    if (!response.ok) throw new Error("Failed to fetch invoice");
    return response.json();
  },

  async createInvoice(data: CreateInvoiceRequest): Promise<Invoice> {
    const response = await fetch(`${API_BASE_URL}/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to create invoice");
    return response.json();
  },

  async updateInvoice(
    id: string,
    data: UpdateInvoiceRequest
  ): Promise<Invoice> {
    const response = await fetch(`${API_BASE_URL}/invoices/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to update invoice");
    return response.json();
  },

  async deleteInvoice(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/invoices/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete invoice");
  },

  async sendInvoice(id: string): Promise<Invoice> {
    const response = await fetch(`${API_BASE_URL}/invoices/${id}/send`, {
      method: "POST",
    });
    if (!response.ok) throw new Error("Failed to send invoice");
    return response.json();
  },

  async getPayments(invoiceId: string): Promise<{ data: InvoicePayment[] }> {
    const response = await fetch(`${API_BASE_URL}/invoices/${invoiceId}/payments`);
    if (!response.ok) throw new Error("Failed to fetch payments");
    return response.json();
  },

  async recordPayment(data: RecordPaymentRequest): Promise<Invoice> {
    const response = await fetch(`${API_BASE_URL}/invoices/${data.invoiceId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to record payment");
    return response.json();
  },

  async cancelInvoice(id: string): Promise<Invoice> {
    const response = await fetch(`${API_BASE_URL}/invoices/${id}/cancel`, {
      method: "POST",
    });
    if (!response.ok) throw new Error("Failed to cancel invoice");
    return response.json();
  },
};
