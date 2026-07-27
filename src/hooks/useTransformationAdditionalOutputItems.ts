import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  transformationAdditionalOutputItemsApi,
  type TransformationAdditionalOutputItemFilters,
} from "@/lib/api/transformation-additional-output-items";

export const TRANSFORMATION_ADDITIONAL_OUTPUT_ITEMS_QUERY_KEY =
  "transformation-additional-output-items";

export function useTransformationAdditionalOutputItems(
  filters: TransformationAdditionalOutputItemFilters
) {
  return useQuery({
    queryKey: [TRANSFORMATION_ADDITIONAL_OUTPUT_ITEMS_QUERY_KEY, filters],
    queryFn: () => transformationAdditionalOutputItemsApi.list(filters),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
