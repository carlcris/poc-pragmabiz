import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { INVENTORY_RESERVATIONS_QUERY_KEY } from "@/hooks/queryKeys";
import { inventoryReservationsApi } from "@/lib/api/inventory-reservations";
import type { InventoryReservationFilters } from "@/types/inventory-reservations";

export function useInventoryReservations(
  filters: InventoryReservationFilters,
  options?: { enabled?: boolean; businessUnitId?: string }
) {
  return useQuery({
    queryKey: [INVENTORY_RESERVATIONS_QUERY_KEY, options?.businessUnitId, filters],
    queryFn: () => inventoryReservationsApi.list(filters),
    placeholderData: keepPreviousData,
    enabled: options?.enabled,
    staleTime: 30_000,
  });
}

export function useInventoryReservationAllocations(
  reservationId: string,
  page: number,
  limit: number,
  options?: { enabled?: boolean; businessUnitId?: string }
) {
  return useQuery({
    queryKey: [
      INVENTORY_RESERVATIONS_QUERY_KEY,
      options?.businessUnitId,
      reservationId,
      "allocations",
      page,
      limit,
    ],
    queryFn: () => inventoryReservationsApi.allocations(reservationId, page, limit),
    placeholderData: keepPreviousData,
    enabled: Boolean(reservationId) && options?.enabled,
    staleTime: 30_000,
  });
}
