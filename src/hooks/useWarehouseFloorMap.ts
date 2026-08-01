import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getWarehouseFloorMap, saveWarehouseFloorMap } from "@/lib/api/warehouse-floor-maps";
import { getApiErrorCode } from "@/lib/api";

const TERMINAL_FLOOR_MAP_QUERY_ERROR_CODES = [
  "WAREHOUSE_NOT_FOUND",
  "FLOOR_MAP_PERMISSION_DENIED",
] as const;

export const warehouseFloorMapQueryKey = (businessUnitId: string, warehouseId: string) =>
  ["business-unit", businessUnitId, "warehouse-floor-map", warehouseId] as const;

export const useWarehouseFloorMap = (businessUnitId: string, warehouseId: string) =>
  useQuery({
    queryKey: warehouseFloorMapQueryKey(businessUnitId, warehouseId),
    queryFn: () => getWarehouseFloorMap(warehouseId),
    enabled: Boolean(businessUnitId && warehouseId),
    retry: (failureCount, error) => {
      const terminalCode = getApiErrorCode(error, TERMINAL_FLOOR_MAP_QUERY_ERROR_CODES);
      return terminalCode === null && failureCount < 1;
    },
  });

export const useSaveWarehouseFloorMap = (businessUnitId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveWarehouseFloorMap,
    onSuccess: (response, input) => {
      queryClient.setQueryData(
        warehouseFloorMapQueryKey(businessUnitId, input.warehouseId),
        response
      );
    },
  });
};
