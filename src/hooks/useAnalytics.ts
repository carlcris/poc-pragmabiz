import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api/analytics";
import type { SalesAnalyticsFilters, ExportOptions } from "@/types/analytics";

const ANALYTICS_QUERY_KEY = "analytics";

// Overview analytics
export function useSalesOverview(filters?: SalesAnalyticsFilters) {
  return useQuery({
    queryKey: [ANALYTICS_QUERY_KEY, "overview", filters],
    queryFn: () => analyticsApi.getSalesOverview(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Sales by time
export function useSalesByTime(filters?: SalesAnalyticsFilters) {
  return useQuery({
    queryKey: [ANALYTICS_QUERY_KEY, "by-time", filters],
    queryFn: () => analyticsApi.getSalesByTime(filters),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Sales by employee
export function useSalesByEmployee(filters?: SalesAnalyticsFilters) {
  return useQuery({
    queryKey: [ANALYTICS_QUERY_KEY, "by-employee", filters],
    queryFn: () => analyticsApi.getSalesByEmployee(filters),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Sales by location
export function useSalesByLocation(filters?: SalesAnalyticsFilters) {
  return useQuery({
    queryKey: [ANALYTICS_QUERY_KEY, "by-location", filters],
    queryFn: () => analyticsApi.getSalesByLocation(filters),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Employee-specific analytics
export function useEmployeeAnalytics(employeeId: string, filters?: SalesAnalyticsFilters) {
  return useQuery({
    queryKey: [ANALYTICS_QUERY_KEY, "employee", employeeId, filters],
    queryFn: () => analyticsApi.getEmployeeAnalytics(employeeId, filters),
    enabled: !!employeeId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Commission analytics
export function useEmployeeCommissions(employeeId: string, period?: string) {
  return useQuery({
    queryKey: [ANALYTICS_QUERY_KEY, "commissions", employeeId, period],
    queryFn: () => analyticsApi.getEmployeeCommissions(employeeId, period),
    enabled: !!employeeId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCommissionBreakdown(employeeId: string, filters?: SalesAnalyticsFilters) {
  return useQuery({
    queryKey: [ANALYTICS_QUERY_KEY, "commission-breakdown", employeeId, filters],
    queryFn: () => analyticsApi.getCommissionBreakdown(employeeId, filters),
    enabled: !!employeeId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Dashboard widgets
export function useDashboardWidgets() {
  return useQuery({
    queryKey: [ANALYTICS_QUERY_KEY, "dashboard-widgets"],
    queryFn: () => analyticsApi.getDashboardWidgets(),
    staleTime: 2 * 60 * 1000, // 2 minutes (more frequent updates for dashboard)
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
  });
}

// Export functionality
export function useExportAnalytics() {
  return useMutation({
    mutationFn: (options: ExportOptions) => analyticsApi.exportAnalytics(options),
  });
}
