import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deliveryNotesApi } from "@/lib/api/delivery-notes";
import { PICK_LISTS_QUERY_KEY, DELIVERY_NOTES_QUERY_KEY } from "@/hooks/queryKeys";
import { useInventoryRealtimeInvalidation } from "@/hooks/useInventoryRealtimeInvalidation";
import type {
  AddDeliveryNoteItemsPayload,
  AdjustDispatchedDeliveryNoteItemPayload,
  CreateDeliveryNotePayload,
  DeliveryNoteListParams,
  DispatchDeliveryNotePayload,
  MarkDispatchReadyPayload,
  DeliveryNoteFulfillmentMode,
  RecordDeliveryNoteReceivingScanPayload,
  ReceiveDeliveryNotePayload,
  SubmitDeliveryNoteReceivingPayload,
} from "@/types/delivery-note";

export { DELIVERY_NOTES_QUERY_KEY };

export function useDeliveryNotes(params?: string | DeliveryNoteListParams) {
  useInventoryRealtimeInvalidation([DELIVERY_NOTES_QUERY_KEY, PICK_LISTS_QUERY_KEY]);

  return useQuery({
    queryKey: [DELIVERY_NOTES_QUERY_KEY, params],
    queryFn: () => deliveryNotesApi.list(params),
  });
}

export function useDeliveryNote(id: string) {
  useInventoryRealtimeInvalidation([DELIVERY_NOTES_QUERY_KEY, PICK_LISTS_QUERY_KEY], !!id);

  return useQuery({
    queryKey: [DELIVERY_NOTES_QUERY_KEY, id],
    queryFn: () => deliveryNotesApi.getById(id),
    enabled: !!id,
  });
}

export function useDeliveryNoteAllocatableItems(id: string, enabled = true) {
  useInventoryRealtimeInvalidation(
    [DELIVERY_NOTES_QUERY_KEY, PICK_LISTS_QUERY_KEY],
    !!id && enabled
  );

  return useQuery({
    queryKey: [DELIVERY_NOTES_QUERY_KEY, id, "allocatable-items"],
    queryFn: () => deliveryNotesApi.getAllocatableItems(id),
    enabled: !!id && enabled,
  });
}

export function useCreateDeliveryNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateDeliveryNotePayload) => deliveryNotesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["stock-requests"] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-requests"] });
    },
  });
}

export function useConfirmDeliveryNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deliveryNotesApi.confirm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY] });
    },
  });
}

export function useStartPickingDeliveryNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deliveryNotesApi.startPicking(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY] });
    },
  });
}

export function useQueuePickingDeliveryNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deliveryNotesApi.queuePicking(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY] });
    },
  });
}

export function useMarkDispatchReadyDeliveryNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: MarkDispatchReadyPayload }) =>
      deliveryNotesApi.markDispatchReady(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY] });
    },
  });
}

export function useDispatchDeliveryNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DispatchDeliveryNotePayload }) =>
      deliveryNotesApi.dispatch(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["stock-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["stock-balances"] });
    },
  });
}

export function useReceiveDeliveryNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
      fulfillmentMode,
    }: {
      id: string;
      data?: ReceiveDeliveryNotePayload;
      fulfillmentMode?: DeliveryNoteFulfillmentMode;
    }) =>
      fulfillmentMode === "customer_pickup_from_warehouse"
        ? deliveryNotesApi.receiveDirectPickup(id, data)
        : deliveryNotesApi.receive(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["stock-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["stock-balances"] });
    },
  });
}

export function useStartReceivingDeliveryNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deliveryNotesApi.startReceiving(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY, id] });
    },
  });
}

export function useRecordDeliveryNoteReceivingScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RecordDeliveryNoteReceivingScanPayload }) =>
      deliveryNotesApi.recordReceivingScan(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY, variables.id] });
    },
  });
}

export function useVoidDeliveryNoteReceivingScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, scanId, reason }: { id: string; scanId: string; reason?: string }) =>
      deliveryNotesApi.voidReceivingScan(id, scanId, reason),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY, variables.id] });
    },
  });
}

export function useSubmitDeliveryNoteReceiving() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: SubmitDeliveryNoteReceivingPayload }) =>
      deliveryNotesApi.submitReceiving(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY, variables.id] });
      queryClient.invalidateQueries({ queryKey: ["stock-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["stock-balances"] });
      queryClient.invalidateQueries({ queryKey: ["stock-requests"] });
    },
  });
}

export function useAcceptDeliveryNoteReceivingException() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      exceptionId,
      notes,
    }: {
      id: string;
      exceptionId: string;
      notes?: string | null;
    }) => deliveryNotesApi.acceptReceivingException(id, exceptionId, { notes }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY, variables.id] });
      queryClient.invalidateQueries({ queryKey: ["stock-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["stock-balances"] });
    },
  });
}

export function useRejectDeliveryNoteReceivingException() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      exceptionId,
      notes,
    }: {
      id: string;
      exceptionId: string;
      notes?: string | null;
    }) => deliveryNotesApi.rejectReceivingException(id, exceptionId, { notes }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY, variables.id] });
    },
  });
}

export function useAcceptDeliveryNoteReceivingOverage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      itemId,
      notes,
    }: {
      id: string;
      itemId: string;
      notes?: string | null;
    }) => deliveryNotesApi.acceptReceivingOverage(id, itemId, { notes }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY, variables.id] });
      queryClient.invalidateQueries({ queryKey: ["stock-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["stock-balances"] });
    },
  });
}

export function useRejectDeliveryNoteReceivingOverage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      itemId,
      notes,
    }: {
      id: string;
      itemId: string;
      notes?: string | null;
    }) => deliveryNotesApi.rejectReceivingOverage(id, itemId, { notes }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY, variables.id] });
    },
  });
}

export function useVoidDeliveryNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      deliveryNotesApi.void(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY] });
    },
  });
}

export function useAdjustDispatchedDeliveryNoteItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      itemId,
      data,
    }: {
      id: string;
      itemId: string;
      data: AdjustDispatchedDeliveryNoteItemPayload;
    }) => deliveryNotesApi.adjustItem(id, itemId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY] });
      queryClient.invalidateQueries({
        queryKey: [DELIVERY_NOTES_QUERY_KEY, variables.id, "allocatable-items"],
      });
      queryClient.invalidateQueries({ queryKey: [PICK_LISTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["stock-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["stock-balances"] });
      queryClient.invalidateQueries({ queryKey: ["stock-requests"] });
    },
  });
}

export function useAddDeliveryNoteItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AddDeliveryNoteItemsPayload }) =>
      deliveryNotesApi.addItems(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY] });
      queryClient.invalidateQueries({
        queryKey: [DELIVERY_NOTES_QUERY_KEY, variables.id, "allocatable-items"],
      });
      queryClient.invalidateQueries({ queryKey: [PICK_LISTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["stock-requests"] });
    },
  });
}
