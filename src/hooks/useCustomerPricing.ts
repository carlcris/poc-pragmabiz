import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customerPricingApi } from "@/lib/api/customer-pricing";
import type {
  CreateCustomerItemPriceRequest,
  CustomerItemPriceFilters,
  UpdateCustomerItemPriceRequest,
} from "@/types/customer-pricing";

const CUSTOMER_PRICING_QUERY_KEY = "customer-pricing";

export const useCustomerSpecialPrices = (
  customerId: string,
  filters?: CustomerItemPriceFilters,
  enabled = true
) =>
  useQuery({
    queryKey: [CUSTOMER_PRICING_QUERY_KEY, customerId, filters],
    queryFn: () => customerPricingApi.getCustomerPrices(customerId, filters),
    enabled: enabled && Boolean(customerId),
    placeholderData: keepPreviousData,
  });

export const useCreateCustomerSpecialPrice = (customerId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCustomerItemPriceRequest) =>
      customerPricingApi.createCustomerPrice(customerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CUSTOMER_PRICING_QUERY_KEY, customerId] });
    },
  });
};

export const useUpdateCustomerSpecialPrice = (customerId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ priceId, data }: { priceId: string; data: UpdateCustomerItemPriceRequest }) =>
      customerPricingApi.updateCustomerPrice(customerId, priceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CUSTOMER_PRICING_QUERY_KEY, customerId] });
    },
  });
};

export const useDeleteCustomerSpecialPrice = (customerId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (priceId: string) => customerPricingApi.deleteCustomerPrice(customerId, priceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CUSTOMER_PRICING_QUERY_KEY, customerId] });
    },
  });
};

export const useResolvedCustomerPricing = ({
  customerId,
  itemIds,
  asOfDate,
  enabled = true,
}: {
  customerId?: string | null;
  itemIds: string[];
  asOfDate?: string;
  enabled?: boolean;
}) => {
  const normalizedItemIds = [...new Set(itemIds.filter(Boolean))].sort();

  return useQuery({
    queryKey: [CUSTOMER_PRICING_QUERY_KEY, "resolved", customerId, normalizedItemIds, asOfDate],
    queryFn: () =>
      customerPricingApi.resolveCustomerPrices({
        customerId: customerId || "",
        itemIds: normalizedItemIds,
        asOfDate,
      }),
    enabled:
      enabled && Boolean(customerId) && customerId !== "walk-in" && normalizedItemIds.length > 0,
    staleTime: 30_000,
  });
};
