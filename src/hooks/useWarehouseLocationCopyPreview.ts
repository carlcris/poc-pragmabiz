import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type {
  WarehouseLocationCopyPreview,
  WarehouseLocationCopyRequest,
} from "@/types/inventory-location";

// Server-planned copy; the same database plan drives the copy itself.
export function useWarehouseLocationCopyPreview(
  warehouseId: string,
  sourceId: string,
  request: WarehouseLocationCopyRequest | null
) {
  return useQuery({
    queryKey: ["warehouse-locations", warehouseId, "copy-preview", sourceId, request],
    queryFn: () =>
      apiClient.get<{ data: WarehouseLocationCopyPreview }>(
        `/api/warehouse-locations/${sourceId}/copy`,
        {
          params: {
            destinationParentId: request?.destinationParentId ?? undefined,
            nameFind: request?.nameFind ?? undefined,
            nameReplace: request?.nameReplace ?? undefined,
          },
        }
      ),
    select: (response) => response.data,
    enabled: Boolean(warehouseId && sourceId && request),
  });
}
