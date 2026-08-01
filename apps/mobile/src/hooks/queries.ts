import { useEffect } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import * as businessUnitsApi from "@/api/businessUnits";
import * as dashboardApi from "@/api/dashboard";
import * as itemInfoApi from "@/api/itemInfo";
import * as pickingApi from "@/api/picking";
import * as receivingApi from "@/api/receiving";
import { getRealtimeConfig } from "@/api/realtime";
import { useAuthStore } from "@/stores/authStore";
import { getRealtimeClient } from "@/lib/supabase";
import type { PickListDetail, PickListSummary } from "@/contracts/picking";
import type {
  LoadListReceivingDetail,
  RecordDeliveryNoteReceivingScanPayload,
  SubmitGrnReceivingPayload,
  SubmitDeliveryNoteReceivingPayload,
  UpdateGrnReceivingPayload,
} from "@/contracts/receiving";

export const queryKeys = {
  businessUnits: (companyId: string, userId: string) =>
    ["business-units", companyId, userId] as const,
  businessUnitScope: (businessUnitId: string) => ["business-unit-scope", businessUnitId] as const,
  dashboard: (businessUnitId: string) =>
    [...queryKeys.businessUnitScope(businessUnitId), "dashboard"] as const,
  loadListsScope: (businessUnitId: string) =>
    [...queryKeys.businessUnitScope(businessUnitId), "load-lists"] as const,
  loadLists: (businessUnitId: string, status: string, search: string) =>
    [...queryKeys.loadListsScope(businessUnitId), status, search] as const,
  loadListReceivingScope: (businessUnitId: string, id: string) =>
    [...queryKeys.businessUnitScope(businessUnitId), "load-list-receiving", id] as const,
  loadListReceiving: (businessUnitId: string, id: string, includeGrn: boolean) =>
    [...queryKeys.loadListReceivingScope(businessUnitId, id), includeGrn] as const,
  deliveryNotesScope: (businessUnitId: string) =>
    [...queryKeys.businessUnitScope(businessUnitId), "delivery-notes"] as const,
  deliveryNotes: (businessUnitId: string, status: string, search: string) =>
    [...queryKeys.deliveryNotesScope(businessUnitId), status, search] as const,
  deliveryNote: (businessUnitId: string, id: string) =>
    [...queryKeys.businessUnitScope(businessUnitId), "delivery-note", id] as const,
  receivingWarehouses: (businessUnitId: string) =>
    [...queryKeys.businessUnitScope(businessUnitId), "receiving-warehouses"] as const,
  scannedItemInfo: (businessUnitId: string, payload: string) =>
    [...queryKeys.businessUnitScope(businessUnitId), "scanned-item-info", payload] as const,
  pickListsScope: (businessUnitId: string) =>
    [...queryKeys.businessUnitScope(businessUnitId), "pick-lists"] as const,
  pickLists: (businessUnitId: string, status: string, search: string) =>
    [...queryKeys.pickListsScope(businessUnitId), status, search] as const,
  pickList: (businessUnitId: string, id: string) =>
    [...queryKeys.businessUnitScope(businessUnitId), "pick-list", id] as const,
  pickLocationMap: (businessUnitId: string, pickListId: string, pickListItemId: string) =>
    [
      ...queryKeys.businessUnitScope(businessUnitId),
      "pick-location-map",
      pickListId,
      pickListItemId,
    ] as const,
  warehouseFloorMapAsset: (businessUnitId: string, mapId: string, version: number) =>
    [
      ...queryKeys.businessUnitScope(businessUnitId),
      "warehouse-floor-map-asset",
      mapId,
      version,
    ] as const,
};

const BUSINESS_UNITS_STALE_TIME_MS = 10 * 60 * 1000;
const BUSINESS_UNITS_GC_TIME_MS = 30 * 60 * 1000;
const PICK_LOCATION_MAP_STALE_TIME_MS = 5 * 60 * 1000;
const PICK_LOCATION_MAP_GC_TIME_MS = 10 * 60 * 1000;

export const mutationKeys = {
  businessUnitContext: ["business-unit-context"] as const,
};

const markQueriesStaleWithoutRefetch = (client: QueryClient, queryKeysToInvalidate: QueryKey[]) => {
  for (const queryKey of queryKeysToInvalidate) {
    void client.invalidateQueries({ queryKey, refetchType: "none" });
  }
};

const useCurrentBusinessUnitId = () =>
  useAuthStore((state) => state.session?.currentBusinessUnit?.id || "");

const markGrnReceivingSummariesStale = (client: QueryClient, businessUnitId: string) =>
  markQueriesStaleWithoutRefetch(client, [
    queryKeys.loadListsScope(businessUnitId),
    queryKeys.dashboard(businessUnitId),
  ]);

const markDeliveryNoteReceivingSummariesStale = (client: QueryClient, businessUnitId: string) =>
  markQueriesStaleWithoutRefetch(client, [
    queryKeys.deliveryNotesScope(businessUnitId),
    queryKeys.dashboard(businessUnitId),
  ]);

export const useBusinessUnits = () => {
  const session = useAuthStore((state) => state.session);
  const companyId = session?.user.companyId || "";
  const userId = session?.user.id || "";

  return useQuery({
    queryKey: queryKeys.businessUnits(companyId, userId),
    queryFn: businessUnitsApi.listBusinessUnits,
    enabled: Boolean(companyId) && Boolean(userId),
    staleTime: BUSINESS_UNITS_STALE_TIME_MS,
    gcTime: BUSINESS_UNITS_GC_TIME_MS,
  });
};

export const useSetBusinessUnit = () => {
  const client = useQueryClient();
  const setSession = useAuthStore((state) => state.setSession);
  const setBusinessUnitSwitching = useAuthStore((state) => state.setBusinessUnitSwitching);

  return useMutation({
    mutationKey: mutationKeys.businessUnitContext,
    mutationFn: businessUnitsApi.setBusinessUnitContext,
    onMutate: async () => {
      const previousBusinessUnitId = useAuthStore.getState().session?.currentBusinessUnit?.id || "";
      setBusinessUnitSwitching(true);
      if (previousBusinessUnitId) {
        await client.cancelQueries({
          queryKey: queryKeys.businessUnitScope(previousBusinessUnitId),
        });
      }
      return { previousBusinessUnitId };
    },
    onSuccess: async (result, _businessUnitId, mutationContext) => {
      const session = useAuthStore.getState().session;
      if (session) {
        await setSession({
          ...session,
          token: result.token,
          refreshToken: result.refreshToken,
          cookieHeader: result.cookieHeader,
          permissions: result.permissions,
          capabilities: result.capabilities,
          currentBusinessUnit: {
            id: result.business_unit.id,
            code: result.business_unit.code,
            name: result.business_unit.name,
          },
        });
      }

      if (mutationContext?.previousBusinessUnitId) {
        client.removeQueries({
          queryKey: queryKeys.businessUnitScope(mutationContext.previousBusinessUnitId),
        });
      }
    },
    onSettled: () => {
      setBusinessUnitSwitching(false);
    },
  });
};

const syncPickListCaches = (
  client: QueryClient,
  businessUnitId: string,
  updated: PickListDetail
) => {
  client.setQueryData(queryKeys.pickList(businessUnitId, updated.id), updated);

  const listCaches = client.getQueriesData<PickListSummary[]>({
    queryKey: queryKeys.pickListsScope(businessUnitId),
  });
  for (const [queryKey, cached] of listCaches) {
    if (!cached) continue;
    client.setQueryData(
      queryKey,
      cached.map((row) =>
        row.id === updated.id
          ? {
              ...row,
              code: updated.code || row.code,
              status: updated.status,
              lines: updated.lines,
              requiredDate: updated.requiredDate,
            }
          : row
      )
    );
  }
};

export const useDashboard = (enabled = true) => {
  const businessUnitId = useCurrentBusinessUnitId();
  return useQuery({
    queryKey: queryKeys.dashboard(businessUnitId),
    queryFn: dashboardApi.getDashboard,
    enabled: enabled && Boolean(businessUnitId),
  });
};

export const usePickLocationMap = (
  pickListId: string,
  pickListItemId: string | null,
  enabled = true
) => {
  const client = useQueryClient();
  const businessUnitId = useCurrentBusinessUnitId();
  const itemId = pickListItemId || "";

  return useQuery({
    queryKey: queryKeys.pickLocationMap(businessUnitId, pickListId, itemId),
    queryFn: async () => {
      const locationMap = await pickingApi.getPickLocationMap(pickListId, itemId);
      const assetKey = queryKeys.warehouseFloorMapAsset(
        businessUnitId,
        locationMap.map.id,
        locationMap.map.version
      );
      const cachedMap = client.getQueryData<pickingApi.PickLocationMap["map"]>(assetKey);

      if (cachedMap) {
        return {
          ...locationMap,
          map: {
            ...locationMap.map,
            imageUrl: cachedMap.imageUrl,
          },
        };
      }

      client.setQueryData(assetKey, locationMap.map);
      return locationMap;
    },
    enabled: enabled && Boolean(businessUnitId) && Boolean(pickListId) && Boolean(pickListItemId),
    staleTime: PICK_LOCATION_MAP_STALE_TIME_MS,
    gcTime: PICK_LOCATION_MAP_GC_TIME_MS,
  });
};

export const useLoadLists = (status: string, search: string, enabled = true) => {
  const businessUnitId = useCurrentBusinessUnitId();
  return useQuery({
    queryKey: queryKeys.loadLists(businessUnitId, status, search),
    queryFn: () => receivingApi.listLoadLists(status, search),
    enabled: enabled && Boolean(businessUnitId),
  });
};

export const useLoadListReceiving = (
  id: string,
  options: { enabled?: boolean; includeGrn?: boolean } = {}
) => {
  const businessUnitId = useCurrentBusinessUnitId();
  const includeGrn = options.includeGrn === true;

  return useQuery({
    queryKey: queryKeys.loadListReceiving(businessUnitId, id, includeGrn),
    queryFn: () => receivingApi.getLoadListReceiving(id, includeGrn),
    enabled: Boolean(businessUnitId) && Boolean(id) && options.enabled !== false,
  });
};

export const useUpdateGrnReceiving = (loadListId: string, grnId: string) => {
  const client = useQueryClient();
  const businessUnitId = useCurrentBusinessUnitId();
  return useMutation({
    mutationFn: (data: UpdateGrnReceivingPayload) => receivingApi.updateGrnReceiving(grnId, data),
    onSuccess: (updated) => {
      client.setQueryData<LoadListReceivingDetail | undefined>(
        queryKeys.loadListReceiving(businessUnitId, loadListId, true),
        (cached) => {
          if (!cached) return cached;
          return {
            ...cached,
            grn: updated,
          };
        }
      );
      markGrnReceivingSummariesStale(client, businessUnitId);
    },
  });
};

export const useStartGrnReceiving = (loadListId: string, grnId: string) => {
  const client = useQueryClient();
  const businessUnitId = useCurrentBusinessUnitId();
  return useMutation({
    mutationFn: () => receivingApi.startGrnReceiving(grnId),
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: queryKeys.loadListReceivingScope(businessUnitId, loadListId),
      });
      markGrnReceivingSummariesStale(client, businessUnitId);
    },
  });
};

export const usePauseGrnReceiving = (loadListId: string, grnId: string) => {
  const client = useQueryClient();
  const businessUnitId = useCurrentBusinessUnitId();
  return useMutation({
    mutationFn: () => receivingApi.pauseGrnReceiving(grnId),
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: queryKeys.loadListReceivingScope(businessUnitId, loadListId),
      });
      markGrnReceivingSummariesStale(client, businessUnitId);
    },
  });
};

export const useSubmitGrnReceiving = (loadListId: string, grnId: string) => {
  const client = useQueryClient();
  const businessUnitId = useCurrentBusinessUnitId();
  return useMutation({
    mutationFn: (data: SubmitGrnReceivingPayload) => receivingApi.submitGrnReceiving(grnId, data),
    onSuccess: (updated) => {
      client.setQueryData<LoadListReceivingDetail | undefined>(
        queryKeys.loadListReceiving(businessUnitId, loadListId, true),
        (cached) => {
          if (!cached) return cached;
          return {
            ...cached,
            grn: updated,
          };
        }
      );
      markGrnReceivingSummariesStale(client, businessUnitId);
    },
  });
};

export const useDeliveryNotes = (status: string, search: string, enabled = true) => {
  const businessUnitId = useCurrentBusinessUnitId();
  return useQuery({
    queryKey: queryKeys.deliveryNotes(businessUnitId, status, search),
    queryFn: () => receivingApi.listDeliveryNotes(status, search),
    enabled: enabled && Boolean(businessUnitId),
  });
};

export const useDeliveryNote = (id: string, enabled = true) => {
  const businessUnitId = useCurrentBusinessUnitId();
  return useQuery({
    queryKey: queryKeys.deliveryNote(businessUnitId, id),
    queryFn: () => receivingApi.getDeliveryNote(id),
    enabled: Boolean(businessUnitId) && Boolean(id) && enabled,
  });
};

export const useReceivingWarehouses = (enabled = true) => {
  const businessUnitId = useCurrentBusinessUnitId();
  return useQuery({
    queryKey: queryKeys.receivingWarehouses(businessUnitId),
    queryFn: receivingApi.listReceivingWarehouses,
    enabled: enabled && Boolean(businessUnitId),
  });
};

export const useScannedItemInfo = (payload: string, enabled = true) => {
  const businessUnitId = useCurrentBusinessUnitId();
  return useQuery({
    queryKey: queryKeys.scannedItemInfo(businessUnitId, payload),
    queryFn: () => itemInfoApi.getScannedItemInfo(payload),
    enabled: enabled && Boolean(businessUnitId) && Boolean(payload.trim()),
  });
};

export const useStartReceiving = (id: string) => {
  const client = useQueryClient();
  const businessUnitId = useCurrentBusinessUnitId();
  return useMutation({
    mutationFn: (receivingWarehouseId: string) =>
      receivingApi.startReceiving(id, receivingWarehouseId),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: queryKeys.deliveryNote(businessUnitId, id) });
    },
  });
};

export const useRecordDeliveryNoteReceivingScan = (id: string) => {
  const client = useQueryClient();
  const businessUnitId = useCurrentBusinessUnitId();
  return useMutation({
    mutationFn: (data: RecordDeliveryNoteReceivingScanPayload) =>
      receivingApi.recordDeliveryNoteReceivingScan(id, data),
    onSuccess: (response) => {
      client.setQueryData(queryKeys.deliveryNote(businessUnitId, id), response.deliveryNote);
      markDeliveryNoteReceivingSummariesStale(client, businessUnitId);
    },
  });
};

export const useVoidDeliveryNoteReceivingScan = (id: string) => {
  const client = useQueryClient();
  const businessUnitId = useCurrentBusinessUnitId();
  return useMutation({
    mutationFn: (scanId: string) => receivingApi.voidDeliveryNoteReceivingScan(id, scanId),
    onSuccess: (updated) => {
      client.setQueryData(queryKeys.deliveryNote(businessUnitId, id), updated);
      markDeliveryNoteReceivingSummariesStale(client, businessUnitId);
    },
  });
};

export const useSubmitReceiving = (id: string) => {
  const client = useQueryClient();
  const businessUnitId = useCurrentBusinessUnitId();
  return useMutation({
    mutationFn: (data: SubmitDeliveryNoteReceivingPayload) =>
      receivingApi.submitReceiving(id, data),
    onSuccess: (updated) => {
      client.setQueryData(queryKeys.deliveryNote(businessUnitId, id), updated);
      markDeliveryNoteReceivingSummariesStale(client, businessUnitId);
    },
  });
};

export const usePickLists = (status: string, search: string, enabled = true) => {
  const businessUnitId = useCurrentBusinessUnitId();
  return useQuery({
    queryKey: queryKeys.pickLists(businessUnitId, status, search),
    queryFn: () => pickingApi.listPickLists({ status, search }),
    enabled: enabled && Boolean(businessUnitId),
  });
};

export const usePickList = (id: string, enabled = true) => {
  const businessUnitId = useCurrentBusinessUnitId();
  return useQuery({
    queryKey: queryKeys.pickList(businessUnitId, id),
    queryFn: () => pickingApi.getPickList(id),
    enabled: Boolean(businessUnitId) && Boolean(id) && enabled,
  });
};

export const usePickListRealtime = (id: string, enabled = true) => {
  const client = useQueryClient();
  const token = useAuthStore((state) => state.session?.token || "");
  const businessUnitId = useCurrentBusinessUnitId();

  useEffect(() => {
    if (!businessUnitId || !id || !enabled || !token) return;
    let cancelled = false;
    let removeChannel: (() => Promise<unknown>) | null = null;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    const refresh = async () => {
      void client.invalidateQueries({ queryKey: queryKeys.pickList(businessUnitId, id) });
    };

    const startFallback = () => {
      if (fallbackInterval || cancelled) return;
      fallbackInterval = setInterval(refresh, 5_000);
    };

    void getRealtimeConfig()
      .then((config) => {
        if (cancelled) return;
        const supabase = getRealtimeClient(config, token);
        const channel = supabase
          .channel(`mobile-pick-list-${id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "pick_list_item_claims",
              filter: `pick_list_id=eq.${id}`,
            },
            refresh
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "pick_list_items",
              filter: `pick_list_id=eq.${id}`,
            },
            refresh
          )
          .subscribe((status) => {
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
              startFallback();
            }
            if (status === "SUBSCRIBED" && fallbackInterval) {
              clearInterval(fallbackInterval);
              fallbackInterval = null;
            }
          });
        removeChannel = () => supabase.removeChannel(channel);
      })
      .catch(startFallback);

    return () => {
      cancelled = true;
      if (fallbackInterval) clearInterval(fallbackInterval);
      if (removeChannel) void removeChannel();
    };
  }, [businessUnitId, client, enabled, id, token]);
};

export const useSetPickListStatus = (id: string) => {
  const client = useQueryClient();
  const businessUnitId = useCurrentBusinessUnitId();
  return useMutation({
    mutationFn: (status: "in_progress" | "paused" | "done") =>
      pickingApi.setPickListStatus(id, status),
    onSuccess: async (updated) => {
      syncPickListCaches(client, businessUnitId, updated);
      await client.invalidateQueries({ queryKey: queryKeys.pickList(businessUnitId, id) });
      await client.invalidateQueries({ queryKey: queryKeys.dashboard(businessUnitId) });
    },
  });
};

export const useUpdatePickedItems = (id: string) => {
  const client = useQueryClient();
  const businessUnitId = useCurrentBusinessUnitId();
  return useMutation({
    mutationFn: (
      items: {
        pickListItemId: string;
        deliveryNoteItemId: string;
        pickedQty: number;
        batchLocationSku?: string | null;
        pickedLocationId?: string | null;
        pickedBatchCode?: string | null;
        pickedBatchReceivedAt?: string | null;
        isMismatchWarningAcknowledged?: boolean;
        mismatchReason?: string | null;
      }[]
    ) => pickingApi.updatePickedItems(id, items),
    onSuccess: async (updated) => {
      syncPickListCaches(client, businessUnitId, updated);
      await client.invalidateQueries({ queryKey: queryKeys.pickList(businessUnitId, id) });
      await client.invalidateQueries({ queryKey: queryKeys.dashboard(businessUnitId) });
    },
  });
};

export const useRecordPickProgress = (id: string) => {
  const client = useQueryClient();
  const businessUnitId = useCurrentBusinessUnitId();
  return useMutation({
    mutationFn: (item: pickingApi.RecordPickProgressInput) =>
      pickingApi.recordPickProgress(id, item),
    onSuccess: (updated) => {
      syncPickListCaches(client, businessUnitId, updated);
      void Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.pickList(businessUnitId, id) }),
        client.invalidateQueries({ queryKey: queryKeys.dashboard(businessUnitId) }),
      ]).catch(() => undefined);
    },
  });
};

export const useCompletePickList = (id: string) => {
  const client = useQueryClient();
  const businessUnitId = useCurrentBusinessUnitId();
  return useMutation({
    mutationFn: () => pickingApi.completePickList(id),
    onSuccess: async (updated) => {
      syncPickListCaches(client, businessUnitId, updated);
      await client.invalidateQueries({ queryKey: queryKeys.pickList(businessUnitId, id) });
      await client.invalidateQueries({ queryKey: queryKeys.dashboard(businessUnitId) });
    },
  });
};
