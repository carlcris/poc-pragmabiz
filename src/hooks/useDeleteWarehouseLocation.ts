"use client";

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useInvalidateWarehouseLocations } from "@/hooks/useInvalidateWarehouseLocations";

export function useDeleteWarehouseLocation(warehouseId: string) {
  const invalidate = useInvalidateWarehouseLocations(warehouseId);
  return useMutation({
    mutationFn: (locationId: string) =>
      apiClient.delete<{ success: boolean }>(`/api/warehouse-locations/${locationId}`),
    onSuccess: () => invalidate(),
  });
}
