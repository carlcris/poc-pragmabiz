import type {
  Customer,
  CreateCustomerRequest,
  UpdateCustomerRequest,
  CustomerFilters,
  CustomerListResponse,
} from "@/types/customer";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export const customersApi = {
  async getCustomers(filters?: CustomerFilters): Promise<CustomerListResponse> {
    const params = new URLSearchParams();
    if (filters?.search) params.append("search", filters.search);
    if (filters?.customerType && filters.customerType !== "all") {
      params.append("customerType", filters.customerType);
    }
    if (filters?.isActive !== undefined) params.append("isActive", String(filters.isActive));
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.limit) params.append("limit", String(filters.limit));

    const response = await fetch(`${API_BASE_URL}/customers?${params.toString()}`);
    if (!response.ok) throw new Error("Failed to fetch customers");
    return response.json();
  },

  async getCustomer(id: string): Promise<Customer> {
    const response = await fetch(`${API_BASE_URL}/customers/${id}`);
    if (!response.ok) throw new Error("Failed to fetch customer");
    return response.json();
  },

  async createCustomer(data: CreateCustomerRequest): Promise<Customer> {
    const response = await fetch(`${API_BASE_URL}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to create customer");
    return response.json();
  },

  async updateCustomer(id: string, data: UpdateCustomerRequest): Promise<Customer> {
    const response = await fetch(`${API_BASE_URL}/customers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to update customer");
    return response.json();
  },

  async deleteCustomer(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/customers/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete customer");
  },
};
