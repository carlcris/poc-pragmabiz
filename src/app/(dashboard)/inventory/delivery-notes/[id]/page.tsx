"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertCircle,
  CheckCircle2,
  Package2,
  Pencil,
  Plus,
  TrendingDown,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAddDeliveryNoteItems,
  useAdjustDispatchedDeliveryNoteItem,
  useAcceptDeliveryNoteReceivingException,
  useAcceptDeliveryNoteReceivingOverage,
  useConfirmDeliveryNote,
  useDeliveryNote,
  useDeliveryNoteAllocatableItems,
  useDispatchDeliveryNote,
  useReceiveDeliveryNote,
  useRejectDeliveryNoteReceivingException,
  useRejectDeliveryNoteReceivingOverage,
  useVoidDeliveryNote,
} from "@/hooks/useDeliveryNotes";
import type { ItemUnitOption } from "@/types/item";
import { useCreatePickList } from "@/hooks/usePickLists";
import { useUsers } from "@/hooks/useUsers";
import { useWarehouse } from "@/hooks/useWarehouses";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import { getPickListBatchAllocationChoiceError } from "@/lib/api/pick-lists";
import { EmptyStatePanel } from "@/components/shared/EmptyStatePanel";
import { MetricCard } from "@/components/shared/MetricCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { BatchAllocationChoiceDialog } from "@/components/delivery-notes/BatchAllocationChoiceDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toProperCase } from "@/lib/string";
import { transformItemUnitOptionRow, type DbItemUnitOptionRow } from "@/lib/items/itemUnitOptions";
import type {
  CreatePickListPayload,
  PickListBatchAllocationChoiceError,
  PickListBatchAllocationMode,
} from "@/types/pick-list";

const formatDate = (value: string | null | undefined, locale: string) => {
  if (!value) return "--";
  return new Date(value).toLocaleString(locale);
};

const formatDeliveryTime = (value: string | null | undefined) => {
  if (!value) return "--";
  return value.slice(0, 5);
};

const toNumber = (value: number | string | null | undefined) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatQty = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2));

const getMutationErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export default function DeliveryNoteDetailPage() {
  const params = useParams();
  const locale = useLocale();
  const t = useTranslations("deliveryNoteDetailPage");
  const id = params.id as string;
  const currentBusinessUnit = useBusinessUnitStore((state) => state.currentBusinessUnit);

  const { data: dn, isLoading, error } = useDeliveryNote(id);
  const { data: allocatableItemsData, isLoading: isAllocatableItemsLoading } =
    useDeliveryNoteAllocatableItems(id, true);

  const confirmMutation = useConfirmDeliveryNote();
  const createPickListMutation = useCreatePickList();
  const adjustItemMutation = useAdjustDispatchedDeliveryNoteItem();
  const addItemsMutation = useAddDeliveryNoteItems();
  const dispatchMutation = useDispatchDeliveryNote();
  const receiveMutation = useReceiveDeliveryNote();
  const voidMutation = useVoidDeliveryNote();
  const acceptExceptionMutation = useAcceptDeliveryNoteReceivingException();
  const rejectExceptionMutation = useRejectDeliveryNoteReceivingException();
  const acceptOverageMutation = useAcceptDeliveryNoteReceivingOverage();
  const rejectOverageMutation = useRejectDeliveryNoteReceivingOverage();
  const { data: usersData } = useUsers();

  const [queueOpen, setQueueOpen] = useState(false);
  const [queuePickerSearch, setQueuePickerSearch] = useState("");
  const [queueNotes, setQueueNotes] = useState("");
  const [selectedQueuePickerIds, setSelectedQueuePickerIds] = useState<Set<string>>(new Set());
  const [pendingPickListPayload, setPendingPickListPayload] =
    useState<CreatePickListPayload | null>(null);
  const [batchAllocationChoice, setBatchAllocationChoice] =
    useState<PickListBatchAllocationChoiceError | null>(null);

  const [adjustItemId, setAdjustItemId] = useState<string | null>(null);
  const [adjustDispatchedQty, setAdjustDispatchedQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const [addItemsOpen, setAddItemsOpen] = useState(false);
  const [addItemSearch, setAddItemSearch] = useState("");
  const [addItemNotes, setAddItemNotes] = useState("");
  const [selectedAddPickerIds, setSelectedAddPickerIds] = useState<Set<string>>(new Set());
  const [selectedAddQtyMap, setSelectedAddQtyMap] = useState<Record<string, string>>({});

  const [receivedQtyMap, setReceivedQtyMap] = useState<Record<string, number>>({});
  const [driverName, setDriverName] = useState("");
  const [driverSignature, setDriverSignature] = useState("");
  const [helperName, setHelperName] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [dispatchNotes, setDispatchNotes] = useState("");
  const [receiveNotes, setReceiveNotes] = useState("");
  const [voidReason, setVoidReason] = useState("");

  const items = useMemo(() => dn?.delivery_note_items || [], [dn?.delivery_note_items]);
  const receivingExceptions = useMemo(
    () => dn?.delivery_note_receiving_exceptions || [],
    [dn?.delivery_note_receiving_exceptions]
  );
  const pendingReceivingExceptions = useMemo(
    () => receivingExceptions.filter((exception) => exception.status === "pending_review"),
    [receivingExceptions]
  );
  const showReceivingColumns = !!dn && dn.can_view_receiving_details !== false;
  const showFulfillmentColumns = !showReceivingColumns;
  const overageItems = useMemo(
    () =>
      items.filter(
        (item) =>
          showReceivingColumns &&
          toNumber(item.receiving_variance_qty) > 0 &&
          item.receiving_overage_review_status
      ),
    [items, showReceivingColumns]
  );
  const pendingOverageItems = useMemo(
    () => overageItems.filter((item) => item.receiving_overage_review_status === "pending_review"),
    [overageItems]
  );
  const shellItemRows =
    isLoading && items.length === 0
      ? Array.from({ length: 4 }, (_, index) => `skeleton-${index}`)
      : [];
  const allocatableItems = useMemo(
    () => allocatableItemsData?.data || [],
    [allocatableItemsData?.data]
  );
  const { data: sourceWarehouseData } = useWarehouse(dn?.requesting_warehouse_id || "");
  const { data: destinationWarehouseData } = useWarehouse(dn?.fulfilling_warehouse_id || "");

  const activePickList = useMemo(() => {
    const rows = dn?.pick_lists || [];
    return (
      rows.find(
        (row) => !row.deleted_at && ["pending", "in_progress", "paused"].includes(row.status)
      ) || null
    );
  }, [dn?.pick_lists]);

  const linkedPickList = useMemo(() => {
    const rows = dn?.pick_lists || [];
    const sorted = rows
      .filter((row) => !row.deleted_at)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return sorted.find((row) => row.status !== "cancelled") || sorted[0] || null;
  }, [dn?.pick_lists]);

  const hasPendingPickableLines = useMemo(
    () =>
      items.some(
        (item) => !item.is_voided && toNumber(item.allocated_qty) > toNumber(item.picked_qty)
      ),
    [items]
  );

  const pickerUsers = useMemo(() => {
    type PickerUser = {
      id: string;
      email: string;
      first_name: string;
      last_name: string;
      is_active: boolean;
    };

    return ((usersData?.data || []) as PickerUser[])
      .filter((user) => user.is_active)
      .map((user) => {
        const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
        return {
          id: user.id,
          label: fullName ? `${fullName} (${user.email})` : user.email,
        };
      });
  }, [usersData?.data]);

  const filteredQueuePickerUsers = useMemo(() => {
    const q = queuePickerSearch.trim().toLowerCase();
    if (!q) return pickerUsers;
    return pickerUsers.filter((user) => user.label.toLowerCase().includes(q));
  }, [pickerUsers, queuePickerSearch]);

  const filteredAllocatableItems = useMemo(() => {
    const query = addItemSearch.trim().toLowerCase();
    if (!query) return allocatableItems;
    return allocatableItems.filter((item) =>
      [item.requestCode, item.itemCode, item.itemName]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query))
    );
  }, [addItemSearch, allocatableItems]);

  const timeline = useMemo(
    () => [
      { label: t("created"), value: dn?.created_at, userId: dn?.created_by },
      { label: t("confirmed"), value: dn?.confirmed_at, userId: dn?.updated_by },
      { label: t("pickingStarted"), value: dn?.picking_started_at, userId: dn?.picking_started_by },
      {
        label: t("pickingCompleted"),
        value: dn?.picking_completed_at,
        userId: dn?.picking_completed_by,
      },
      { label: t("dispatched"), value: dn?.dispatched_at, userId: dn?.updated_by },
      { label: t("received"), value: dn?.received_at, userId: dn?.updated_by },
      { label: t("voided"), value: dn?.voided_at, userId: dn?.updated_by },
    ],
    [dn, t]
  );

  const getUserDisplayName = useMemo(() => {
    return (userId: string | null | undefined) => {
      if (!userId) return null;
      const user = (usersData?.data || []).find((u: { id: string }) => u.id === userId);
      if (!user) return null;
      const u = user as { first_name?: string; last_name?: string; email?: string };
      const fullName = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
      return fullName || u.email || null;
    };
  }, [usersData?.data]);

  type EmbeddedItemRef = { item_name?: string | null; item_code?: string | null };
  type EmbeddedUomRef = { code?: string | null; symbol?: string | null; name?: string | null };
  type EmbeddedStockRequestRef = { request_code?: string | null };
  type EmbeddedStockRequestItemRef = {
    item_unit_options?: DbItemUnitOptionRow | DbItemUnitOptionRow[] | null;
  };
  type EmbeddedUnitOptionRef = ItemUnitOption | ItemUnitOption[];

  const one = <T,>(value: T | T[] | null | undefined): T | null =>
    Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

  const sourceWarehouseLabel =
    [sourceWarehouseData?.data?.code, sourceWarehouseData?.data?.name]
      .filter(Boolean)
      .join(" - ") || t("unknownSourceWarehouse");

  const destinationWarehouseLabel =
    [destinationWarehouseData?.data?.code, destinationWarehouseData?.data?.name]
      .filter(Boolean)
      .join(" - ") || t("unknownDestinationWarehouse");

  const canConfirmReceive =
    !!dn &&
    dn.status === "dispatched" &&
    (!currentBusinessUnit?.id ||
      destinationWarehouseData?.data?.businessUnitId !== currentBusinessUnit.id);

  const statusLabel = (status: string) => {
    switch (status) {
      case "draft":
        return t("draft");
      case "confirmed":
        return t("confirmedStatus");
      case "queued_for_picking":
        return t("queuedForPicking");
      case "picking_in_progress":
        return t("pickingInProgress");
      case "dispatch_ready":
        return t("dispatchReady");
      case "dispatched":
        return t("dispatchedStatus");
      case "received":
        return t("receivedStatus");
      case "voided":
        return t("voidedStatus");
      default:
        return toProperCase(status);
    }
  };

  const itemLabel = (item: (typeof items)[number]) => {
    const row = item as typeof item & { items?: EmbeddedItemRef | EmbeddedItemRef[] | null };
    const ref = one(row.items);
    return ref?.item_name || ref?.item_code || t("unknownItem");
  };

  const uomLabel = (item: (typeof items)[number]) => {
    const row = item as typeof item & {
      item_unit_options?: DbItemUnitOptionRow | DbItemUnitOptionRow[] | null;
      units_of_measure?: EmbeddedUomRef | EmbeddedUomRef[] | null;
      stock_request_items?: EmbeddedStockRequestItemRef | EmbeddedStockRequestItemRef[] | null;
    };
    const directUnitOptionRef = one(row.item_unit_options);
    const requestItemRef = one(row.stock_request_items);
    const unitOptionRef = requestItemRef ? one(requestItemRef.item_unit_options) : null;
    const ref = one(row.units_of_measure);
    if (directUnitOptionRef) {
      return transformItemUnitOptionRow(directUnitOptionRef, ref?.code || "").displayLabel;
    }
    if (unitOptionRef) {
      return transformItemUnitOptionRow(unitOptionRef, ref?.code || "").displayLabel;
    }
    return ref?.code || ref?.symbol || ref?.name || t("unknownUnit");
  };

  const exceptionItemLabel = (exception: (typeof receivingExceptions)[number]) => {
    const row = exception as typeof exception & {
      items?: EmbeddedItemRef | EmbeddedItemRef[] | null;
    };
    const ref = one(row.items);
    return ref?.item_name || ref?.item_code || exception.item_id || t("unknownItem");
  };

  const exceptionCodeLabel = (exception: (typeof receivingExceptions)[number]) => {
    const row = exception as typeof exception & {
      items?: EmbeddedItemRef | EmbeddedItemRef[] | null;
    };
    const ref = one(row.items);
    return ref?.item_code || exception.item_id || t("unknownItem");
  };

  const exceptionUomLabel = (exception: (typeof receivingExceptions)[number]) => {
    const row = exception as typeof exception & {
      item_unit_options?: EmbeddedUnitOptionRef | null;
      units_of_measure?: EmbeddedUomRef | EmbeddedUomRef[] | null;
    };
    const unitOptionRef = one(row.item_unit_options);
    const ref = one(row.units_of_measure);
    if (unitOptionRef) {
      return unitOptionRef.displayLabel || unitOptionRef.optionLabel || ref?.code || t("unknownUnit");
    }
    return ref?.code || ref?.symbol || ref?.name || t("unknownUnit");
  };

  const requestLabel = (item: (typeof items)[number]) => {
    const row = item as typeof item & {
      stock_requests?: EmbeddedStockRequestRef | EmbeddedStockRequestRef[] | null;
    };
    const ref = one(row.stock_requests);
    return ref?.request_code || t("unknownStockRequest");
  };

  const lineStateLabel = (item: (typeof items)[number]) => {
    if (item.is_voided || toNumber(item.allocated_qty) === 0) return t("lineVoided");
    if (toNumber(item.allocated_qty) > toNumber(item.picked_qty)) return t("pendingPicking");
    if (toNumber(item.dispatched_qty) > 0) return t("dispatchedStatus");
    return t("dispatchReady");
  };

  const getReceivedQty = (itemId: string, fallback: number) =>
    Object.prototype.hasOwnProperty.call(receivedQtyMap, itemId)
      ? receivedQtyMap[itemId]
      : fallback;

  const getLineReceivedQty = (item: (typeof items)[number]) => {
    const activeScans = (item.delivery_note_item_receiving_scans || []).filter(
      (scan) => !scan.voided_at
    );
    if (activeScans.length > 0) {
      return activeScans.reduce((sum, scan) => sum + toNumber(scan.accepted_qty), 0);
    }

    if (item.receiving_status && item.receiving_status !== "pending") {
      return toNumber(item.dispatched_qty) + toNumber(item.receiving_variance_qty);
    }

    return toNumber(item.received_qty);
  };

  const canQueuePicking =
    !!dn &&
    ["confirmed", "dispatched"].includes(dn.status) &&
    !activePickList &&
    hasPendingPickableLines;
  const showItemActions = showFulfillmentColumns && dn?.status === "dispatched";

  const pageActions = dn ? (
    <>
      {dn.status === "draft" && (
        <Button
          onClick={async () => {
            try {
              await confirmMutation.mutateAsync(dn.id);
              toast.success("Delivery note confirmed");
            } catch (error) {
              toast.error(getMutationErrorMessage(error, "Failed to confirm delivery note"));
            }
          }}
          disabled={confirmMutation.isPending}
        >
          {t("confirm")}
        </Button>
      )}
      {canQueuePicking && (
        <Button onClick={() => setQueueOpen(true)} disabled={createPickListMutation.isPending}>
          {t("queuePicking")}
        </Button>
      )}
      {dn.status === "dispatched" && (
        <Button variant="outline" onClick={() => setAddItemsOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("addItems")}
        </Button>
      )}
      {[
        "picking_in_progress",
        "dispatch_ready",
        "draft",
        "confirmed",
        "queued_for_picking",
      ].includes(dn.status) && (
        <Button
          variant="destructive"
          onClick={async () => {
            try {
              await voidMutation.mutateAsync({ id: dn.id, reason: voidReason || undefined });
              toast.success("Delivery note voided");
            } catch (error) {
              toast.error(getMutationErrorMessage(error, "Failed to void delivery note"));
            }
          }}
          disabled={voidMutation.isPending}
        >
          {t("void")}
        </Button>
      )}
    </>
  ) : null;

  const submitDispatch = async () => {
    if (!dn) return;

    const payload = {
      driverName: driverName.trim() || undefined,
      driverSignature: driverSignature.trim(),
      helperName: helperName.trim() || undefined,
      deliveryTime: deliveryTime || undefined,
      plateNumber: plateNumber.trim() || undefined,
      notes: dispatchNotes.trim() || undefined,
      items: items.map((item) => ({
        deliveryNoteItemId: item.id,
        dispatchQty: Math.max(0, toNumber(item.picked_qty) - toNumber(item.dispatched_qty)),
      })),
    };

    try {
      await dispatchMutation.mutateAsync({ id: dn.id, data: payload });
      toast.success("Delivery note dispatched");
    } catch (error) {
      toast.error(getMutationErrorMessage(error, "Failed to dispatch delivery note"));
    }
  };

  const submitReceive = async () => {
    if (!dn || !canConfirmReceive) return;

    const payload = {
      notes: receiveNotes.trim() || undefined,
      items: items
        .filter((item) => !item.is_voided && toNumber(item.dispatched_qty) > 0)
        .map((item) => ({
          deliveryNoteItemId: item.id,
          receivedQty: getReceivedQty(item.id, toNumber(item.dispatched_qty)),
        })),
    };

    try {
      await receiveMutation.mutateAsync({
        id: dn.id,
        fulfillmentMode: dn.fulfillment_mode || "transfer_to_store",
        data: payload,
      });
      toast.success("Delivery note received");
    } catch (error) {
      toast.error(getMutationErrorMessage(error, "Failed to receive delivery note"));
    }
  };

  const acceptReceivingException = async (exceptionId: string) => {
    if (!dn) return;
    try {
      await acceptExceptionMutation.mutateAsync({
        id: dn.id,
        exceptionId,
        notes: "Accepted from delivery note detail review",
      });
      toast.success("Unexpected item accepted and posted to inventory");
    } catch (error) {
      toast.error(getMutationErrorMessage(error, "Failed to accept unexpected item"));
    }
  };

  const rejectReceivingException = async (exceptionId: string) => {
    if (!dn) return;
    try {
      await rejectExceptionMutation.mutateAsync({
        id: dn.id,
        exceptionId,
        notes: "Rejected from delivery note detail review",
      });
      toast.success("Unexpected item rejected");
    } catch (error) {
      toast.error(getMutationErrorMessage(error, "Failed to reject unexpected item"));
    }
  };

  const acceptReceivingOverage = async (itemId: string) => {
    if (!dn) return;
    try {
      await acceptOverageMutation.mutateAsync({
        id: dn.id,
        itemId,
        notes: "Accepted from delivery note overage review",
      });
      toast.success("Overage accepted and posted to inventory");
    } catch (error) {
      toast.error(getMutationErrorMessage(error, "Failed to accept overage"));
    }
  };

  const rejectReceivingOverage = async (itemId: string) => {
    if (!dn) return;
    try {
      await rejectOverageMutation.mutateAsync({
        id: dn.id,
        itemId,
        notes: "Rejected from delivery note overage review",
      });
      toast.success("Overage rejected");
    } catch (error) {
      toast.error(getMutationErrorMessage(error, "Failed to reject overage"));
    }
  };

  const resetQueueState = () => {
    setQueueOpen(false);
    setQueuePickerSearch("");
    setQueueNotes("");
    setSelectedQueuePickerIds(new Set());
    setPendingPickListPayload(null);
    setBatchAllocationChoice(null);
  };

  const createPickListWithAllocationHandling = async (payload: CreatePickListPayload) => {
    try {
      await createPickListMutation.mutateAsync(payload);
      resetQueueState();
    } catch (error) {
      const allocationChoice = getPickListBatchAllocationChoiceError(error);
      if (allocationChoice && !payload.batchAllocationMode) {
        setPendingPickListPayload(payload);
        setBatchAllocationChoice(allocationChoice);
        return;
      }
      toast.error(getMutationErrorMessage(error, "Failed to create pick list"));
    }
  };

  const submitCreatePickList = async () => {
    if (!dn) return;
    const pickerUserIds = Array.from(selectedQueuePickerIds);
    if (pickerUserIds.length === 0) return;

    await createPickListWithAllocationHandling({
      dnId: dn.id,
      pickerUserIds,
      notes: queueNotes.trim() || undefined,
    });
  };

  const submitBatchAllocationChoice = async (mode: PickListBatchAllocationMode) => {
    if (!pendingPickListPayload) return;
    await createPickListWithAllocationHandling({
      ...pendingPickListPayload,
      batchAllocationMode: mode,
    });
  };

  const submitAdjustItem = async () => {
    if (!dn || !adjustItemId) return;

    try {
      await adjustItemMutation.mutateAsync({
        id: dn.id,
        itemId: adjustItemId,
        data: {
          dispatchedQty: Math.max(0, parseFloat(adjustDispatchedQty) || 0),
          reason: adjustReason.trim() || undefined,
        },
      });

      toast.success("Delivery note item adjusted");
      setAdjustItemId(null);
      setAdjustDispatchedQty("");
      setAdjustReason("");
    } catch (error) {
      toast.error(getMutationErrorMessage(error, "Failed to adjust delivery note item"));
    }
  };

  const submitAddItems = async () => {
    if (!dn) return;

    const selectedItems = allocatableItems
      .map((item) => ({
        ...item,
        allocatedQty: Math.max(
          0,
          Math.min(item.allocatableQty, parseFloat(selectedAddQtyMap[item.srItemId] || "0") || 0)
        ),
      }))
      .filter((item) => item.allocatedQty > 0);

    if (selectedItems.length === 0) return;

    try {
      await addItemsMutation.mutateAsync({
        id: dn.id,
        data: {
          pickerUserIds: Array.from(selectedAddPickerIds),
          notes: addItemNotes.trim() || undefined,
          items: selectedItems.map((item) => ({
            srId: item.srId,
            srItemId: item.srItemId,
            itemId: item.itemId,
            uomId: item.uomId,
            allocatedQty: item.allocatedQty,
          })),
        },
      });

      toast.success("Delivery note items added and queued for picking");
      setAddItemsOpen(false);
      setAddItemSearch("");
      setAddItemNotes("");
      setSelectedAddPickerIds(new Set());
      setSelectedAddQtyMap({});
    } catch (error) {
      toast.error(getMutationErrorMessage(error, "Failed to add delivery note items"));
    }
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      <PageHeader
        title={t("title")}
        subtitle={
          dn?.dn_no ? (
            dn.dn_no
          ) : isLoading ? (
            <span
              aria-label={t("loading")}
              className="inline-block h-4 w-40 animate-pulse rounded bg-muted align-middle"
            />
          ) : (
            t("noValue")
          )
        }
        actions={pageActions}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">{t("status")}</div>
          <div className="mt-1 text-sm font-semibold">
            {dn ? statusLabel(dn.status) : <Skeleton className="h-5 w-28" />}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">{t("sourceWarehouse")}</div>
          <div className="mt-1 text-sm font-medium">
            {dn ? sourceWarehouseLabel : <Skeleton className="h-5 w-40" />}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">{t("destinationWarehouse")}</div>
          <div className="mt-1 text-sm font-medium">
            {dn ? destinationWarehouseLabel : <Skeleton className="h-5 w-40" />}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">{t("linkedPickList")}</div>
          {dn && linkedPickList ? (
            <Link
              href="/inventory/pick-lists"
              className="mt-1 inline-block text-sm font-medium text-blue-600 hover:underline"
            >
              {linkedPickList.pick_list_no}
            </Link>
          ) : isLoading ? (
            <div className="mt-1">
              <Skeleton className="h-5 w-28" />
            </div>
          ) : (
            <div className="mt-1 text-sm font-medium text-muted-foreground">{t("noValue")}</div>
          )}
        </div>
      </div>

      {dn &&
        (dn.driver_name || dn.helper_name || dn.delivery_time || dn.plate_number) &&
        dn.status !== "dispatch_ready" && (
          <Card>
            <CardHeader>
              <CardTitle>{t("dispatchInformation")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="text-xs font-medium text-muted-foreground">{t("driverName")}</div>
                <div className="mt-1 text-sm font-medium">{dn.driver_name || t("noValue")}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">{t("helperName")}</div>
                <div className="mt-1 text-sm font-medium">{dn.helper_name || t("noValue")}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  {t("deliveryTime")}
                </div>
                <div className="mt-1 text-sm font-medium">
                  {formatDeliveryTime(dn.delivery_time)}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  {t("plateNumber")}
                </div>
                <div className="mt-1 text-sm font-medium">{dn.plate_number || t("noValue")}</div>
              </div>
            </CardContent>
          </Card>
        )}

      {dn && showReceivingColumns && (dn.receiving_notes || dn.receiving_discrepancy_notes) && (
        <Card>
          <CardHeader>
            <CardTitle>{t("receivingNotes")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dn.receiving_notes && (
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  {t("receiveNotes")}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{dn.receiving_notes}</p>
              </div>
            )}
            {dn.receiving_discrepancy_notes && (
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  {t("discrepancyNotes")}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {dn.receiving_discrepancy_notes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && !dn ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5">
          <EmptyStatePanel
            icon={AlertCircle}
            title={t("loadError")}
            description={t("loading")}
            className="min-h-[180px]"
          />
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCard
            title={t("totalItems")}
            icon={Package2}
            iconClassName="h-4 w-4 text-blue-600"
            value={dn ? String(items.length) : undefined}
            isLoading={!dn && isLoading}
          />
          {showFulfillmentColumns && (
            <>
              <MetricCard
                title={t("totalAllocated")}
                icon={Package2}
                iconClassName="h-4 w-4 text-green-600"
                value={
                  dn
                    ? items.reduce((sum, item) => sum + toNumber(item.allocated_qty), 0).toFixed(2)
                    : undefined
                }
                isLoading={!dn && isLoading}
              />
              <MetricCard
                title={t("totalShort")}
                icon={TrendingDown}
                iconClassName="h-4 w-4 text-orange-600"
                value={
                  dn
                    ? items.reduce((sum, item) => sum + toNumber(item.short_qty), 0).toFixed(2)
                    : undefined
                }
                valueClassName="text-2xl font-bold text-orange-600"
                isLoading={!dn && isLoading}
              />
            </>
          )}
        </div>

        <div className="min-h-[26rem] rounded-lg border bg-card">
          <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
            <Package2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">{t("itemDetails")}</h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">{t("stockRequest")}</TableHead>
                  <TableHead className="font-semibold">{t("item")}</TableHead>
                  <TableHead className="font-semibold">{t("uom")}</TableHead>
                  {showFulfillmentColumns && (
                    <>
                      <TableHead className="text-right font-semibold">{t("allocated")}</TableHead>
                      <TableHead className="text-right font-semibold">{t("picked")}</TableHead>
                      <TableHead className="text-right font-semibold">{t("short")}</TableHead>
                    </>
                  )}
                  <TableHead className="text-right font-semibold">
                    {showReceivingColumns ? t("expected") : t("dispatchedQty")}
                  </TableHead>
                  {showReceivingColumns && (
                    <>
                      <TableHead className="text-right font-semibold">{t("received")}</TableHead>
                      <TableHead className="text-right font-semibold">{t("variance")}</TableHead>
                    </>
                  )}
                  <TableHead className="font-semibold">{t("lineState")}</TableHead>
                  {showItemActions && (
                    <TableHead className="text-right font-semibold">{t("actions")}</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {!dn && isLoading
                  ? shellItemRows.map((rowKey) => (
                      <TableRow key={rowKey}>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-44" />
                            <Skeleton className="h-3 w-32" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-16" />
                        </TableCell>
                        {showFulfillmentColumns && (
                          <>
                            <TableCell className="text-right">
                              <Skeleton className="ml-auto h-4 w-14" />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="ml-auto flex w-14 flex-col items-end gap-1">
                                <Skeleton className="h-4 w-14" />
                                <Skeleton className="h-3 w-10" />
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Skeleton className="ml-auto h-6 w-16" />
                            </TableCell>
                          </>
                        )}
                        <TableCell className="text-right">
                          <Skeleton className="ml-auto h-4 w-14" />
                        </TableCell>
                        {showReceivingColumns && (
                          <>
                            <TableCell className="text-right">
                              <Skeleton className="ml-auto h-4 w-14" />
                            </TableCell>
                            <TableCell className="text-right">
                              <Skeleton className="ml-auto h-6 w-16" />
                            </TableCell>
                          </>
                        )}
                        <TableCell>
                          <Skeleton className="h-6 w-24" />
                        </TableCell>
                        {showItemActions && (
                          <TableCell className="text-right">
                            <Skeleton className="ml-auto h-8 w-24" />
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  : items.map((item) => {
                      const allocatedQty = toNumber(item.allocated_qty);
                      const pickedQty = toNumber(item.picked_qty);
                      const shortQty = toNumber(item.short_qty);
                      const dispatchedQty = toNumber(item.dispatched_qty);
                      const receivedQty = getLineReceivedQty(item);
                      const receivingVarianceQty = receivedQty - dispatchedQty;
                      const pickCompletion =
                        allocatedQty > 0 ? ((pickedQty / allocatedQty) * 100).toFixed(0) : 0;

                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {requestLabel(item)}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{itemLabel(item)}</div>
                            {item.void_reason && item.is_voided && (
                              <div className="mt-1 text-xs text-muted-foreground">
                                {item.void_reason}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                              {uomLabel(item)}
                            </span>
                          </TableCell>
                          {showFulfillmentColumns && (
                            <>
                              <TableCell className="text-right">
                                <div className="font-semibold">{allocatedQty.toFixed(2)}</div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="space-y-1">
                                  <div className="font-medium">{pickedQty.toFixed(2)}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {pickCompletion}%
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                {shortQty > 0 ? (
                                  <div className="inline-flex items-center gap-1 rounded-md bg-orange-50 px-2 py-1">
                                    <TrendingDown className="h-3 w-3 text-orange-600" />
                                    <span className="font-semibold text-orange-600">
                                      {shortQty.toFixed(2)}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">
                                    {shortQty.toFixed(2)}
                                  </span>
                                )}
                              </TableCell>
                            </>
                          )}
                          <TableCell className="text-right">
                            <div className="font-medium">{dispatchedQty.toFixed(2)}</div>
                          </TableCell>
                          {showReceivingColumns && (
                            <>
                              <TableCell className="text-right">
                                <div className="font-medium">{formatQty(receivedQty)}</div>
                              </TableCell>
                              <TableCell className="text-right">
                                {receivingVarianceQty === 0 ? (
                                  <span className="text-muted-foreground">0</span>
                                ) : (
                                  <span
                                    className={
                                      receivingVarianceQty < 0
                                        ? "font-semibold text-amber-700"
                                        : "font-semibold text-red-700"
                                    }
                                  >
                                    {receivingVarianceQty > 0 ? "+" : ""}
                                    {formatQty(receivingVarianceQty)}
                                  </span>
                                )}
                              </TableCell>
                            </>
                          )}
                          <TableCell>
                            <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                              {lineStateLabel(item)}
                            </span>
                          </TableCell>
                          {showItemActions && (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={dispatchedQty <= 0 || adjustItemMutation.isPending}
                                  onClick={() => {
                                    setAdjustItemId(item.id);
                                    setAdjustDispatchedQty(dispatchedQty.toFixed(2));
                                    setAdjustReason("");
                                  }}
                                >
                                  <Pencil className="mr-2 h-3.5 w-3.5" />
                                  {t("editQty")}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={dispatchedQty <= 0 || adjustItemMutation.isPending}
                                  onClick={() => {
                                    setAdjustItemId(item.id);
                                    setAdjustDispatchedQty("0");
                                    setAdjustReason("");
                                  }}
                                >
                                  <XCircle className="mr-2 h-3.5 w-3.5" />
                                  {t("voidItem")}
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {dn && showReceivingColumns && overageItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-700" />
              Receiving Overages
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Over-received quantities are recorded from tablet receiving but posted separately
              after review. Accepting adds only the extra quantity to inventory; rejecting creates no
              stock movement.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingOverageItems.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                {pendingOverageItems.length} overage line
                {pendingOverageItems.length === 1 ? "" : "s"} pending review.
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Overage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overageItems.map((item) => {
                    const expectedQty = toNumber(item.dispatched_qty);
                    const receivedQty = getLineReceivedQty(item);
                    const overageQty = Math.max(0, receivedQty - expectedQty);
                    const isPending = item.receiving_overage_review_status === "pending_review";
                    const isBusy =
                      acceptOverageMutation.isPending || rejectOverageMutation.isPending;

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium">{itemLabel(item)}</div>
                          <div className="text-xs text-muted-foreground">
                            {requestLabel(item)}
                          </div>
                          {item.receiving_overage_review_notes && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {item.receiving_overage_review_notes}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                            {uomLabel(item)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{formatQty(expectedQty)}</TableCell>
                        <TableCell className="text-right">{formatQty(receivedQty)}</TableCell>
                        <TableCell className="text-right font-semibold text-red-700">
                          +{formatQty(overageQty)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`rounded-md px-2 py-1 text-xs font-medium ${
                              isPending
                                ? "bg-amber-100 text-amber-900"
                                : item.receiving_overage_review_status === "accepted"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {(item.receiving_overage_review_status || "pending_review").replace(
                              "_",
                              " "
                            )}
                          </span>
                          {item.receiving_overage_posted_qty ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Posted {formatQty(toNumber(item.receiving_overage_posted_qty))}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">
                          {isPending ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isBusy}
                                onClick={() => rejectReceivingOverage(item.id)}
                              >
                                <XCircle className="mr-2 h-3.5 w-3.5" />
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                disabled={isBusy}
                                onClick={() => acceptReceivingOverage(item.id)}
                              >
                                <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                                Accept
                              </Button>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {item.receiving_overage_reviewed_at
                                ? formatDate(item.receiving_overage_reviewed_at, locale)
                                : "--"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {dn && showReceivingColumns && receivingExceptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-700" />
              Unexpected Items
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Unexpected scans are reviewed separately from normal delivery note receiving.
              Accepting posts a separate inventory transaction; rejecting creates no stock movement.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingReceivingExceptions.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {pendingReceivingExceptions.length} unexpected item
                {pendingReceivingExceptions.length === 1 ? "" : "s"} pending review.
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Box</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Scanned At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receivingExceptions.map((exception) => {
                    const isPending = exception.status === "pending_review";
                    const isBusy =
                      acceptExceptionMutation.isPending || rejectExceptionMutation.isPending;
                    return (
                      <TableRow key={exception.id}>
                        <TableCell>
                          <div className="font-medium">{exceptionItemLabel(exception)}</div>
                          <div className="text-xs text-muted-foreground">
                            {exceptionCodeLabel(exception)}
                          </div>
                          {exception.reason && (
                            <div className="mt-1 text-xs text-amber-800">{exception.reason}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                            {exceptionUomLabel(exception)}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{exception.box_id}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatQty(toNumber(exception.accepted_qty))}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`rounded-md px-2 py-1 text-xs font-medium ${
                              isPending
                                ? "bg-amber-100 text-amber-900"
                                : exception.status === "accepted"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {exception.status.replace("_", " ")}
                          </span>
                        </TableCell>
                        <TableCell>{formatDate(exception.scanned_at, locale)}</TableCell>
                        <TableCell className="text-right">
                          {isPending ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isBusy}
                                onClick={() => rejectReceivingException(exception.id)}
                              >
                                <XCircle className="mr-2 h-3.5 w-3.5" />
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                disabled={isBusy}
                                onClick={() => acceptReceivingException(exception.id)}
                              >
                                <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                                Accept
                              </Button>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {exception.reviewed_at
                                ? formatDate(exception.reviewed_at, locale)
                                : "--"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {dn && (dn.status === "queued_for_picking" || dn.status === "picking_in_progress") && (
        <Card>
          <CardHeader>
            <CardTitle>{t("pickingControl")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("pickingControlDescription")}</p>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/inventory/pick-lists">{t("openPickLists")}</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {dn?.status === "dispatch_ready" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("dispatchInformation")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("optionalNotes")}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">{t("driverName")}</Label>
              <Input
                placeholder={t("enterDriverName")}
                value={driverName}
                onChange={(event) => setDriverName(event.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  {t("helperName")}
                </Label>
                <Input
                  placeholder={t("enterHelperName")}
                  value={helperName}
                  onChange={(event) => setHelperName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  {t("deliveryTime")}
                </Label>
                <Input
                  type="time"
                  value={deliveryTime}
                  onChange={(event) => setDeliveryTime(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  {t("plateNumber")}
                </Label>
                <Input
                  placeholder={t("enterPlateNumber")}
                  value={plateNumber}
                  onChange={(event) => setPlateNumber(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                {t("driverSignature")} <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder={t("required")}
                value={driverSignature}
                onChange={(event) => setDriverSignature(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                {t("dispatchNotes")}
              </Label>
              <Textarea
                placeholder={t("optionalNotes")}
                value={dispatchNotes}
                onChange={(event) => setDispatchNotes(event.target.value)}
                rows={3}
              />
            </div>
            <Button
              onClick={submitDispatch}
              disabled={dispatchMutation.isPending || !driverSignature.trim()}
              className="w-full sm:w-auto"
            >
              {dispatchMutation.isPending ? t("dispatching") : t("confirmDispatch")}
            </Button>
          </CardContent>
        </Card>
      )}

      {dn?.status === "dispatched" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("receiveDelivery")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("receivedQuantities")}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                {t("receiveNotes")}
              </Label>
              <Textarea
                placeholder={t("optionalNotes")}
                value={receiveNotes}
                onChange={(event) => setReceiveNotes(event.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-3">
              <div className="text-sm font-medium">{t("receivedQuantities")}</div>
              {items
                .filter((item) => !item.is_voided && toNumber(item.dispatched_qty) > 0)
                .map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium">{itemLabel(item)}</div>
                      <div className="text-xs text-muted-foreground">{requestLabel(item)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{t("qty")}</span>
                      <Input
                        className="w-28 text-right"
                        type="number"
                        min="0"
                        max={toNumber(item.dispatched_qty)}
                        step="0.01"
                        value={getReceivedQty(item.id, toNumber(item.dispatched_qty))}
                        onChange={(event) =>
                          setReceivedQtyMap((prev) => ({
                            ...prev,
                            [item.id]: Math.max(
                              0,
                              Math.min(
                                toNumber(item.dispatched_qty),
                                parseFloat(event.target.value) || 0
                              )
                            ),
                          }))
                        }
                      />
                    </div>
                  </div>
                ))}
            </div>
            {canConfirmReceive ? (
              <Button
                onClick={submitReceive}
                disabled={receiveMutation.isPending}
                className="w-full sm:w-auto"
              >
                {receiveMutation.isPending ? t("receiving") : t("confirmReceive")}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      )}

      {dn?.status === "voided" && dn.void_reason && (
        <Card>
          <CardHeader>
            <CardTitle>{t("voidInformation")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">{t("voidReason")}</Label>
              <p className="text-sm">{dn.void_reason}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {dn &&
        [
          "draft",
          "confirmed",
          "queued_for_picking",
          "picking_in_progress",
          "dispatch_ready",
        ].includes(dn.status) && (
          <Card>
            <CardHeader>
              <CardTitle>{t("voidDeliveryNote")}</CardTitle>
              <p className="text-sm text-muted-foreground">{t("reasonForVoidingOptional")}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder={t("reasonForVoidingOptional")}
                value={voidReason}
                onChange={(event) => setVoidReason(event.target.value)}
                rows={3}
              />
            </CardContent>
          </Card>
        )}

      <Card>
        <CardHeader>
          <CardTitle>{t("timeline")}</CardTitle>
        </CardHeader>
        <CardContent className="relative min-h-[18rem]">
          <div className="space-y-6">
            {!dn && isLoading
              ? Array.from({ length: 5 }, (_, index) => (
                  <div key={`timeline-skeleton-${index}`} className="relative flex gap-4">
                    <div className="flex flex-col items-center">
                      <Skeleton className="h-3 w-3 rounded-full" />
                      {index < 4 && (
                        <div className="mt-1 w-0.5 flex-1 bg-muted" style={{ minHeight: "24px" }} />
                      )}
                    </div>
                    <div className="flex-1 space-y-2 pb-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-36" />
                    </div>
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))
              : timeline.map((event, index) => {
                  const userName = getUserDisplayName(event.userId);

                  return (
                    <div key={event.label} className="relative flex gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className={`h-3 w-3 rounded-full border-2 ${
                            event.value
                              ? "border-blue-600 bg-blue-600"
                              : "border-muted-foreground/30 bg-background"
                          }`}
                        />
                        {index < timeline.length - 1 && (
                          <div
                            className={`mt-1 w-0.5 flex-1 ${timeline[index + 1].value ? "bg-blue-600" : "bg-muted-foreground/20"}`}
                            style={{ minHeight: "24px" }}
                          />
                        )}
                      </div>

                      <div className="flex-1 pb-2">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <div
                              className={`text-sm font-medium ${event.value ? "text-foreground" : "text-muted-foreground"}`}
                            >
                              {event.label}
                            </div>
                            {userName && event.value && (
                              <div className="mt-1 text-xs text-muted-foreground">
                                {t("byUser", { user: userName })}
                              </div>
                            )}
                          </div>
                          <span
                            className={`whitespace-nowrap text-sm ${event.value ? "text-foreground" : "text-muted-foreground"}`}
                          >
                            {formatDate(event.value, locale)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
          </div>
        </CardContent>
      </Card>

      {dn ? (
        <Dialog
          open={queueOpen}
          onOpenChange={(open) => {
            if (open) setQueueOpen(true);
            else resetQueueState();
          }}
        >
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{t("createPickList")}</DialogTitle>
              <DialogDescription>
                {t("createPickListDescription", { code: dn.dn_no })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t("assignPickers")}</Label>
                <Input
                  placeholder={t("searchNameOrEmail")}
                  value={queuePickerSearch}
                  onChange={(event) => setQueuePickerSearch(event.target.value)}
                />
                <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border bg-muted/30 p-3">
                  {filteredQueuePickerUsers.map((user) => (
                    <label
                      key={user.id}
                      className="flex cursor-pointer items-center gap-3 rounded p-2 text-sm transition-colors hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selectedQueuePickerIds.has(user.id)}
                        onCheckedChange={(checked) => {
                          setSelectedQueuePickerIds((prev) => {
                            const next = new Set(prev);
                            if (checked === true) next.add(user.id);
                            else next.delete(user.id);
                            return next;
                          });
                        }}
                      />
                      <span>{user.label}</span>
                    </label>
                  ))}
                  {filteredQueuePickerUsers.length === 0 && (
                    <div className="py-4 text-center text-sm text-muted-foreground">
                      {t("noMatchingUsers")}
                    </div>
                  )}
                </div>
                {selectedQueuePickerIds.size > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {t("pickersSelected", { count: selectedQueuePickerIds.size })}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">{t("pickingInstructions")}</Label>
                <Textarea
                  placeholder={t("optionalPickingInstructions")}
                  value={queueNotes}
                  onChange={(event) => setQueueNotes(event.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setQueueOpen(false)}>
                {t("cancel")}
              </Button>
              <Button
                onClick={submitCreatePickList}
                disabled={selectedQueuePickerIds.size === 0 || createPickListMutation.isPending}
              >
                {createPickListMutation.isPending ? t("creating") : t("createPickList")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      <BatchAllocationChoiceDialog
        open={!!batchAllocationChoice}
        choice={batchAllocationChoice}
        isPending={createPickListMutation.isPending}
        namespace="deliveryNoteDetailPage"
        onOpenChange={(open) => {
          if (!open) {
            setBatchAllocationChoice(null);
            setPendingPickListPayload(null);
          }
        }}
        onChoose={submitBatchAllocationChoice}
      />

      <Dialog
        open={!!adjustItemId}
        onOpenChange={(open) => {
          if (!open) {
            setAdjustItemId(null);
            setAdjustDispatchedQty("");
            setAdjustReason("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("adjustItem")}</DialogTitle>
            <DialogDescription>{t("adjustItemDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("newDispatchedQty")}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={adjustDispatchedQty}
                onChange={(event) => setAdjustDispatchedQty(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("reason")}</Label>
              <Textarea
                rows={3}
                placeholder={t("reasonOptional")}
                value={adjustReason}
                onChange={(event) => setAdjustReason(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAdjustItemId(null);
                setAdjustDispatchedQty("");
                setAdjustReason("");
              }}
            >
              {t("cancel")}
            </Button>
            <Button onClick={submitAdjustItem} disabled={adjustItemMutation.isPending}>
              {adjustItemMutation.isPending ? t("savingAdjustment") : t("saveAdjustment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addItemsOpen} onOpenChange={setAddItemsOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t("addItems")}</DialogTitle>
            <DialogDescription>{t("addItemsDescription")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("searchItems")}</Label>
              <Input
                placeholder={t("searchItems")}
                value={addItemSearch}
                onChange={(event) => setAddItemSearch(event.target.value)}
              />
            </div>

            <div className="max-h-80 overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("stockRequest")}</TableHead>
                    <TableHead>{t("item")}</TableHead>
                    <TableHead>{t("uom")}</TableHead>
                    <TableHead className="text-right">{t("requestedQty")}</TableHead>
                    <TableHead className="text-right">{t("availableQty")}</TableHead>
                    <TableHead className="text-right">{t("selectQtyToAdd")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isAllocatableItemsLoading && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                        {t("loading")}
                      </TableCell>
                    </TableRow>
                  )}
                  {!isAllocatableItemsLoading && filteredAllocatableItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                        {t("noAllocatableItems")}
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredAllocatableItems.map((item) => (
                    <TableRow key={item.srItemId}>
                      <TableCell className="font-mono text-xs">{item.requestCode}</TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {item.itemName || item.itemCode || t("unknownItem")}
                        </div>
                        {item.itemCode && (
                          <div className="text-xs text-muted-foreground">{item.itemCode}</div>
                        )}
                      </TableCell>
                      <TableCell>{item.uomLabel || t("unknownUnit")}</TableCell>
                      <TableCell className="text-right">{item.requestedQty.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{item.allocatableQty.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          className="ml-auto w-28 text-right"
                          type="number"
                          min="0"
                          max={item.allocatableQty}
                          step="0.01"
                          value={selectedAddQtyMap[item.srItemId] || ""}
                          onChange={(event) =>
                            setSelectedAddQtyMap((prev) => ({
                              ...prev,
                              [item.srItemId]: event.target.value,
                            }))
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-2">
              <Label>{t("assignPickers")}</Label>
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border bg-muted/30 p-3">
                {pickerUsers.map((user) => (
                  <label
                    key={user.id}
                    className="flex cursor-pointer items-center gap-3 rounded p-2 text-sm hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedAddPickerIds.has(user.id)}
                      onCheckedChange={(checked) => {
                        setSelectedAddPickerIds((prev) => {
                          const next = new Set(prev);
                          if (checked === true) next.add(user.id);
                          else next.delete(user.id);
                          return next;
                        });
                      }}
                    />
                    <span>{user.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("pickingInstructions")}</Label>
              <Textarea
                rows={3}
                placeholder={t("optionalPickingInstructions")}
                value={addItemNotes}
                onChange={(event) => setAddItemNotes(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemsOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={submitAddItems}
              disabled={
                addItemsMutation.isPending ||
                selectedAddPickerIds.size === 0 ||
                !allocatableItems.some(
                  (item) =>
                    Math.max(
                      0,
                      Math.min(
                        item.allocatableQty,
                        parseFloat(selectedAddQtyMap[item.srItemId] || "0") || 0
                      )
                    ) > 0
                )
              }
            >
              {addItemsMutation.isPending
                ? t("creatingReplacementPickList")
                : t("addSelectedItems")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
