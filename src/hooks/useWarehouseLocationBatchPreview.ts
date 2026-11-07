import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type {
  WarehouseLocationBatchPreview,
  WarehouseLocationBatchRange,
} from "@/types/inventory-location";

// Server-expanded preview; the same database function generates the codes on create.
export function useWarehouseLocationBatchPreview(
  warehouseId: string,
  range: WarehouseLocationBatchRange | null
) {
  return useQuery({
    queryKey: ["warehouse-locations", warehouseId, "batch-preview", range],
    queryFn: () =>
      apiClient.get<{ data: WarehouseLocationBatchPreview }>(
        `/api/warehouses/${warehouseId}/locations/batch`,
        {
          params: {
            parentId: range?.parentId ?? undefined,
            codePrefix: range?.codePrefix ?? "",
            from: range?.from,
            to: range?.to,
            digits: range?.digits,
            namePrefix: range?.namePrefix ?? undefined,
          },
        }
      ),
    select: (response) => response.data,
    enabled: Boolean(warehouseId && range),
  });
}
