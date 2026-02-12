/**
 * Purchasing Dashboard Data Hooks
 *
 * React Query hooks for fetching purchasing dashboard widget data.
 * Supports both full dashboard and individual widget fetching.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type {
  PurchasingDashboardData,
  DashboardQueryParams,
  OutstandingRequisitionsData,
  DamagedItemsData,
  ExpectedArrivalsData,
  DelayedShipmentsData,
  TodaysReceivingQueueData,
  PendingApprovalsData,
  BoxAssignmentQueueData,
  WarehouseCapacityData,
  ActiveRequisitionsData,
  IncomingDeliveriesData,
  ActiveContainersData,
  LocationAssignmentStatusData,
} from "@/types/purchasing-dashboard";

/**
 * Main hook for fetching purchasing dashboard data
 *
 * @param params - Query parameters to filter and customize the request
 * @param options - React Query options
 * @returns Query result with dashboard data
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = usePurchasingDashboard({
 *   widgets: ['outstandingRequisitions', 'delayedShipments'],
 *   warehouseId: '123',
 * });
 * ```
 */
export const usePurchasingDashboard = (
  params?: DashboardQueryParams,
  options?: Omit<UseQueryOptions<PurchasingDashboardData>, "queryKey" | "queryFn">
) => {
  return useQuery<PurchasingDashboardData>({
    queryKey: ["purchasing-dashboard", params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();

      if (params?.widgets && params.widgets.length > 0) {
        queryParams.append("widgets", params.widgets.join(","));
      }
      if (params?.dateFrom) {
        queryParams.append("dateFrom", params.dateFrom);
      }
      if (params?.dateTo) {
        queryParams.append("dateTo", params.dateTo);
      }
      if (params?.warehouseId) {
        queryParams.append("warehouseId", params.warehouseId);
      }
      if (params?.businessUnitId) {
        queryParams.append("businessUnitId", params.businessUnitId);
      }

      const endpoint = `/api/dashboard/purchasing${queryParams.toString() ? `?${queryParams}` : ""}`;
      const response = await apiClient.get<PurchasingDashboardData>(endpoint);
      return response;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes - data is considered fresh for 2 min
    gcTime: 1000 * 60 * 5, // 5 minutes - keep in cache for 5 min
    refetchInterval: 1000 * 60 * 5, // Auto-refresh every 5 minutes
    refetchOnWindowFocus: true, // Refetch when user returns to the tab
    retry: 2, // Retry failed requests twice
    ...options,
  });
};

// ============================================================================
// INDIVIDUAL WIDGET HOOKS
// ============================================================================

/**
 * Hook for Outstanding Requisitions widget
 * Shows active stock requisitions count and total value
 */
export const useOutstandingRequisitions = (
  params?: Omit<DashboardQueryParams, "widgets">,
  options?: Omit<UseQueryOptions<OutstandingRequisitionsData>, "queryKey" | "queryFn">
) => {
  return useQuery<OutstandingRequisitionsData>({
    queryKey: ["purchasing-dashboard", "outstandingRequisitions", params],
    queryFn: async () => {
      const response = await apiClient.get<PurchasingDashboardData>(
        `/api/dashboard/purchasing?widgets=outstandingRequisitions${params?.warehouseId ? `&warehouseId=${params.warehouseId}` : ""}${params?.businessUnitId ? `&businessUnitId=${params.businessUnitId}` : ""}`
      );
      return (
        response.outstandingRequisitions ?? {
          count: 0,
          totalValue: 0,
          items: [],
        }
      );
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
    ...options,
  });
};

/**
 * Hook for Damaged Items This Month widget
 * Shows damaged items with breakdowns by supplier and damage type
 */
export const useDamagedItemsThisMonth = (
  params?: Omit<DashboardQueryParams, "widgets">,
  options?: Omit<UseQueryOptions<DamagedItemsData>, "queryKey" | "queryFn">
) => {
  return useQuery<DamagedItemsData>({
    queryKey: ["purchasing-dashboard", "damagedItemsThisMonth", params],
    queryFn: async () => {
      const response = await apiClient.get<PurchasingDashboardData>(
        `/api/dashboard/purchasing?widgets=damagedItemsThisMonth${params?.warehouseId ? `&warehouseId=${params.warehouseId}` : ""}${params?.businessUnitId ? `&businessUnitId=${params.businessUnitId}` : ""}`
      );
      return (
        response.damagedItemsThisMonth ?? {
          count: 0,
          totalValue: 0,
          bySupplier: [],
          byDamageType: [],
        }
      );
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
    ...options,
  });
};

/**
 * Hook for Expected Arrivals This Week widget
 * Shows load lists expected to arrive this week
 */
export const useExpectedArrivalsThisWeek = (
  params?: Omit<DashboardQueryParams, "widgets">,
  options?: Omit<UseQueryOptions<ExpectedArrivalsData | undefined>, "queryKey" | "queryFn">
) => {
  return useQuery<ExpectedArrivalsData | undefined>({
    queryKey: ["purchasing-dashboard", "expectedArrivalsThisWeek", params],
    queryFn: async () => {
      const response = await apiClient.get<PurchasingDashboardData>(
        `/api/dashboard/purchasing?widgets=expectedArrivalsThisWeek${params?.warehouseId ? `&warehouseId=${params.warehouseId}` : ""}${params?.businessUnitId ? `&businessUnitId=${params.businessUnitId}` : ""}`
      );
      return response.expectedArrivalsThisWeek;
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
    ...options,
  });
};

/**
 * Hook for Delayed Shipments widget
 * Shows load lists that are past their estimated arrival date
 */
export const useDelayedShipments = (
  params?: Omit<DashboardQueryParams, "widgets">,
  options?: Omit<UseQueryOptions<DelayedShipmentsData | undefined>, "queryKey" | "queryFn">
) => {
  return useQuery<DelayedShipmentsData | undefined>({
    queryKey: ["purchasing-dashboard", "delayedShipments", params],
    queryFn: async () => {
      const response = await apiClient.get<PurchasingDashboardData>(
        `/api/dashboard/purchasing?widgets=delayedShipments${params?.warehouseId ? `&warehouseId=${params.warehouseId}` : ""}${params?.businessUnitId ? `&businessUnitId=${params.businessUnitId}` : ""}`
      );
      return response.delayedShipments;
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
    ...options,
  });
};

/**
 * Hook for Today's Receiving Queue widget
 * Shows load lists that arrived today and need receiving
 */
export const useTodaysReceivingQueue = (
  params?: Omit<DashboardQueryParams, "widgets">,
  options?: Omit<UseQueryOptions<TodaysReceivingQueueData | undefined>, "queryKey" | "queryFn">
) => {
  return useQuery<TodaysReceivingQueueData | undefined>({
    queryKey: ["purchasing-dashboard", "todaysReceivingQueue", params],
    queryFn: async () => {
      const response = await apiClient.get<PurchasingDashboardData>(
        `/api/dashboard/purchasing?widgets=todaysReceivingQueue${params?.warehouseId ? `&warehouseId=${params.warehouseId}` : ""}${params?.businessUnitId ? `&businessUnitId=${params.businessUnitId}` : ""}`
      );
      return response.todaysReceivingQueue;
    },
    staleTime: 1000 * 60 * 1, // 1 minute - more frequent for operational data
    gcTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 2, // Refresh every 2 minutes
    ...options,
  });
};

/**
 * Hook for Pending Approvals widget
 * Shows GRNs awaiting approval
 */
export const usePendingApprovals = (
  params?: Omit<DashboardQueryParams, "widgets">,
  options?: Omit<UseQueryOptions<PendingApprovalsData | undefined>, "queryKey" | "queryFn">
) => {
  return useQuery<PendingApprovalsData | undefined>({
    queryKey: ["purchasing-dashboard", "pendingApprovals", params],
    queryFn: async () => {
      const response = await apiClient.get<PurchasingDashboardData>(
        `/api/dashboard/purchasing?widgets=pendingApprovals`
      );
      return response.pendingApprovals;
    },
    staleTime: 1000 * 60 * 1,
    gcTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 2,
    ...options,
  });
};

/**
 * Hook for Box Assignment Queue widget
 * Shows items that need box assignments
 */
export const useBoxAssignmentQueue = (
  params?: Omit<DashboardQueryParams, "widgets">,
  options?: Omit<UseQueryOptions<BoxAssignmentQueueData | undefined>, "queryKey" | "queryFn">
) => {
  return useQuery<BoxAssignmentQueueData | undefined>({
    queryKey: ["purchasing-dashboard", "boxAssignmentQueue", params],
    queryFn: async () => {
      const response = await apiClient.get<PurchasingDashboardData>(
        `/api/dashboard/purchasing?widgets=boxAssignmentQueue`
      );
      return response.boxAssignmentQueue;
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
    ...options,
  });
};

/**
 * Hook for Warehouse Capacity widget
 * Shows warehouse space utilization metrics
 */
export const useWarehouseCapacity = (
  params?: Omit<DashboardQueryParams, "widgets">,
  options?: Omit<UseQueryOptions<WarehouseCapacityData>, "queryKey" | "queryFn">
) => {
  return useQuery<WarehouseCapacityData>({
    queryKey: ["purchasing-dashboard", "warehouseCapacity", params],
    queryFn: async () => {
      const response = await apiClient.get<PurchasingDashboardData>(
        `/api/dashboard/purchasing?widgets=warehouseCapacity${params?.warehouseId ? `&warehouseId=${params.warehouseId}` : ""}`
      );
      return (
        response.warehouseCapacity ?? {
          totalLocations: 0,
          occupiedLocations: 0,
          utilizationPercent: 0,
          availableSpace: 0,
        }
      );
    },
    staleTime: 1000 * 60 * 5, // 5 minutes - changes slowly
    gcTime: 1000 * 60 * 10,
    refetchInterval: 1000 * 60 * 10, // Refresh every 10 minutes
    ...options,
  });
};

/**
 * Hook for Active Requisitions widget
 * Shows breakdown of stock requisitions by status
 */
export const useActiveRequisitions = (
  params?: Omit<DashboardQueryParams, "widgets">,
  options?: Omit<UseQueryOptions<ActiveRequisitionsData | undefined>, "queryKey" | "queryFn">
) => {
  return useQuery<ActiveRequisitionsData | undefined>({
    queryKey: ["purchasing-dashboard", "activeRequisitions", params],
    queryFn: async () => {
      const response = await apiClient.get<PurchasingDashboardData>(
        `/api/dashboard/purchasing?widgets=activeRequisitions${params?.businessUnitId ? `&businessUnitId=${params.businessUnitId}` : ""}`
      );
      return response.activeRequisitions;
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
    ...options,
  });
};

/**
 * Hook for Incoming Deliveries with SRs widget
 * Shows upcoming deliveries with their linked requisitions
 */
export const useIncomingDeliveriesWithSRs = (
  params?: Omit<DashboardQueryParams, "widgets">,
  options?: Omit<UseQueryOptions<IncomingDeliveriesData | undefined>, "queryKey" | "queryFn">
) => {
  return useQuery<IncomingDeliveriesData | undefined>({
    queryKey: ["purchasing-dashboard", "incomingDeliveriesWithSRs", params],
    queryFn: async () => {
      const response = await apiClient.get<PurchasingDashboardData>(
        `/api/dashboard/purchasing?widgets=incomingDeliveriesWithSRs${params?.warehouseId ? `&warehouseId=${params.warehouseId}` : ""}${params?.businessUnitId ? `&businessUnitId=${params.businessUnitId}` : ""}`
      );
      return response.incomingDeliveriesWithSRs;
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
    ...options,
  });
};

/**
 * Hook for Active Containers widget
 * Shows containers currently in transit
 */
export const useActiveContainers = (
  params?: Omit<DashboardQueryParams, "widgets">,
  options?: Omit<UseQueryOptions<ActiveContainersData | undefined>, "queryKey" | "queryFn">
) => {
  return useQuery<ActiveContainersData | undefined>({
    queryKey: ["purchasing-dashboard", "activeContainers", params],
    queryFn: async () => {
      const response = await apiClient.get<PurchasingDashboardData>(
        `/api/dashboard/purchasing?widgets=activeContainers${params?.businessUnitId ? `&businessUnitId=${params.businessUnitId}` : ""}`
      );
      return response.activeContainers;
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
    ...options,
  });
};

/**
 * Hook for Location Assignment Status widget
 * Shows warehouse location assignment metrics
 */
export const useLocationAssignmentStatus = (
  params?: Omit<DashboardQueryParams, "widgets">,
  options?: Omit<UseQueryOptions<LocationAssignmentStatusData | undefined>, "queryKey" | "queryFn">
) => {
  return useQuery<LocationAssignmentStatusData | undefined>({
    queryKey: ["purchasing-dashboard", "locationAssignmentStatus", params],
    queryFn: async () => {
      const response = await apiClient.get<PurchasingDashboardData>(
        `/api/dashboard/purchasing?widgets=locationAssignmentStatus`
      );
      return response.locationAssignmentStatus;
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
    ...options,
  });
};
