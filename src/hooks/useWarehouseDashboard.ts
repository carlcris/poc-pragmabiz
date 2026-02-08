import { useQuery } from "@tanstack/react-query";
import type { DashboardData } from "@/types/warehouse-dashboard";

export const useWarehouseDashboard = () => {
  return useQuery<DashboardData>({
    queryKey: ["warehouse-dashboard"],
    queryFn: async () => {
      const response = await fetch("/api/warehouse-dashboard");

      if (!response.ok) {
        throw new Error("Failed to fetch dashboard data");
      }

      return response.json();
    },
    staleTime: 30 * 1000, // Match polling window to avoid immediate focus-triggered refetches
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    refetchOnWindowFocus: true, // Refresh when user returns to tab
    retry: 2, // Retry failed requests twice
  });
};
