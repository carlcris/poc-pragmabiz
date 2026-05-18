import type {
  Quotation,
  QuotationFilters,
  CreateQuotationRequest,
  UpdateQuotationRequest,
  QuotationLineItem,
} from "@/types/quotation";
import { apiClient } from "@/lib/api";

export type QuotationsResponse = {
  data: Quotation[];
  pagination: {
    total: number;
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export type ConfirmQuotationResponse = {
  success: boolean;
  quotationId: string;
  status: string;
};

export type AvailableQuotationLine = QuotationLineItem & {
  quotationId: string;
  quotationNumber: string;
  quotationItemId: string;
  quotationQuantity: number;
  quotationOrderedQuantity: number;
  quotationRemainingQuantity: number;
};

export type AvailableQuotationLinesResponse = {
  data: AvailableQuotationLine[];
  pagination: {
    page: number;
    limit: number;
    hasMore: boolean;
  };
};

export const quotationsApi = {
  async getQuotations(filters?: QuotationFilters): Promise<QuotationsResponse> {
    const params: Record<string, string | number | undefined> = {};

    if (filters?.search) params.search = filters.search;
    if (filters?.status && filters.status !== "all") params.status = filters.status;
    if (filters?.customerId) params.customerId = filters.customerId;
    if (filters?.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters?.dateTo) params.dateTo = filters.dateTo;
    if (filters?.cursor) params.cursor = filters.cursor;
    if (filters?.limit) params.limit = filters.limit;

    return apiClient.get<QuotationsResponse>("/api/quotations", { params });
  },

  async getQuotation(id: string): Promise<Quotation> {
    return apiClient.get<Quotation>(`/api/quotations/${id}`);
  },

  async getAvailableLines(filters: {
    customerId: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<AvailableQuotationLinesResponse> {
    const params: Record<string, string | number | undefined> = {
      customerId: filters.customerId,
      search: filters.search || undefined,
      page: filters.page,
      limit: filters.limit,
    };

    return apiClient.get<AvailableQuotationLinesResponse>("/api/quotations/available-lines", {
      params,
    });
  },

  async createQuotation(data: CreateQuotationRequest): Promise<Quotation> {
    return apiClient.post<Quotation>("/api/quotations", data);
  },

  async updateQuotation(id: string, data: UpdateQuotationRequest): Promise<Quotation> {
    return apiClient.put<Quotation>(`/api/quotations/${id}`, data);
  },

  async deleteQuotation(id: string): Promise<void> {
    return apiClient.delete<void>(`/api/quotations/${id}`);
  },

  async changeStatus(id: string, status: string): Promise<Quotation> {
    return apiClient.patch<Quotation>(`/api/quotations/${id}/status`, { status });
  },

  async confirm(id: string, warehouseId?: string | null): Promise<ConfirmQuotationResponse> {
    return apiClient.post<ConfirmQuotationResponse>(`/api/quotations/${id}/confirm`, {
      warehouseId,
    });
  },
};
