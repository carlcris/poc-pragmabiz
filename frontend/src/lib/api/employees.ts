import type {
  Employee,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  EmployeeFilters,
  EmployeeDistributionLocation,
  CreateTerritoryRequest,
  UpdateTerritoryRequest,
  EmployeePerformance,
} from "@/types/employee";

interface EmployeeListResponse {
  data: Employee[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface TerritoryListResponse {
  data: EmployeeDistributionLocation[];
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export const employeesApi = {
  // Employee CRUD operations
  async getEmployees(filters?: EmployeeFilters): Promise<EmployeeListResponse> {
    const params = new URLSearchParams();
    if (filters?.search) params.append("search", filters.search);
    if (filters?.role) params.append("role", filters.role);
    if (filters?.employmentStatus) params.append("employmentStatus", filters.employmentStatus);
    if (filters?.city) params.append("city", filters.city);
    if (filters?.regionState) params.append("regionState", filters.regionState);
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.limit) params.append("limit", String(filters.limit));

    const response = await fetch(`${API_BASE_URL}/employees?${params.toString()}`);
    if (!response.ok) throw new Error("Failed to fetch employees");
    return response.json();
  },

  async getEmployee(id: string): Promise<Employee> {
    const response = await fetch(`${API_BASE_URL}/employees/${id}`);
    if (!response.ok) throw new Error("Failed to fetch employee");
    return response.json();
  },

  async createEmployee(data: CreateEmployeeRequest): Promise<Employee> {
    const response = await fetch(`${API_BASE_URL}/employees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to create employee");
    return response.json();
  },

  async updateEmployee(id: string, data: UpdateEmployeeRequest): Promise<Employee> {
    const response = await fetch(`${API_BASE_URL}/employees/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to update employee");
    return response.json();
  },

  async deleteEmployee(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/employees/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete employee");
  },

  // Territory management
  async getTerritories(employeeId: string): Promise<TerritoryListResponse> {
    const response = await fetch(`${API_BASE_URL}/employees/${employeeId}/territories`);
    if (!response.ok) throw new Error("Failed to fetch territories");
    return response.json();
  },

  async createTerritory(
    employeeId: string,
    data: CreateTerritoryRequest
  ): Promise<EmployeeDistributionLocation> {
    const response = await fetch(`${API_BASE_URL}/employees/${employeeId}/territories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to create territory");
    return response.json();
  },

  async updateTerritory(
    employeeId: string,
    territoryId: string,
    data: UpdateTerritoryRequest
  ): Promise<EmployeeDistributionLocation> {
    const response = await fetch(
      `${API_BASE_URL}/employees/${employeeId}/territories/${territoryId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );
    if (!response.ok) throw new Error("Failed to update territory");
    return response.json();
  },

  async deleteTerritory(employeeId: string, territoryId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/employees/${employeeId}/territories/${territoryId}`,
      {
        method: "DELETE",
      }
    );
    if (!response.ok) throw new Error("Failed to delete territory");
  },

  // Performance metrics
  async getEmployeePerformance(
    employeeId: string,
    startDate?: string,
    endDate?: string
  ): Promise<EmployeePerformance> {
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);

    const response = await fetch(
      `${API_BASE_URL}/employees/${employeeId}/performance?${params.toString()}`
    );
    if (!response.ok) throw new Error("Failed to fetch employee performance");
    return response.json();
  },
};
