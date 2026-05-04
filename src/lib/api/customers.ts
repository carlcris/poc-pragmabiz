import { apiClient } from "@/lib/api";
import type {
  Customer,
  CustomerLedgerFilters,
  CustomerLedgerResponse,
  CreateCustomerRequest,
  UpdateCustomerRequest,
  CustomerFilters,
} from "@/types/customer";
import type { PaginatedResponse } from "@/types/api";

export const customersApi = {
  // Get all customers with filters
  async getCustomers(filters?: CustomerFilters): Promise<PaginatedResponse<Customer>> {
    const params = new URLSearchParams();

    if (filters?.search) params.append("search", filters.search);
    if (filters?.page) params.append("page", filters.page.toString());
    if (filters?.limit) params.append("limit", filters.limit.toString());
    if (filters?.customerType) params.append("customerType", filters.customerType);
    if (filters?.isActive !== undefined) params.append("isActive", filters.isActive.toString());

    return apiClient.get<PaginatedResponse<Customer>>(`/api/customers?${params.toString()}`);
  },

  // Get single customer by ID
  async getCustomer(id: string): Promise<Customer> {
    return apiClient.get<Customer>(`/api/customers/${id}`);
  },

  // Get customer ledger entries and account summary
  async getCustomerLedger(
    id: string,
    filters?: CustomerLedgerFilters
  ): Promise<CustomerLedgerResponse> {
    const params = new URLSearchParams();

    if (filters?.dateFrom) params.append("dateFrom", filters.dateFrom);
    if (filters?.dateTo) params.append("dateTo", filters.dateTo);
    if (filters?.sourceType && filters.sourceType !== "all") {
      params.append("sourceType", filters.sourceType);
    }
    if (filters?.search) params.append("search", filters.search);
    if (filters?.page) params.append("page", filters.page.toString());
    if (filters?.limit) params.append("limit", filters.limit.toString());

    const query = params.toString();
    return apiClient.get<CustomerLedgerResponse>(
      `/api/customers/${id}/ledger${query ? `?${query}` : ""}`
    );
  },

  // Create new customer
  async createCustomer(data: CreateCustomerRequest): Promise<Customer> {
    return apiClient.post<Customer>("/api/customers", data);
  },

  // Update customer
  async updateCustomer(id: string, data: UpdateCustomerRequest): Promise<Customer> {
    return apiClient.put<Customer>(`/api/customers/${id}`, data);
  },

  // Delete customer (soft delete)
  async deleteCustomer(id: string): Promise<{ success: boolean }> {
    return apiClient.delete<{ success: boolean }>(`/api/customers/${id}`);
  },
};
