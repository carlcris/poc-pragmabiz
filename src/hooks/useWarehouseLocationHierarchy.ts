"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { ITEM_LOCATIONS_QUERY_KEY } from "@/hooks/queryKeys";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import { loadLocationTree, type LocationTreePage } from "@/lib/warehouse-location-tree";

// Mounted only in expand-all mode. Unmounting consumes React Query's abort signal.
export function useWarehouseLocationHierarchy(warehouseId: string, itemId?: string) {
  const businessUnitId = useBusinessUnitStore((state) => state.currentBusinessUnit?.id);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const query = useQuery({
    queryKey: itemId
      ? [ITEM_LOCATIONS_QUERY_KEY, itemId, businessUnitId, "hierarchy", warehouseId]
      : ["warehouse-locations", warehouseId, "hierarchy", businessUnitId],
    queryFn: ({ signal }) =>
      loadLocationTree(
        (page, requestSignal) =>
          apiClient.get<LocationTreePage>(`/api/warehouses/${warehouseId}/location-tree`, {
            params: { itemId, page, limit: 500 },
            signal: requestSignal,
          }),
        signal,
        (loaded, total) => setProgress({ loaded, total })
      ),
    retry: false,
  });
  return { ...query, progress };
}
