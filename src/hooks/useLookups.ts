import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { WarehouseLocation } from "@/types/inventory-location";

export type LookupWarehouseOption = {
  id: string;
  code: string;
  name: string;
  businessUnitId?: string | null;
  isActive: boolean;
};

export type LookupBusinessUnitOption = {
  id: string;
  code: string;
  name: string;
  type: string;
  is_active: boolean;
};

export type LookupStockRequestBatchOption = {
  id: string;
  batchCode: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  rackSummary: string;
  receivedAt: string;
  availableBaseQty: number;
};

type LookupResponse<T> = {
  data: T[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type WarehouseLookupScope = "current_business_unit" | "accessible_business_units";

export function useLookupBusinessUnits(params?: {
  search?: string;
  page?: number;
  limit?: number;
  excludeId?: string;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: [
      "lookups",
      "business-units",
      params?.search ?? "",
      params?.page ?? 1,
      params?.limit ?? 5,
      params?.excludeId ?? null,
    ],
    enabled: params?.enabled ?? true,
    queryFn: () =>
      apiClient.get<LookupResponse<LookupBusinessUnitOption>>("/api/lookups/business-units", {
        params: {
          search: params?.search,
          page: params?.page ?? 1,
          limit: params?.limit ?? 5,
          excludeId: params?.excludeId,
        },
      }),
  });
}

export function useLookupWarehouses(params: {
  scope: WarehouseLookupScope;
  search?: string;
  page?: number;
  limit?: number;
  includeInactive?: boolean;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: [
      "lookups",
      "warehouses",
      params.scope,
      params?.search ?? "",
      params?.page ?? 1,
      params?.limit ?? 5,
      params?.includeInactive ?? false,
    ],
    enabled: params.enabled ?? true,
    queryFn: () =>
      apiClient.get<LookupResponse<LookupWarehouseOption>>("/api/lookups/warehouses", {
        params: {
          scope: params.scope,
          search: params?.search,
          page: params?.page ?? 1,
          limit: params?.limit ?? 5,
          includeInactive: params?.includeInactive ? "true" : "false",
        },
      }),
  });
}

export function useLookupWarehouseLocations(
  warehouseId: string | null | undefined,
  params?: {
    search?: string;
    limit?: number;
    includeInactive?: boolean;
    storableOnly?: boolean;
  }
) {
  return useQuery({
    queryKey: [
      "lookups",
      "warehouse_locations",
      warehouseId ?? null,
      params?.search ?? "",
      params?.limit ?? 50,
      params?.includeInactive ?? false,
      params?.storableOnly ?? false,
    ],
    enabled: !!warehouseId,
    queryFn: () =>
      apiClient.get<LookupResponse<WarehouseLocation>>(
        `/api/lookups/warehouses/${warehouseId!}/locations`,
        {
          params: {
            search: params?.search,
            limit: params?.limit ?? 50,
            includeInactive: params?.includeInactive ? "true" : "false",
            storableOnly: params?.storableOnly ? "true" : "false",
          },
        }
      ),
  });
}

export function useLookupStockRequestBatches(params: {
  fulfillingBusinessUnitId?: string;
  itemId?: string;
  search?: string;
  page?: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: [
      "lookups",
      "stock-request-batches",
      params.fulfillingBusinessUnitId ?? null,
      params.itemId ?? null,
      params.search ?? "",
      params.page ?? 1,
    ],
    enabled: (params.enabled ?? true) && !!params.fulfillingBusinessUnitId && !!params.itemId,
    queryFn: () =>
      apiClient.get<LookupResponse<LookupStockRequestBatchOption>>(
        "/api/lookups/stock-request-batches",
        {
          params: {
            fulfillingBusinessUnitId: params.fulfillingBusinessUnitId,
            itemId: params.itemId,
            search: params.search,
            page: params.page ?? 1,
          },
        }
      ),
  });
}
