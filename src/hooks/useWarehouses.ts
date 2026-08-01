import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { warehousesApi } from "@/lib/api/warehouses";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import type {
  CreateWarehouseRequest,
  UpdateWarehouseRequest,
  WarehouseFilters,
} from "@/types/warehouse";

const WAREHOUSES_QUERY_KEY = "warehouses";
const LOOKUP_MAX_LIMIT = 50;

const normalizeWarehouseFilters = (filters?: WarehouseFilters): WarehouseFilters | undefined => {
  if (!filters) return filters;
  if (!filters.limit || filters.limit <= LOOKUP_MAX_LIMIT) return filters;
  return { ...filters, limit: LOOKUP_MAX_LIMIT };
};

export function useWarehouses(filters?: WarehouseFilters) {
  const currentBusinessUnitId = useBusinessUnitStore((state) => state.currentBusinessUnit?.id);
  const { enabled, ...restFilters } = (filters ?? {}) as WarehouseFilters & { enabled?: boolean };
  const normalizedFilters = normalizeWarehouseFilters(restFilters);
  return useQuery({
    queryKey: [WAREHOUSES_QUERY_KEY, currentBusinessUnitId ?? null, "list", normalizedFilters],
    queryFn: () => warehousesApi.getWarehouses(normalizedFilters),
    enabled: (enabled ?? true) && Boolean(currentBusinessUnitId),
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[1] === currentBusinessUnitId ? previousData : undefined,
  });
}

export function useWarehouse(id: string) {
  const currentBusinessUnitId = useBusinessUnitStore((state) => state.currentBusinessUnit?.id);
  return useQuery({
    queryKey: [WAREHOUSES_QUERY_KEY, currentBusinessUnitId ?? null, "detail", id],
    queryFn: () => warehousesApi.getWarehouse(id),
    enabled: Boolean(id && currentBusinessUnitId),
  });
}

export function useCreateWarehouse() {
  const queryClient = useQueryClient();
  const currentBusinessUnitId = useBusinessUnitStore((state) => state.currentBusinessUnit?.id);
  return useMutation({
    mutationFn: (data: CreateWarehouseRequest) => warehousesApi.createWarehouse(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [WAREHOUSES_QUERY_KEY, currentBusinessUnitId ?? null],
      });
    },
  });
}

export function useUpdateWarehouse() {
  const queryClient = useQueryClient();
  const currentBusinessUnitId = useBusinessUnitStore((state) => state.currentBusinessUnit?.id);
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWarehouseRequest }) =>
      warehousesApi.updateWarehouse(id, data),
    onSuccess: (_, variables) => {
      const scopeKey = [WAREHOUSES_QUERY_KEY, currentBusinessUnitId ?? null] as const;
      queryClient.invalidateQueries({ queryKey: scopeKey });
      queryClient.invalidateQueries({ queryKey: [...scopeKey, "detail", variables.id] });
    },
  });
}

export function useDeleteWarehouse() {
  const queryClient = useQueryClient();
  const currentBusinessUnitId = useBusinessUnitStore((state) => state.currentBusinessUnit?.id);
  return useMutation({
    mutationFn: (id: string) => warehousesApi.deleteWarehouse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [WAREHOUSES_QUERY_KEY, currentBusinessUnitId ?? null],
      });
    },
  });
}
