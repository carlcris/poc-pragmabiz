import type {
  Quotation,
  QuotationFilters,
  CreateQuotationRequest,
  UpdateQuotationRequest,
} from "@/types/quotation";
import { apiClient } from "@/lib/api";

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
    const params: Record<string, string | number | undefined> = {};

    if (filters?.search) params.search = filters.search;
    if (filters?.status && filters.status !== "all") params.status = filters.status;
    if (filters?.customerId) params.customerId = filters.customerId;
    if (filters?.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters?.dateTo) params.dateTo = filters.dateTo;
    if (filters?.page) params.page = filters.page;
    if (filters?.limit) params.limit = filters.limit;

    return apiClient.get<QuotationsResponse>("/api/quotations", { params });
  },

  async getQuotation(id: string): Promise<Quotation> {
    return apiClient.get<Quotation>(`/api/quotations/${id}`);
  },

  async createQuotation(data: CreateQuotationRequest): Promise<Quotation> {
    return apiClient.post<Quotation>("/api/quotations", data);
  },

  async updateQuotation(
    id: string,
    data: UpdateQuotationRequest
  ): Promise<Quotation> {
    return apiClient.put<Quotation>(`/api/quotations/${id}`, data);
  },

  async deleteQuotation(id: string): Promise<void> {
    return apiClient.delete<void>(`/api/quotations/${id}`);
  },

  async convertToOrder(id: string): Promise<{ success: boolean; message: string; salesOrder: { id: string; orderNumber: string } }> {
    return apiClient.post<{ success: boolean; message: string; salesOrder: { id: string; orderNumber: string } }>(`/api/quotations/${id}/convert-to-sales-order`, {});
  },

  async changeStatus(id: string, status: string): Promise<Quotation> {
    return apiClient.patch<Quotation>(`/api/quotations/${id}/status`, { status });
  },
};
