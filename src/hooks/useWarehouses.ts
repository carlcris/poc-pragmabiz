import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { warehousesApi } from "@/lib/api/warehouses";
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
  const normalizedFilters = normalizeWarehouseFilters(filters);
  return useQuery({
    queryKey: [WAREHOUSES_QUERY_KEY, normalizedFilters],
    queryFn: () => warehousesApi.getWarehouses(normalizedFilters),
    placeholderData: keepPreviousData,
  });
}

export function useWarehouse(id: string) {
  return useQuery({
    queryKey: [WAREHOUSES_QUERY_KEY, id],
    queryFn: () => warehousesApi.getWarehouse(id),
    enabled: !!id,
  });
}

export function useCreateWarehouse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWarehouseRequest) => warehousesApi.createWarehouse(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WAREHOUSES_QUERY_KEY] });
    },
  });
}

export function useUpdateWarehouse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWarehouseRequest }) =>
      warehousesApi.updateWarehouse(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [WAREHOUSES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [WAREHOUSES_QUERY_KEY, variables.id] });
    },
  });
}

export function useDeleteWarehouse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => warehousesApi.deleteWarehouse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WAREHOUSES_QUERY_KEY] });
    },
  });
}
