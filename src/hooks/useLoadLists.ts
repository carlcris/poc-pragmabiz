import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  LOAD_LISTS_QUERY_KEY,
  STOCK_IN_TRANSIT_QUERY_KEY,
  STOCK_REQUISITIONS_QUERY_KEY,
  WAREHOUSE_DASHBOARD_QUERY_KEY,
} from "@/hooks/queryKeys";
import { useRealtimeDomainInvalidation } from "@/hooks/useRealtimeDomainInvalidation";
import { loadListsApi } from "@/lib/api/load-lists";
import type {
  LoadListFilters,
  CreateLoadListRequest,
  UpdateLoadListRequest,
  UpdateLoadListStatusRequest,
  UpdateLoadListTransitDetailsRequest,
  CreateLoadListSRLinkRequest,
  EligibleLoadListRequisitionItemFilters,
} from "@/types/load-list";

const ARRIVAL_DASHBOARD_WIDGETS = new Set([
  "expectedArrivalsThisWeek",
  "delayedShipments",
  "incomingDeliveriesWithSRs",
  "activeContainers",
]);

export function useLoadLists(filters?: LoadListFilters) {
  useRealtimeDomainInvalidation("purchasing", { queryKeys: [LOAD_LISTS_QUERY_KEY] });

  return useQuery({
    queryKey: [LOAD_LISTS_QUERY_KEY, filters],
    queryFn: () => loadListsApi.getLoadLists(filters),
    placeholderData: keepPreviousData,
  });
}

export function useLoadList(id: string) {
  useRealtimeDomainInvalidation("purchasing", {
    queryKeys: [LOAD_LISTS_QUERY_KEY],
    enabled: !!id,
  });

  return useQuery({
    queryKey: [LOAD_LISTS_QUERY_KEY, id],
    queryFn: () => loadListsApi.getLoadList(id),
    enabled: !!id,
  });
}

export function useCreateLoadList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateLoadListRequest) => loadListsApi.createLoadList(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LOAD_LISTS_QUERY_KEY] });
    },
  });
}

export function useUpdateLoadList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLoadListRequest }) =>
      loadListsApi.updateLoadList(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [LOAD_LISTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [LOAD_LISTS_QUERY_KEY, variables.id] });
    },
  });
}

export function useDeleteLoadList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => loadListsApi.deleteLoadList(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LOAD_LISTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [WAREHOUSE_DASHBOARD_QUERY_KEY] });
    },
  });
}

export function useUpdateLoadListStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLoadListStatusRequest }) =>
      loadListsApi.updateLoadListStatus(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [LOAD_LISTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [LOAD_LISTS_QUERY_KEY, variables.id] });
      queryClient.invalidateQueries({ queryKey: [STOCK_IN_TRANSIT_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [WAREHOUSE_DASHBOARD_QUERY_KEY] });
    },
  });
}

export function useUpdateLoadListTransitDetails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLoadListTransitDetailsRequest }) =>
      loadListsApi.updateLoadListTransitDetails(id, data),
    onSuccess: async (_, { id, data }) => {
      const changedEta = data.estimatedArrivalDate !== undefined;
      const refreshes = [
        queryClient.invalidateQueries({
          queryKey: [LOAD_LISTS_QUERY_KEY],
          predicate: ({ queryKey }) =>
            typeof queryKey[1] !== "string" || (queryKey[1] === id && queryKey.length === 2),
        }),
        queryClient.invalidateQueries({
          queryKey: [STOCK_IN_TRANSIT_QUERY_KEY],
          predicate: ({ queryKey }) => changedEta || queryKey[2] === "arrivals",
        }),
        queryClient.invalidateQueries({ queryKey: ["shipments-report"] }),
      ];

      if (changedEta) {
        refreshes.push(
          queryClient.invalidateQueries({ queryKey: [WAREHOUSE_DASHBOARD_QUERY_KEY] }),
          queryClient.invalidateQueries({
            queryKey: ["purchasing-dashboard"],
            predicate: ({ queryKey }) => {
              const widgetOrParams = queryKey[1];
              return (
                typeof widgetOrParams !== "string" || ARRIVAL_DASHBOARD_WIDGETS.has(widgetOrParams)
              );
            },
          })
        );
      }

      await Promise.all(refreshes);
    },
  });
}

export function useLinkSRsToLoadList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateLoadListSRLinkRequest }) =>
      loadListsApi.linkSRsToLoadList(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [LOAD_LISTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [LOAD_LISTS_QUERY_KEY, variables.id] });
      queryClient.invalidateQueries({ queryKey: [LOAD_LISTS_QUERY_KEY, variables.id, "sr-links"] });
      queryClient.invalidateQueries({ queryKey: [STOCK_REQUISITIONS_QUERY_KEY] });
    },
  });
}

export function useRemoveLoadListSRLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, linkId }: { id: string; linkId: string }) =>
      loadListsApi.removeLoadListSRLink(id, linkId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [LOAD_LISTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [LOAD_LISTS_QUERY_KEY, variables.id] });
      queryClient.invalidateQueries({ queryKey: [LOAD_LISTS_QUERY_KEY, variables.id, "sr-links"] });
      queryClient.invalidateQueries({ queryKey: [STOCK_REQUISITIONS_QUERY_KEY] });
    },
  });
}

export function useLoadListSRLinks(id: string) {
  useRealtimeDomainInvalidation("purchasing", {
    queryKeys: [LOAD_LISTS_QUERY_KEY],
    enabled: !!id,
  });

  return useQuery({
    queryKey: [LOAD_LISTS_QUERY_KEY, id, "sr-links"],
    queryFn: () => loadListsApi.getLoadListSRLinks(id),
    enabled: !!id,
  });
}

export function useEligibleLoadListRequisitionItems(
  id: string,
  filters: EligibleLoadListRequisitionItemFilters,
  enabled: boolean
) {
  return useQuery({
    queryKey: [LOAD_LISTS_QUERY_KEY, id, "eligible-requisition-items", filters],
    queryFn: () => loadListsApi.getEligibleRequisitionItems(id, filters),
    enabled: enabled && !!id,
    placeholderData: keepPreviousData,
  });
}
