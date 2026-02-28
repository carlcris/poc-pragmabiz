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

type LookupResponse<T> = { data: T[] };

export function useLookupWarehouses(params?: { search?: string; limit?: number; includeInactive?: boolean }) {
  return useQuery({
    queryKey: ["lookups", "warehouses", params?.search ?? "", params?.limit ?? 50, params?.includeInactive ?? false],
    queryFn: () =>
      apiClient.get<LookupResponse<LookupWarehouseOption>>("/api/lookups/warehouses", {
        params: {
          search: params?.search,
          limit: params?.limit ?? 50,
          includeInactive: params?.includeInactive ? "true" : "false",
        },
      }),
  });
}

export function useLookupWarehouseLocations(
  warehouseId: string | null | undefined,
  params?: { search?: string; limit?: number; includeInactive?: boolean }
) {
  return useQuery({
    queryKey: [
      "lookups",
      "warehouse_locations",
      warehouseId ?? null,
      params?.search ?? "",
      params?.limit ?? 50,
      params?.includeInactive ?? false,
    ],
    enabled: !!warehouseId,
    queryFn: () =>
      apiClient.get<LookupResponse<WarehouseLocation>>(`/api/lookups/warehouses/${warehouseId!}/locations`, {
        params: {
          search: params?.search,
          limit: params?.limit ?? 50,
          includeInactive: params?.includeInactive ? "true" : "false",
        },
      }),
  });
}
