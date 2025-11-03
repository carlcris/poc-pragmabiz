import type {
  SalesAnalyticsFilters,
  SalesOverview,
  SalesByTime,
  SalesByEmployee,
  SalesByLocation,
  EmployeeCommissionSummary,
  CommissionBreakdown,
  DashboardWidgetData,
  ExportOptions,
  AnalyticsResponse,
  PaginatedAnalyticsResponse,
} from "@/types/analytics";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export const analyticsApi = {
  // Overview analytics
  async getSalesOverview(
    filters?: SalesAnalyticsFilters
  ): Promise<AnalyticsResponse<SalesOverview>> {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    if (filters?.employeeId) params.append("employeeId", filters.employeeId);
    if (filters?.city) params.append("city", filters.city);
    if (filters?.regionState) params.append("regionState", filters.regionState);

    const response = await fetch(
      `${API_BASE_URL}/analytics/sales/overview?${params.toString()}`
    );
    if (!response.ok) throw new Error("Failed to fetch sales overview");
    return response.json();
  },

  // Sales by time
  async getSalesByTime(
    filters?: SalesAnalyticsFilters
  ): Promise<PaginatedAnalyticsResponse<SalesByTime>> {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    if (filters?.employeeId) params.append("employeeId", filters.employeeId);
    if (filters?.city) params.append("city", filters.city);
    if (filters?.regionState) params.append("regionState", filters.regionState);

    const response = await fetch(
      `${API_BASE_URL}/analytics/sales/by-day?${params.toString()}`
    );
    if (!response.ok) throw new Error("Failed to fetch sales by time");
    return response.json();
  },

  // Sales by employee
  async getSalesByEmployee(
    filters?: SalesAnalyticsFilters
  ): Promise<PaginatedAnalyticsResponse<SalesByEmployee>> {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    if (filters?.employeeIds) {
      filters.employeeIds.forEach((id) => params.append("employeeIds[]", id));
    }
    if (filters?.city) params.append("city", filters.city);
    if (filters?.regionState) params.append("regionState", filters.regionState);

    const response = await fetch(
      `${API_BASE_URL}/analytics/sales/by-employee?${params.toString()}`
    );
    if (!response.ok) throw new Error("Failed to fetch sales by employee");
    return response.json();
  },

  // Sales by location
  async getSalesByLocation(
    filters?: SalesAnalyticsFilters
  ): Promise<PaginatedAnalyticsResponse<SalesByLocation>> {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    if (filters?.cities) {
      filters.cities.forEach((city) => params.append("cities[]", city));
    }
    if (filters?.regions) {
      filters.regions.forEach((region) => params.append("regions[]", region));
    }

    const response = await fetch(
      `${API_BASE_URL}/analytics/sales/by-location?${params.toString()}`
    );
    if (!response.ok) throw new Error("Failed to fetch sales by location");
    return response.json();
  },

  // Employee-specific analytics
  async getEmployeeAnalytics(
    employeeId: string,
    filters?: SalesAnalyticsFilters
  ): Promise<AnalyticsResponse<SalesByEmployee>> {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);

    const response = await fetch(
      `${API_BASE_URL}/analytics/sales/employee/${employeeId}?${params.toString()}`
    );
    if (!response.ok) throw new Error("Failed to fetch employee analytics");
    return response.json();
  },

  // Commission analytics
  async getEmployeeCommissions(
    employeeId: string,
    period?: string
  ): Promise<EmployeeCommissionSummary> {
    const params = new URLSearchParams();
    if (period) params.append("period", period);

    const response = await fetch(
      `${API_BASE_URL}/analytics/commissions/employee/${employeeId}?${params.toString()}`
    );
    if (!response.ok) throw new Error("Failed to fetch employee commissions");
    return response.json();
  },

  async getCommissionBreakdown(
    employeeId: string,
    filters?: SalesAnalyticsFilters
  ): Promise<CommissionBreakdown[]> {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);

    const response = await fetch(
      `${API_BASE_URL}/analytics/commissions/employee/${employeeId}/breakdown?${params.toString()}`
    );
    if (!response.ok) throw new Error("Failed to fetch commission breakdown");
    return response.json();
  },

  // Dashboard widgets
  async getDashboardWidgets(): Promise<DashboardWidgetData> {
    const response = await fetch(`${API_BASE_URL}/analytics/dashboard/widgets`);
    if (!response.ok) throw new Error("Failed to fetch dashboard widgets");
    return response.json();
  },

  // Export functionality
  async exportAnalytics(options: ExportOptions): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/analytics/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });
    if (!response.ok) throw new Error("Failed to export analytics");
    return response.blob();
  },
};
