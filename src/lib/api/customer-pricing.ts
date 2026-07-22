import { apiClient } from "@/lib/api";
import type {
  CreateCustomerItemPriceRequest,
  CustomerItemPrice,
  CustomerItemPriceFilters,
  CustomerItemPriceListResponse,
  ResolveCustomerPricingRequest,
  ResolveCustomerPricingResponse,
  UpdateCustomerItemPriceRequest,
} from "@/types/customer-pricing";

export const customerPricingApi = {
  getCustomerPrices: async (
    customerId: string,
    filters?: CustomerItemPriceFilters
  ): Promise<CustomerItemPriceListResponse> => {
    const params = new URLSearchParams();
    if (filters?.search) params.set("search", filters.search);
    if (filters?.priceTier) params.set("priceTier", filters.priceTier);
    if (filters?.status && filters.status !== "all") params.set("status", filters.status);
    if (filters?.page) params.set("page", String(filters.page));
    if (filters?.limit) params.set("limit", String(filters.limit));
    const query = params.toString();

    return apiClient.get<CustomerItemPriceListResponse>(
      `/api/customers/${customerId}/special-prices${query ? `?${query}` : ""}`
    );
  },

  createCustomerPrice: async (
    customerId: string,
    data: CreateCustomerItemPriceRequest
  ): Promise<{ data: CustomerItemPrice }> =>
    apiClient.post<{ data: CustomerItemPrice }>(
      `/api/customers/${customerId}/special-prices`,
      data
    ),

  updateCustomerPrice: async (
    customerId: string,
    priceId: string,
    data: UpdateCustomerItemPriceRequest
  ): Promise<{ data: CustomerItemPrice }> =>
    apiClient.patch<{ data: CustomerItemPrice }>(
      `/api/customers/${customerId}/special-prices/${priceId}`,
      data
    ),

  deleteCustomerPrice: async (customerId: string, priceId: string): Promise<{ success: boolean }> =>
    apiClient.delete<{ success: boolean }>(
      `/api/customers/${customerId}/special-prices/${priceId}`
    ),

  resolveCustomerPrices: async (
    data: ResolveCustomerPricingRequest
  ): Promise<ResolveCustomerPricingResponse> =>
    apiClient.post<ResolveCustomerPricingResponse>("/api/pricing/resolve", data),
};
