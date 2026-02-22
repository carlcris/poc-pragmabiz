import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { customersApi } from "@/lib/api/customers";
import type {
  CustomerFilters,
  CreateCustomerRequest,
  UpdateCustomerRequest,
} from "@/types/customer";

const CUSTOMERS_QUERY_KEY = "customers";
const LOOKUP_MAX_LIMIT = 50;

const normalizeCustomerFilters = (filters?: CustomerFilters): CustomerFilters | undefined => {
  if (!filters) return filters;
  if (!filters.limit || filters.limit <= LOOKUP_MAX_LIMIT) return filters;
  return { ...filters, limit: LOOKUP_MAX_LIMIT };
};

export function useCustomers(filters?: CustomerFilters) {
  const normalizedFilters = normalizeCustomerFilters(filters);
  return useQuery({
    queryKey: [CUSTOMERS_QUERY_KEY, normalizedFilters],
    queryFn: () => customersApi.getCustomers(normalizedFilters),
    placeholderData: keepPreviousData,
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: [CUSTOMERS_QUERY_KEY, id],
    queryFn: () => customersApi.getCustomer(id),
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCustomerRequest) => customersApi.createCustomer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CUSTOMERS_QUERY_KEY] });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCustomerRequest }) =>
      customersApi.updateCustomer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CUSTOMERS_QUERY_KEY] });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => customersApi.deleteCustomer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CUSTOMERS_QUERY_KEY] });
    },
  });
}
