import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { deliveryNotesApi } from "@/lib/api/delivery-notes";
import { PICK_LISTS_QUERY_KEY, DELIVERY_NOTES_QUERY_KEY } from "@/hooks/queryKeys";
import { useInventoryRealtimeInvalidation } from "@/hooks/useInventoryRealtimeInvalidation";
import type {
  AddDeliveryNoteItemsPayload,
  AdjustDispatchedDeliveryNoteItemPayload,
  CreateDeliveryNotePayload,
  DispatchDeliveryNotePayload,
  MarkDispatchReadyPayload,
  DeliveryNoteFulfillmentMode,
  ReceiveDeliveryNotePayload,
} from "@/types/delivery-note";

export { DELIVERY_NOTES_QUERY_KEY };

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export function useDeliveryNotes(status?: string) {
  useInventoryRealtimeInvalidation([DELIVERY_NOTES_QUERY_KEY, PICK_LISTS_QUERY_KEY]);

  return useQuery({
    queryKey: [DELIVERY_NOTES_QUERY_KEY, status],
    queryFn: () => deliveryNotesApi.list(status),
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
  useInventoryRealtimeInvalidation([DELIVERY_NOTES_QUERY_KEY, PICK_LISTS_QUERY_KEY], !!id && enabled);

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
      toast.success("Delivery note created");
    },
    onError: (error: unknown) => {
      queryClient.invalidateQueries({ queryKey: ["stock-requests"] });
      toast.error(getErrorMessage(error, "Failed to create delivery note"));
    },
  });
}

export function useConfirmDeliveryNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deliveryNotesApi.confirm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY] });
      toast.success("Delivery note confirmed");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to confirm delivery note"));
    },
  });
}

export function useStartPickingDeliveryNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deliveryNotesApi.startPicking(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY] });
      toast.success("Picking started");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to start picking"));
    },
  });
}

export function useQueuePickingDeliveryNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deliveryNotesApi.queuePicking(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY] });
      toast.success("Delivery note queued for picking");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to queue delivery note for picking"));
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
      toast.success("Delivery note marked dispatch-ready");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to mark dispatch-ready"));
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
      toast.success("Delivery note dispatched");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to dispatch delivery note"));
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
      toast.success("Delivery note received");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to receive delivery note"));
    },
  });
}

export function useVoidDeliveryNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => deliveryNotesApi.void(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY] });
      toast.success("Delivery note voided");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to void delivery note"));
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
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY, variables.id, "allocatable-items"] });
      queryClient.invalidateQueries({ queryKey: [PICK_LISTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["stock-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["stock-balances"] });
      queryClient.invalidateQueries({ queryKey: ["stock-requests"] });
      toast.success("Delivery note item adjusted");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to adjust delivery note item"));
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
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY, variables.id, "allocatable-items"] });
      queryClient.invalidateQueries({ queryKey: [PICK_LISTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["stock-requests"] });
      toast.success("Delivery note items added and queued for picking");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to add delivery note items"));
    },
  });
}
