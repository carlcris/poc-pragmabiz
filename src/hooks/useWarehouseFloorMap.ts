import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getWarehouseFloorMap, saveWarehouseFloorMap } from "@/lib/api/warehouse-floor-maps";

export const warehouseFloorMapQueryKey = (warehouseId: string) =>
  ["warehouse-floor-map", warehouseId] as const;

export const useWarehouseFloorMap = (warehouseId: string) =>
  useQuery({
    queryKey: warehouseFloorMapQueryKey(warehouseId),
    queryFn: () => getWarehouseFloorMap(warehouseId),
    enabled: Boolean(warehouseId),
  });

export const useSaveWarehouseFloorMap = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveWarehouseFloorMap,
    onSuccess: (response, input) => {
      queryClient.setQueryData(warehouseFloorMapQueryKey(input.warehouseId), response);
    },
  });
};
