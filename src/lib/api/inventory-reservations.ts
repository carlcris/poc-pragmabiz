import { apiClient } from "@/lib/api";
import type {
  InventoryReservationAllocationsResponse,
  InventoryReservationFilters,
  InventoryReservationsResponse,
} from "@/types/inventory-reservations";

export const inventoryReservationsApi = {
  list: (filters: InventoryReservationFilters): Promise<InventoryReservationsResponse> =>
    apiClient.get<InventoryReservationsResponse>("/api/inventory-reservations", {
      params: {
        search: filters.search,
        sourceType: filters.sourceType,
        status: filters.status,
        itemId: filters.itemId,
        warehouseId: filters.warehouseId,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        page: filters.page,
        limit: filters.limit,
      },
    }),
  allocations: (
    reservationId: string,
    page: number,
    limit: number
  ): Promise<InventoryReservationAllocationsResponse> =>
    apiClient.get<InventoryReservationAllocationsResponse>(
      `/api/inventory-reservations/${reservationId}/allocations`,
      { params: { page, limit } }
    ),
};
