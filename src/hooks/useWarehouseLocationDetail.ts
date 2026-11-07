import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { WarehouseLocationDetail } from "@/types/inventory-location";

export function useWarehouseLocationDetail(
  warehouseId: string,
  locationId: string | null | undefined
) {
  return useQuery({
    queryKey: ["warehouse-locations", warehouseId, "detail", locationId],
    queryFn: () =>
      apiClient.get<{ data: WarehouseLocationDetail }>(`/api/warehouse-locations/${locationId}`),
    select: (response) => response.data,
    enabled: Boolean(warehouseId && locationId),
  });
}
