import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getWarehouseFloorMap,
  getWarehouseFloors,
  saveWarehouseFloorMap,
} from "@/lib/api/warehouse-floor-maps";
import { getApiErrorCode } from "@/lib/api";

const TERMINAL_FLOOR_MAP_QUERY_ERROR_CODES = [
  "WAREHOUSE_NOT_FOUND",
  "FLOOR_MAP_PERMISSION_DENIED",
] as const;

export const warehouseFloorMapQueryKey = (
  businessUnitId: string,
  warehouseId: string,
  floorNumber: number
) => ["business-unit", businessUnitId, "warehouse-floor-map", warehouseId, floorNumber] as const;

export const useWarehouseFloorMap = (
  businessUnitId: string,
  warehouseId: string,
  floorNumber: number
) =>
  useQuery({
    queryKey: warehouseFloorMapQueryKey(businessUnitId, warehouseId, floorNumber),
    queryFn: () => getWarehouseFloorMap(warehouseId, floorNumber),
    enabled: Boolean(businessUnitId && warehouseId && floorNumber),
    retry: (failureCount, error) => {
      const terminalCode = getApiErrorCode(error, TERMINAL_FLOOR_MAP_QUERY_ERROR_CODES);
      return terminalCode === null && failureCount < 1;
    },
  });

export const useWarehouseFloors = (businessUnitId: string, warehouseId: string, search: string) =>
  useQuery({
    queryKey: ["business-unit", businessUnitId, "warehouse-floors", warehouseId, search],
    queryFn: () => getWarehouseFloors(warehouseId, search),
    enabled: Boolean(businessUnitId && warehouseId),
  });

export const useSaveWarehouseFloorMap = (businessUnitId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveWarehouseFloorMap,
    onSuccess: (response, input) => {
      queryClient.setQueryData(
        warehouseFloorMapQueryKey(businessUnitId, input.warehouseId, input.floorNumber),
        response
      );
      queryClient.invalidateQueries({
        queryKey: ["business-unit", businessUnitId, "warehouse-floors", input.warehouseId],
      });
    },
  });
};
