import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import * as businessUnitsApi from "@/api/businessUnits";
import * as dashboardApi from "@/api/dashboard";
import * as itemInfoApi from "@/api/itemInfo";
import * as pickingApi from "@/api/picking";
import * as receivingApi from "@/api/receiving";
import { useAuthStore } from "@/stores/authStore";
import type { DashboardData } from "@/contracts/dashboard";
import type { PickListDetail, PickListSummary } from "@/contracts/picking";
import type {
  LoadListReceivingDetail,
  RecordDeliveryNoteReceivingScanPayload,
  SubmitDeliveryNoteReceivingPayload,
  UpdateGrnReceivingPayload
} from "@/contracts/receiving";

export const queryKeys = {
  businessUnits: ["business-units"] as const,
  dashboard: ["dashboard"] as const,
  receivingWarehouse: (businessUnitId: string) => ["receiving-warehouse", businessUnitId] as const,
  loadLists: (status: string, search: string, warehouseId: string) =>
    ["load-lists", status, search, warehouseId] as const,
  loadListReceivingScope: (id: string) => ["load-list-receiving", id] as const,
  loadListReceiving: (id: string, includeGrn: boolean) =>
    [...queryKeys.loadListReceivingScope(id), includeGrn] as const,
  deliveryNotes: (status: string, search: string) => ["delivery-notes", status, search] as const,
  deliveryNote: (id: string) => ["delivery-note", id] as const,
  scannedItemInfo: (payload: string) => ["scanned-item-info", payload] as const,
  pickLists: (status: string, search: string) => ["pick-lists", status, search] as const,
  pickList: (id: string) => ["pick-list", id] as const
};

export const mutationKeys = {
  businessUnitContext: ["business-unit-context"] as const
};

export const useBusinessUnits = () =>
  useQuery({
    queryKey: queryKeys.businessUnits,
    queryFn: businessUnitsApi.listBusinessUnits
  });

export const useSetBusinessUnit = () => {
  const client = useQueryClient();
  const setSession = useAuthStore((state) => state.setSession);
  const setBusinessUnitSwitching = useAuthStore((state) => state.setBusinessUnitSwitching);

  return useMutation({
    mutationKey: mutationKeys.businessUnitContext,
    mutationFn: businessUnitsApi.setBusinessUnitContext,
    onMutate: async () => {
      setBusinessUnitSwitching(true);
      await client.cancelQueries({ queryKey: ["receiving-warehouse"] });
      await client.cancelQueries({ queryKey: ["load-lists"] });
      await client.cancelQueries({ queryKey: ["load-list-receiving"] });
    },
    onSuccess: async (result) => {
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
            name: result.business_unit.name
          }
        });
      }

      client.removeQueries({ queryKey: queryKeys.dashboard });
      client.removeQueries({ queryKey: ["receiving-warehouse"] });
      client.removeQueries({ queryKey: ["load-lists"] });
      client.removeQueries({ queryKey: ["load-list-receiving"] });
      client.removeQueries({ queryKey: ["delivery-notes"] });
      client.removeQueries({ queryKey: ["delivery-note"] });
      client.removeQueries({ queryKey: ["pick-lists"] });
      client.removeQueries({ queryKey: ["pick-list"] });
      await client.invalidateQueries({ queryKey: queryKeys.businessUnits });
    },
    onSettled: () => {
      setBusinessUnitSwitching(false);
    }
  });
};

const syncPickListCaches = (client: QueryClient, updated: PickListDetail) => {
  client.setQueryData(queryKeys.pickList(updated.id), updated);

  const listCaches = client.getQueriesData<PickListSummary[]>({ queryKey: ["pick-lists"] });
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
              requiredDate: updated.requiredDate
            }
          : row
      )
    );
  }

  client.setQueryData<DashboardData | undefined>(queryKeys.dashboard, (cached) => {
    if (!cached) return cached;
    return {
      ...cached,
      queues: {
        ...cached.queues,
        pick_list: cached.queues.pick_list.map((row) =>
          row.id === updated.id ? { ...row, status: updated.status } : row
        )
      }
    };
  });
};

export const useDashboard = () =>
  useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: dashboardApi.getDashboard
  });

export const useReceivingWarehouse = (businessUnitId?: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.receivingWarehouse(businessUnitId || ""),
    queryFn: receivingApi.getReceivingWarehouse,
    enabled: Boolean(businessUnitId) && enabled
  });

export const useLoadLists = (status: string, search: string, warehouseId?: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.loadLists(status, search, warehouseId || ""),
    queryFn: () => receivingApi.listLoadLists(status, search, warehouseId || ""),
    enabled: Boolean(warehouseId) && enabled
  });

export const useLoadListReceiving = (
  id: string,
  options: { enabled?: boolean; includeGrn?: boolean } = {}
) => {
  const includeGrn = options.includeGrn === true;

  return useQuery({
    queryKey: queryKeys.loadListReceiving(id, includeGrn),
    queryFn: () => receivingApi.getLoadListReceiving(id, includeGrn),
    enabled: Boolean(id) && options.enabled !== false
  });
};

export const useUpdateGrnReceiving = (loadListId: string, grnId: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateGrnReceivingPayload) => receivingApi.updateGrnReceiving(grnId, data),
    onSuccess: async (updated) => {
      client.setQueryData<LoadListReceivingDetail | undefined>(
        queryKeys.loadListReceiving(loadListId, true),
        (cached) => {
          if (!cached) return cached;
          return {
            ...cached,
            grn: updated
          };
        }
      );
      await client.invalidateQueries({ queryKey: ["load-lists"] });
      await client.invalidateQueries({ queryKey: queryKeys.dashboard });
    }
  });
};

export const useStartGrnReceiving = (loadListId: string, grnId: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => receivingApi.startGrnReceiving(grnId),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: queryKeys.loadListReceivingScope(loadListId) });
      await client.invalidateQueries({ queryKey: ["load-lists"] });
      await client.invalidateQueries({ queryKey: queryKeys.dashboard });
    }
  });
};

export const usePauseGrnReceiving = (loadListId: string, grnId: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => receivingApi.pauseGrnReceiving(grnId),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: queryKeys.loadListReceivingScope(loadListId) });
      await client.invalidateQueries({ queryKey: ["load-lists"] });
      await client.invalidateQueries({ queryKey: queryKeys.dashboard });
    }
  });
};

export const useSubmitGrnReceiving = (loadListId: string, grnId: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => receivingApi.submitGrnReceiving(grnId),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: queryKeys.loadListReceivingScope(loadListId) });
      await client.invalidateQueries({ queryKey: ["load-lists"] });
      await client.invalidateQueries({ queryKey: queryKeys.dashboard });
    }
  });
};

export const useDeliveryNotes = (status: string, search: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.deliveryNotes(status, search),
    queryFn: () => receivingApi.listDeliveryNotes(status, search),
    enabled
  });

export const useDeliveryNote = (id: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.deliveryNote(id),
    queryFn: () => receivingApi.getDeliveryNote(id),
    enabled: Boolean(id) && enabled
  });

export const useScannedItemInfo = (payload: string) =>
  useQuery({
    queryKey: queryKeys.scannedItemInfo(payload),
    queryFn: () => itemInfoApi.getScannedItemInfo(payload),
    enabled: Boolean(payload.trim())
  });

export const useStartReceiving = (id: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => receivingApi.startReceiving(id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: queryKeys.deliveryNote(id) });
    }
  });
};

export const useRecordDeliveryNoteReceivingScan = (id: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: RecordDeliveryNoteReceivingScanPayload) =>
      receivingApi.recordDeliveryNoteReceivingScan(id, data),
    onSuccess: async (response) => {
      client.setQueryData(queryKeys.deliveryNote(id), response.deliveryNote);
      await client.invalidateQueries({ queryKey: ["delivery-notes"] });
      await client.invalidateQueries({ queryKey: queryKeys.dashboard });
    }
  });
};

export const useSubmitReceiving = (id: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: SubmitDeliveryNoteReceivingPayload) => receivingApi.submitReceiving(id, data),
    onSuccess: async (updated) => {
      client.setQueryData(queryKeys.deliveryNote(id), updated);
      await client.invalidateQueries({ queryKey: ["delivery-notes"] });
      await client.invalidateQueries({ queryKey: queryKeys.dashboard });
    }
  });
};

export const usePickLists = (status: string, search: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.pickLists(status, search),
    queryFn: () => pickingApi.listPickLists({ status, search }),
    enabled
  });

export const usePickList = (id: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.pickList(id),
    queryFn: () => pickingApi.getPickList(id),
    enabled: Boolean(id) && enabled
  });

export const useSetPickListStatus = (id: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (status: "in_progress" | "paused" | "done") =>
      pickingApi.setPickListStatus(id, status),
    onSuccess: async (updated) => {
      syncPickListCaches(client, updated);
      await client.invalidateQueries({ queryKey: queryKeys.pickList(id) });
      await client.invalidateQueries({ queryKey: queryKeys.dashboard });
    }
  });
};

export const useUpdatePickedItems = (id: string) => {
  const client = useQueryClient();
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
      }[]
    ) =>
      pickingApi.updatePickedItems(id, items),
    onSuccess: async (updated) => {
      syncPickListCaches(client, updated);
      await client.invalidateQueries({ queryKey: queryKeys.pickList(id) });
      await client.invalidateQueries({ queryKey: queryKeys.dashboard });
    }
  });
};

export const useCompletePickList = (id: string) => {
  const client = useQueryClient();
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
      }[]
    ) => pickingApi.completePickList(id, items),
    onSuccess: async (updated) => {
      syncPickListCaches(client, updated);
      await client.invalidateQueries({ queryKey: queryKeys.pickList(id) });
      await client.invalidateQueries({ queryKey: queryKeys.dashboard });
    }
  });
};
