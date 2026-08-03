"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Filter,
  FileText,
  MoreVertical,
  CheckCircle,
  Clock,
  Package,
  Truck,
  ClipboardCheck,
  XCircle,
  AlertCircle,
} from "lucide-react";
import {
  useConfirmDeliveryNote,
  useCreateDeliveryNote,
  useDeliveryNoteAllocationAvailability,
  useDeliveryNote,
  useDeliveryNotes,
  useDispatchDeliveryNote,
  useStartReceivingDeliveryNote,
  useVoidDeliveryNote,
} from "@/hooks/useDeliveryNotes";
import { useCreatePickList } from "@/hooks/usePickLists";
import { useStockRequests } from "@/hooks/useStockRequests";
import { useUsers } from "@/hooks/useUsers";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import { deliveryNotesApi } from "@/lib/api/delivery-notes";
import { getApiErrorCode } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyStatePanel } from "@/components/shared/EmptyStatePanel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  DeliveryNote,
  DeliveryNoteAllocationAvailability,
  DeliveryNoteFulfillmentMode,
  DeliveryNotePickListSummary,
} from "@/types/delivery-note";
import type { CreatePickListPayload } from "@/types/pick-list";
import type { Warehouse } from "@/types/warehouse";
import { toProperCase } from "@/lib/string";
import { transformItemUnitOptionRow, type DbItemUnitOptionRow } from "@/lib/items/itemUnitOptions";
import { WarehouseSelect } from "@/components/warehouses/WarehouseSelect";

const getStatusText = (status: string, label: string) => {
  const baseClass = "text-xs font-medium";

  switch (status) {
    case "draft":
      return <span className={`${baseClass} text-slate-500`}>{label}</span>;
    case "confirmed":
      return <span className={`${baseClass} text-blue-600`}>{label}</span>;
    case "queued_for_picking":
      return <span className={`${baseClass} text-amber-600`}>{label}</span>;
    case "picking_in_progress":
      return <span className={`${baseClass} text-orange-600`}>{label}</span>;
    case "dispatch_ready":
      return <span className={`${baseClass} text-purple-600`}>{label}</span>;
    case "dispatched":
      return <span className={`${baseClass} text-indigo-600`}>{label}</span>;
    case "received":
      return <span className={`${baseClass} text-emerald-600`}>{label}</span>;
    case "voided":
      return <span className={`${baseClass} text-red-600`}>{label}</span>;
    default:
      return <span className={`${baseClass} text-muted-foreground`}>{label}</span>;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "draft":
      return <FileText className="h-4 w-4 text-slate-500" />;
    case "confirmed":
      return <CheckCircle className="h-4 w-4 text-blue-600" />;
    case "queued_for_picking":
      return <Clock className="h-4 w-4 text-amber-600" />;
    case "picking_in_progress":
      return <Package className="h-4 w-4 text-orange-600" />;
    case "dispatch_ready":
      return <ClipboardCheck className="h-4 w-4 text-purple-600" />;
    case "dispatched":
      return <Truck className="h-4 w-4 text-indigo-600" />;
    case "received":
      return <CheckCircle className="h-4 w-4 text-emerald-600" />;
    case "voided":
      return <XCircle className="h-4 w-4 text-red-600" />;
    default:
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  }
};

type DraftLine = {
  requestCode: string;
  srItemId: string;
  uomLabel: string;
  itemName: string;
  requestedQty: number;
  allocatableQty: number;
  allocatedQty: number;
  requestingBusinessUnitId: string;
};

const resolveActivePickList = (deliveryNote: DeliveryNote): DeliveryNotePickListSummary | null => {
  const rows = deliveryNote.pick_lists || [];
  const active = rows
    .filter((row) => !row.deleted_at)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return active.find((row) => row.status !== "cancelled") || active[0] || null;
};

const getMutationErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const CREATE_DELIVERY_NOTE_ERROR_CODES = ["DELIVERY_NOTE_SELECTED_BATCH_INSUFFICIENT"] as const;

export default function DeliveryNotesPage() {
  const router = useRouter();
  const t = useTranslations("deliveryNotesPage");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [actionType, setActionType] = useState<
    "confirm" | "queue_picking" | "dispatch" | "receive" | "void" | ""
  >("");
  const [actionDnId, setActionDnId] = useState<string>("");
  const [queuePickerSearch, setQueuePickerSearch] = useState("");
  const [queueNotes, setQueueNotes] = useState("");
  const [selectedQueuePickerIds, setSelectedQueuePickerIds] = useState<Set<string>>(new Set());
  const [driverName, setDriverName] = useState("");
  const [helperName, setHelperName] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [dispatchNotes, setDispatchNotes] = useState("");
  const [printingDnId, setPrintingDnId] = useState<string | null>(null);
  const [receivingWarehouseId, setReceivingWarehouseId] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const [selectedRequestingBuId, setSelectedRequestingBuId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [createFulfillmentMode, setCreateFulfillmentMode] =
    useState<DeliveryNoteFulfillmentMode>("transfer_to_store");
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());
  const [createValidationError, setCreateValidationError] = useState<string>("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const { data: deliveryNotesData, isLoading } = useDeliveryNotes({
    status: statusFilter === "all" ? undefined : statusFilter,
    search: debouncedSearch || undefined,
    page,
    limit: 50,
  });
  const { data: stockRequestsData } = useStockRequests({ page: 1, limit: 50 });
  const { data: usersData } = useUsers();
  const { data: warehousesData } = useWarehouses({ page: 1, limit: 50 });
  const { data: actionDn, isLoading: isLoadingActionDn } = useDeliveryNote(actionDnId);
  const currentBusinessUnit = useBusinessUnitStore((state) => state.currentBusinessUnit);
  const availableBusinessUnits = useBusinessUnitStore((state) => state.availableBusinessUnits);
  const createMutation = useCreateDeliveryNote();
  const createPickListMutation = useCreatePickList();
  const confirmMutation = useConfirmDeliveryNote();
  const dispatchMutation = useDispatchDeliveryNote();
  const startReceivingMutation = useStartReceivingDeliveryNote();
  const voidMutation = useVoidDeliveryNote();
  const availabilitySrItemIds = useMemo(
    () => draftLines.map((line) => line.srItemId),
    [draftLines]
  );
  const allocationAvailability = useDeliveryNoteAllocationAvailability(
    availabilitySrItemIds,
    createOpen && Boolean(selectedRequestingBuId) && availabilitySrItemIds.length > 0
  );
  const availabilityBySrItemId = useMemo<Record<string, DeliveryNoteAllocationAvailability>>(
    () =>
      Object.fromEntries(
        (allocationAvailability.data?.data || []).map((line) => [line.srItemId, line])
      ),
    [allocationAvailability.data]
  );
  const isInventoryAvailabilityRequired =
    createOpen && Boolean(selectedRequestingBuId) && availabilitySrItemIds.length > 0;
  const isLoadingInventory = isInventoryAvailabilityRequired && allocationAvailability.isFetching;
  const isInventoryAvailabilityComplete =
    !isInventoryAvailabilityRequired ||
    availabilitySrItemIds.every((srItemId) => Boolean(availabilityBySrItemId[srItemId]));
  const hasInventoryAvailabilityError =
    isInventoryAvailabilityRequired &&
    !isLoadingInventory &&
    (allocationAvailability.isError || !isInventoryAvailabilityComplete);
  const isInventoryAvailabilityBlocked =
    isInventoryAvailabilityRequired &&
    (isLoadingInventory || allocationAvailability.isError || !isInventoryAvailabilityComplete);

  const warehouseLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const warehouse of warehousesData?.data || []) {
      map.set(warehouse.id, `${warehouse.code} - ${warehouse.name}`);
    }
    return map;
  }, [warehousesData?.data]);

  const warehouseById = useMemo(() => {
    const map = new Map<string, Warehouse>();
    for (const warehouse of warehousesData?.data || []) {
      map.set(warehouse.id, warehouse);
    }
    return map;
  }, [warehousesData?.data]);

  const businessUnitLabelById = useMemo(
    () =>
      new Map(
        availableBusinessUnits.map((businessUnit) => [
          businessUnit.id,
          `${businessUnit.code} - ${businessUnit.name}`,
        ])
      ),
    [availableBusinessUnits]
  );

  const deliveryNotes = useMemo(() => deliveryNotesData?.data || [], [deliveryNotesData?.data]);
  const deliveryNotesPagination = deliveryNotesData?.pagination;

  const stockRequests = useMemo(() => stockRequestsData?.data || [], [stockRequestsData?.data]);

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

  const actionItems = useMemo(
    () => (actionDn?.delivery_note_items || []).filter((item) => !item.is_voided),
    [actionDn?.delivery_note_items]
  );

  const filteredQueuePickerUsers = useMemo(() => {
    const q = queuePickerSearch.trim().toLowerCase();
    if (!q) return pickerUsers;
    return pickerUsers.filter((user) => user.label.toLowerCase().includes(q));
  }, [pickerUsers, queuePickerSearch]);

  const resolveWarehouseLabel = (warehouseId?: string | null) => {
    if (!warehouseId) return t("unknownWarehouse");
    return warehouseLabelById.get(warehouseId) || t("unknownWarehouse");
  };

  const statusLabel = useCallback(
    (status: string) => {
      switch (status) {
        case "draft":
          return t("draft");
        case "confirmed":
          return t("confirmed");
        case "queued_for_picking":
          return t("queuedForPicking");
        case "picking_in_progress":
          return t("pickingInProgress");
        case "dispatch_ready":
          return t("dispatchReady");
        case "dispatched":
          return t("dispatched");
        case "received":
          return t("received");
        case "voided":
          return t("voided");
        default:
          return toProperCase(status);
      }
    },
    [t]
  );

  const canReceiveDn = (dn: Pick<DeliveryNote, "requesting_business_unit_id">) => {
    if (!currentBusinessUnit?.id) return true;
    return dn.requesting_business_unit_id === currentBusinessUnit.id;
  };

  const canDispatchDn = (dn: Pick<DeliveryNote, "fulfilling_business_unit_id">) => {
    if (!currentBusinessUnit?.id) return true;
    return dn.fulfilling_business_unit_id === currentBusinessUnit.id;
  };

  const formatWarehouseAddress = (warehouseId?: string | null) => {
    if (!warehouseId) return "";
    const warehouse = warehouseById.get(warehouseId);
    if (!warehouse) return "";

    const parts = [
      warehouse.address,
      warehouse.city,
      warehouse.state,
      warehouse.postalCode,
      warehouse.country,
    ]
      .map((part) => part?.trim())
      .filter(Boolean);
    return parts.join(", ");
  };

  const handlePrintDeliveryNote = async (dn: DeliveryNote) => {
    try {
      setPrintingDnId(dn.id);
      const [{ pdf }, { DeliveryNotePDF: DeliveryNotePDFDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/delivery-notes/DeliveryNotePDF"),
      ]);
      const fullDn = await deliveryNotesApi.getById(dn.id);
      const logoUrl = `${window.location.origin}/achlers_circle.png`;

      const blob = await pdf(
        <DeliveryNotePDFDocument
          deliveryNote={fullDn}
          sourceLabel={resolveWarehouseLabel(fullDn.fulfilling_warehouse_id)}
          sourceAddress={formatWarehouseAddress(fullDn.fulfilling_warehouse_id)}
          destinationLabel={
            fullDn.requesting_warehouse_id
              ? resolveWarehouseLabel(fullDn.requesting_warehouse_id)
              : businessUnitLabelById.get(fullDn.requesting_business_unit_id) ||
                t("receivingWarehousePending")
          }
          destinationAddress={formatWarehouseAddress(fullDn.requesting_warehouse_id)}
          logoUrl={logoUrl}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, "_blank");
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        };
      } else {
        URL.revokeObjectURL(url);
      }
    } catch {
      // handled silently for now
    } finally {
      setPrintingDnId(null);
    }
  };

  const openActionDialog = (
    type: "confirm" | "queue_picking" | "dispatch" | "receive" | "void",
    dnId: string
  ) => {
    setActionType(type);
    setActionDnId(dnId);
    setActionOpen(true);
  };

  const actionItemLabel = (item: (typeof actionItems)[number]) => {
    const itemRef = Array.isArray(item.items) ? item.items[0] : item.items;
    return itemRef?.item_name || itemRef?.item_code || "Unknown item";
  };

  const actionRequestLabel = (item: (typeof actionItems)[number]) => {
    const requestRef = Array.isArray(item.stock_requests)
      ? item.stock_requests[0]
      : item.stock_requests;
    return requestRef?.request_code || "Unknown stock transfer";
  };

  const actionUomLabel = (item: (typeof actionItems)[number]) => {
    const directUnitOptionRef = Array.isArray(item.item_unit_options)
      ? item.item_unit_options[0]
      : item.item_unit_options;
    const stockRequestItemRef = Array.isArray(item.stock_request_items)
      ? item.stock_request_items[0]
      : item.stock_request_items;
    const unitOptionRef = stockRequestItemRef
      ? Array.isArray(stockRequestItemRef.item_unit_options)
        ? stockRequestItemRef.item_unit_options[0]
        : stockRequestItemRef.item_unit_options
      : null;
    const uomRef = Array.isArray(item.units_of_measure)
      ? item.units_of_measure[0]
      : item.units_of_measure;
    if (directUnitOptionRef) {
      return transformItemUnitOptionRow(
        directUnitOptionRef as unknown as DbItemUnitOptionRow,
        uomRef?.code || ""
      ).displayLabel;
    }
    if (unitOptionRef) {
      return transformItemUnitOptionRow(
        unitOptionRef as unknown as DbItemUnitOptionRow,
        uomRef?.code || ""
      ).displayLabel;
    }
    return uomRef?.symbol || uomRef?.name || "Unknown unit";
  };

  const getPrimaryRowAction = (
    dn: DeliveryNote,
    linkedPickList: DeliveryNotePickListSummary | null
  ) => {
    if (dn.status === "draft" && canDispatchDn(dn)) {
      return {
        label: t("confirm"),
        icon: <CheckCircle className="mr-2 h-4 w-4 text-blue-600" />,
        onClick: () => openActionDialog("confirm", dn.id),
      };
    }

    if (dn.status === "confirmed" && !linkedPickList && canDispatchDn(dn)) {
      return {
        label: t("queuePicking"),
        icon: <Package className="mr-2 h-4 w-4 text-amber-600" />,
        onClick: () => openActionDialog("queue_picking", dn.id),
      };
    }

    if (dn.status === "dispatch_ready" && canDispatchDn(dn)) {
      return {
        label: t("dispatch"),
        icon: <Truck className="mr-2 h-4 w-4 text-indigo-600" />,
        onClick: () => openActionDialog("dispatch", dn.id),
      };
    }

    if (dn.status === "dispatched" && canReceiveDn(dn)) {
      return {
        label: t("receive"),
        icon: <ClipboardCheck className="mr-2 h-4 w-4 text-emerald-600" />,
        onClick: () => openActionDialog("receive", dn.id),
      };
    }

    return null;
  };

  const selectableRequests = useMemo(() => {
    return stockRequests.filter(
      (request) =>
        request.fulfilling_business_unit_id === currentBusinessUnit?.id &&
        ["approved", "partially_allocated", "allocated"].includes(request.status)
    );
  }, [currentBusinessUnit?.id, stockRequests]);

  const requestingBusinessUnits = useMemo(() => {
    const map = new Map<string, string>();
    for (const request of selectableRequests) {
      const requestingBusinessUnitId = request.business_unit_id || "";
      if (!requestingBusinessUnitId) continue;
      const label = request.requesting_business_unit
        ? `${request.requesting_business_unit.code} - ${request.requesting_business_unit.name}`
        : businessUnitLabelById.get(requestingBusinessUnitId) || requestingBusinessUnitId;
      if (!map.has(requestingBusinessUnitId)) map.set(requestingBusinessUnitId, label);
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [businessUnitLabelById, selectableRequests]);

  const resetCreateState = () => {
    setSelectedRequestingBuId("");
    setNotes("");
    setCreateFulfillmentMode("transfer_to_store");
    setDraftLines([]);
    setSelectedLineIds(new Set());
    setCreateValidationError("");
  };

  const resetActionState = () => {
    setActionDnId("");
    setActionType("");
    setQueuePickerSearch("");
    setQueueNotes("");
    setSelectedQueuePickerIds(new Set());
    setDriverName("");
    setHelperName("");
    setDeliveryTime("");
    setPlateNumber("");
    setDispatchNotes("");
    setReceivingWarehouseId("");
    setVoidReason("");
  };

  const createPickListWithAllocationHandling = async (payload: CreatePickListPayload) => {
    try {
      await createPickListMutation.mutateAsync(payload);
      return true;
    } catch (error) {
      toast.error(getMutationErrorMessage(error, "Failed to create pick list"));
      return false;
    }
  };

  const onSelectRequestingBu = (buId: string) => {
    setSelectedRequestingBuId(buId);
    setSelectedLineIds(new Set());
    setCreateValidationError("");

    const lines = selectableRequests
      .filter((request) => request.business_unit_id === buId)
      .flatMap((request) =>
        (request.stock_request_items || [])
          .filter((item) => !!item.uom_id)
          .map((item) => {
            const requestedQty = Number(item.requested_qty || 0);
            return {
              requestCode: request.request_code,
              srItemId: item.id,
              uomLabel:
                item.item_unit_option?.displayLabel ||
                item.units_of_measure?.code ||
                item.units_of_measure?.symbol ||
                "",
              itemName: item.items?.item_name || item.items?.item_code || item.item_id,
              requestedQty,
              allocatableQty: requestedQty,
              allocatedQty: requestedQty,
              requestingBusinessUnitId: request.business_unit_id || "",
            } satisfies DraftLine;
          })
          .filter((line) => line.allocatableQty > 0 && !!line.requestingBusinessUnitId)
      );

    setDraftLines(lines);
  };

  const getAvailableQty = useCallback(
    (line: DraftLine) => availabilityBySrItemId[line.srItemId]?.availableQty,
    [availabilityBySrItemId]
  );

  const getMaxAllowedQty = useCallback(
    (line: DraftLine) => {
      const availability = availabilityBySrItemId[line.srItemId];
      if (!availability) return 0;
      return Math.max(0, Math.min(availability.remainingRequestQty, availability.availableQty));
    },
    [availabilityBySrItemId]
  );

  const updateAllocatedQty = (lineId: string, qty: number) => {
    setCreateValidationError("");
    setDraftLines((prev) =>
      prev.map((line) => {
        if (line.srItemId !== lineId) return line;
        const safeQty = Math.max(
          0,
          Math.min(getMaxAllowedQty(line), Number.isFinite(qty) ? qty : 0)
        );
        return { ...line, allocatedQty: safeQty };
      })
    );
  };

  const toggleLine = (line: DraftLine, checked: boolean) => {
    setCreateValidationError("");
    setSelectedLineIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(line.srItemId);
      else next.delete(line.srItemId);
      return next;
    });

    if (checked && line.allocatedQty <= 0) {
      updateAllocatedQty(line.srItemId, getMaxAllowedQty(line));
    }
  };

  const selectedLines = useMemo(
    () => draftLines.filter((line) => selectedLineIds.has(line.srItemId) && line.allocatedQty > 0),
    [draftLines, selectedLineIds]
  );

  const invalidSelectedLine = useMemo(
    () =>
      selectedLines.find((line) => {
        const availableQty = getAvailableQty(line);
        if (availableQty === undefined) return false;
        return line.allocatedQty > getMaxAllowedQty(line);
      }),
    [getAvailableQty, getMaxAllowedQty, selectedLines]
  );

  const handleCreate = async () => {
    setCreateValidationError("");
    const lines = selectedLines;
    if (lines.length === 0) return;
    if (isLoadingInventory) {
      setCreateValidationError(t("inventoryAvailabilityLoading"));
      return;
    }
    if (hasInventoryAvailabilityError || !isInventoryAvailabilityComplete) {
      setCreateValidationError(t("inventoryAvailabilityError"));
      return;
    }
    if (invalidSelectedLine) {
      const maxAllocatableQty = getMaxAllowedQty(invalidSelectedLine);
      setCreateValidationError(
        t("allocationExceedsAvailable", {
          item: invalidSelectedLine.itemName,
          quantity: maxAllocatableQty.toFixed(2),
        })
      );
      return;
    }

    try {
      const response = await createMutation.mutateAsync({
        fulfillmentMode: createFulfillmentMode,
        notes: notes.trim() || undefined,
        items: lines.map((line) => ({
          srItemId: line.srItemId,
          allocatedQty: line.allocatedQty,
        })),
      });

      toast.success(t("createSuccessCount", { count: response.data.length }));
      setCreateOpen(false);
      resetCreateState();
    } catch (error) {
      const errorCode = getApiErrorCode(error, CREATE_DELIVERY_NOTE_ERROR_CODES);
      const message =
        errorCode === "DELIVERY_NOTE_SELECTED_BATCH_INSUFFICIENT"
          ? t("selectedBatchInsufficient")
          : getMutationErrorMessage(error, t("createError"));
      toast.error(message);
      setCreateValidationError(message);
    }
  };

  const actionTitleByType: Record<Exclude<typeof actionType, "">, string> = {
    confirm: t("confirmTitle"),
    queue_picking: t("queuePickingTitle"),
    dispatch: t("dispatchTitle"),
    receive: t("receiveTitle"),
    void: t("voidTitle"),
  };

  const actionDescriptionByType: Record<Exclude<typeof actionType, "">, string> = {
    confirm: t("confirmDescription"),
    queue_picking: t("queuePickingDescription"),
    dispatch: t("dispatchDescription"),
    receive: t("receiveDescription"),
    void: t("voidDescription"),
  };

  const handleConfirmAction = async () => {
    if (!actionDn || !actionType) return;

    if (actionType === "confirm") {
      if (!canDispatchDn(actionDn)) {
        return;
      }

      try {
        await confirmMutation.mutateAsync(actionDn.id);
        toast.success("Delivery note confirmed");
      } catch (error) {
        toast.error(getMutationErrorMessage(error, "Failed to confirm delivery note"));
        return;
      }
    }

    if (actionType === "queue_picking") {
      if (!canDispatchDn(actionDn)) {
        return;
      }

      const pickerUserIds = Array.from(selectedQueuePickerIds);
      if (pickerUserIds.length === 0) return;

      const created = await createPickListWithAllocationHandling({
        dnId: actionDn.id,
        pickerUserIds,
        notes: queueNotes.trim() || undefined,
      });
      if (!created) {
        return;
      }
    }

    if (actionType === "dispatch") {
      if (!canDispatchDn(actionDn)) {
        return;
      }

      try {
        await dispatchMutation.mutateAsync({
          id: actionDn.id,
          data: {
            driverName: driverName.trim() || undefined,
            helperName: helperName.trim() || undefined,
            deliveryTime: deliveryTime || undefined,
            plateNumber: plateNumber.trim() || undefined,
            notes: dispatchNotes.trim() || undefined,
            items: actionItems
              .filter((item) => !item.is_voided)
              .map((item) => ({
                deliveryNoteItemId: item.id,
                dispatchQty: Math.max(
                  0,
                  Number(item.picked_qty || 0) - Number(item.dispatched_qty || 0)
                ),
              }))
              .filter((item) => item.dispatchQty > 0),
          },
        });
        toast.success("Delivery note dispatched");
      } catch (error) {
        toast.error(getMutationErrorMessage(error, "Failed to dispatch delivery note"));
        return;
      }
    }

    if (actionType === "receive") {
      if (!canReceiveDn(actionDn)) {
        return;
      }
      if (!receivingWarehouseId) {
        toast.error(t("receivingWarehouseRequired"));
        return;
      }

      try {
        await startReceivingMutation.mutateAsync({
          id: actionDn.id,
          receivingWarehouseId,
        });
        toast.success(t("startReceivingSuccess"));
      } catch (error) {
        toast.error(getMutationErrorMessage(error, t("startReceivingError")));
        return;
      }
    }

    if (actionType === "void") {
      try {
        await voidMutation.mutateAsync({
          id: actionDn.id,
          reason: voidReason.trim() || undefined,
        });
        toast.success("Delivery note voided");
      } catch (error) {
        toast.error(getMutationErrorMessage(error, "Failed to void delivery note"));
        return;
      }
    }

    setActionOpen(false);
    resetActionState();
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="whitespace-nowrap text-lg font-semibold tracking-tight sm:text-xl">
            {t("title")}
          </h1>
          <p className="whitespace-nowrap text-xs text-muted-foreground sm:text-sm">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button onClick={() => setCreateOpen(true)} className="w-full flex-shrink-0 sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            {t("createDn")}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Search and Filter Section */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="pl-8"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder={t("statusPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allStatus")}</SelectItem>
              <SelectItem value="draft">{t("draft")}</SelectItem>
              <SelectItem value="confirmed">{t("confirmed")}</SelectItem>
              <SelectItem value="queued_for_picking">{t("queuedForPicking")}</SelectItem>
              <SelectItem value="picking_in_progress">{t("pickingInProgress")}</SelectItem>
              <SelectItem value="dispatch_ready">{t("dispatchReady")}</SelectItem>
              <SelectItem value="dispatched">{t("dispatched")}</SelectItem>
              <SelectItem value="received">{t("received")}</SelectItem>
              <SelectItem value="voided">{t("voided")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table List */}
        {isLoading ? (
          <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>{t("dnNo")}</TableHead>
                  <TableHead>{t("requestedBy")}</TableHead>
                  <TableHead>{t("fulfilledBy")}</TableHead>
                  <TableHead>{t("pickList")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(8)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-8 w-24" />
                        <Skeleton className="h-8 w-8" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : deliveryNotes.length === 0 ? (
          <EmptyStatePanel
            icon={FileText}
            title={t("emptyTitle")}
            description={
              search || statusFilter !== "all"
                ? t("emptyFilteredDescription")
                : t("emptyDescription")
            }
          />
        ) : (
          <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>{t("dnNo")}</TableHead>
                  <TableHead>{t("requestedBy")}</TableHead>
                  <TableHead>{t("fulfilledBy")}</TableHead>
                  <TableHead>{t("pickList")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveryNotes.map((dn) => {
                  const linkedPickList = resolveActivePickList(dn);
                  const detailsHref = `/inventory/delivery-notes/${dn.id}`;
                  const primaryAction = getPrimaryRowAction(dn, linkedPickList);
                  const canVoidDn = [
                    "draft",
                    "confirmed",
                    "queued_for_picking",
                    "picking_in_progress",
                    "dispatch_ready",
                  ].includes(dn.status);

                  return (
                    <TableRow
                      key={dn.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={(event) => {
                        const target = event.target as HTMLElement;
                        if (target.closest("a,button,input,textarea,select,[role='menuitem']"))
                          return;
                        router.push(detailsHref);
                      }}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(dn.status)}
                          <span className="hover:underline">{dn.dn_no}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {businessUnitLabelById.get(dn.requesting_business_unit_id) || t("noValue")}
                      </TableCell>
                      <TableCell className="text-sm">
                        {resolveWarehouseLabel(dn.fulfilling_warehouse_id)}
                      </TableCell>
                      <TableCell>
                        {linkedPickList ? (
                          <Link
                            href="/inventory/pick-lists"
                            className="text-sm text-blue-600 hover:underline"
                          >
                            {linkedPickList.pick_list_no}
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">{t("noValue")}</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusText(dn.status, statusLabel(dn.status))}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              void handlePrintDeliveryNote(dn);
                            }}
                            disabled={printingDnId === dn.id}
                            aria-label={printingDnId === dn.id ? t("generatingPdf") : t("printPdf")}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            {t("printPdf")}
                          </Button>
                          {primaryAction ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={primaryAction.onClick}
                              aria-label={primaryAction.label}
                            >
                              {primaryAction.icon}
                              {primaryAction.label}
                            </Button>
                          ) : null}
                          {canVoidDn ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  aria-label={t("actions")}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => openActionDialog("void", dn.id)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <XCircle className="h-4 w-4" />
                                  <span>{t("void")}</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {deliveryNotesPagination && deliveryNotesPagination.totalPages > 1 ? (
          <div className="flex items-center justify-end gap-3">
            <span className="text-sm text-muted-foreground">
              {t("pageOf", {
                page: deliveryNotesPagination.page,
                totalPages: deliveryNotesPagination.totalPages,
              })}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={deliveryNotesPagination.page <= 1 || isLoading}
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
            >
              {t("previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={
                deliveryNotesPagination.page >= deliveryNotesPagination.totalPages || isLoading
              }
              onClick={() =>
                setPage((currentPage) =>
                  Math.min(deliveryNotesPagination.totalPages, currentPage + 1)
                )
              }
            >
              {t("next")}
            </Button>
          </div>
        ) : null}
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreateState();
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-7xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("createDialogTitle")}</DialogTitle>
            <DialogDescription>{t("createDialogDescription")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("requestingBusinessUnit")}</Label>
              <Select value={selectedRequestingBuId} onValueChange={onSelectRequestingBu}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectRequestingBusinessUnit")} />
                </SelectTrigger>
                <SelectContent>
                  {requestingBusinessUnits.map((bu) => (
                    <SelectItem key={bu.id} value={bu.id}>
                      {bu.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("fulfillmentMode")}</Label>
              <Select
                value={createFulfillmentMode}
                onValueChange={(value) =>
                  setCreateFulfillmentMode(value as DeliveryNoteFulfillmentMode)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectFulfillmentMode")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transfer_to_store">{t("transferToStore")}</SelectItem>
                  <SelectItem value="customer_pickup_from_warehouse">
                    {t("customerPickupWarehouse")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("fulfillmentModeHint")}</p>
            </div>

            <div className="space-y-2">
              <Label>{t("notes")}</Label>
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>

            {createValidationError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {createValidationError}
              </div>
            ) : null}

            {hasInventoryAvailabilityError ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <span>{t("inventoryAvailabilityError")}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void allocationAvailability.refetch()}
                >
                  {t("retryInventoryAvailability")}
                </Button>
              </div>
            ) : null}

            {selectedRequestingBuId && (
              <div className="rounded-lg border bg-blue-50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-muted-foreground">{t("sourceBuLabel")}</span>{" "}
                    <span className="font-medium">
                      {requestingBusinessUnits.find((bu) => bu.id === selectedRequestingBuId)
                        ?.label || t("noValue")}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <div>
                      <span className="text-muted-foreground">{t("eligibleLabel")}</span>{" "}
                      <span className="font-medium">{draftLines.length}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t("selectedLabel")}</span>{" "}
                      <span className="font-medium text-blue-600">{selectedLines.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!selectedRequestingBuId ? (
              <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center">
                <p className="text-sm text-muted-foreground">{t("selectRequestingBuHint")}</p>
              </div>
            ) : draftLines.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border">
                <Table className="min-w-max">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-12">{t("use")}</TableHead>
                      <TableHead>{t("sr")}</TableHead>
                      <TableHead className="w-48 max-w-48 whitespace-normal">{t("item")}</TableHead>
                      <TableHead className="text-right">{t("requested")}</TableHead>
                      <TableHead>{t("unit")}</TableHead>
                      <TableHead className="text-right">{t("qtyPerUnit")}</TableHead>
                      <TableHead className="text-right">{t("totalQty")}</TableHead>
                      <TableHead className="text-right">{t("allocatable")}</TableHead>
                      <TableHead className="text-right">{t("allocated")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {draftLines.map((line) => {
                      const availability = availabilityBySrItemId[line.srItemId];
                      const availableQty = getAvailableQty(line);
                      const maxAllowedQty = getMaxAllowedQty(line);
                      const hasInsufficientInventory =
                        selectedLineIds.has(line.srItemId) &&
                        availableQty !== undefined &&
                        line.allocatedQty > maxAllowedQty;

                      return (
                        <TableRow
                          key={line.srItemId}
                          className={
                            hasInsufficientInventory
                              ? "bg-red-50/40"
                              : selectedLineIds.has(line.srItemId)
                                ? "bg-blue-50/50"
                                : ""
                          }
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedLineIds.has(line.srItemId)}
                              disabled={isInventoryAvailabilityBlocked}
                              onCheckedChange={(checked) => toggleLine(line, checked === true)}
                            />
                          </TableCell>
                          <TableCell className="tabular-nums text-xs">{line.requestCode}</TableCell>
                          <TableCell className="w-48 max-w-48 whitespace-normal text-sm">
                            <div className="break-words font-medium leading-snug">
                              {line.itemName}
                            </div>
                            <div className="text-xs font-medium text-orange-600">
                              {t("availableLabel")}{" "}
                              {isLoadingInventory && getAvailableQty(line) === undefined
                                ? t("noValue")
                                : availableQty === undefined
                                  ? t("noValue")
                                  : `${availableQty.toFixed(2)} ${line.uomLabel || t("noValue")}`}
                            </div>
                            {hasInsufficientInventory && (
                              <div className="text-xs font-medium text-red-600">
                                {t("insufficientInventory")}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {line.requestedQty.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-sm">{line.uomLabel || t("noValue")}</TableCell>
                          <TableCell className="text-right">
                            {(availability?.qtyPerUnit || 1).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {(line.allocatedQty * (availability?.qtyPerUnit || 1)).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {(availability?.remainingRequestQty ?? 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              className="ml-auto w-28 text-right"
                              type="number"
                              min="0"
                              max={maxAllowedQty}
                              step="0.01"
                              value={line.allocatedQty}
                              disabled={
                                isInventoryAvailabilityBlocked ||
                                !selectedLineIds.has(line.srItemId)
                              }
                              onChange={(event) =>
                                updateAllocatedQty(
                                  line.srItemId,
                                  parseFloat(event.target.value) || 0
                                )
                              }
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center">
                <p className="text-sm text-muted-foreground">{t("noEligibleLines")}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                !selectedRequestingBuId ||
                selectedLines.length === 0 ||
                !!invalidSelectedLine ||
                isInventoryAvailabilityBlocked ||
                createMutation.isPending
              }
            >
              {t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={actionOpen}
        onOpenChange={(open) => {
          setActionOpen(open);
          if (!open) resetActionState();
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {actionType
                ? actionTitleByType[actionType as Exclude<typeof actionType, "">]
                : t("action")}
            </DialogTitle>
            <DialogDescription>
              {actionType
                ? actionDescriptionByType[actionType as Exclude<typeof actionType, "">]
                : t("actionDescriptionFallback")}
            </DialogDescription>
          </DialogHeader>

          {!actionDnId || isLoadingActionDn ? (
            <div className="text-sm text-muted-foreground">{t("loadingDetails")}</div>
          ) : !actionDn ? (
            <div className="text-sm text-destructive">{t("loadDetailsError")}</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 rounded-lg border bg-muted/30 p-4 text-sm md:grid-cols-4">
                <div>
                  <div className="text-xs text-muted-foreground">{t("dnNo")}</div>
                  <div className="font-medium">{actionDn.dn_no}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t("status")}</div>
                  <div className="font-medium">
                    {getStatusText(actionDn.status, statusLabel(actionDn.status))}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t("source")}</div>
                  <div className="font-medium">
                    {resolveWarehouseLabel(actionDn.fulfilling_warehouse_id)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t("destination")}</div>
                  <div className="font-medium">
                    {actionDn.requesting_warehouse_id
                      ? resolveWarehouseLabel(actionDn.requesting_warehouse_id)
                      : businessUnitLabelById.get(actionDn.requesting_business_unit_id) ||
                        t("receivingWarehousePending")}
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>{t("request")}</TableHead>
                      <TableHead>{t("item")}</TableHead>
                      <TableHead>{t("unit")}</TableHead>
                      <TableHead className="text-right">{t("allocated")}</TableHead>
                      <TableHead className="text-right">{t("picked")}</TableHead>
                      <TableHead className="text-right">{t("dispatchedQty")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actionItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm">{actionRequestLabel(item)}</TableCell>
                        <TableCell className="text-sm font-medium">
                          {actionItemLabel(item)}
                        </TableCell>
                        <TableCell className="text-sm">{actionUomLabel(item)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {Number(item.allocated_qty || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(item.picked_qty || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(item.dispatched_qty || 0).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {actionType === "queue_picking" && (
                <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t("assignPickers")}</Label>
                    <Input
                      placeholder={t("searchNameOrEmail")}
                      value={queuePickerSearch}
                      onChange={(event) => setQueuePickerSearch(event.target.value)}
                      className="mb-2"
                    />
                    <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border bg-background p-3">
                      {filteredQueuePickerUsers.length > 0 ? (
                        filteredQueuePickerUsers.map((user) => (
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
                        ))
                      ) : (
                        <div className="py-4 text-center text-sm text-muted-foreground">
                          {t("noPickersFound")}
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
              )}

              {actionType === "dispatch" && (
                <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t("driverName")}</Label>
                    <Input
                      placeholder={t("enterDriverName")}
                      value={driverName}
                      onChange={(event) => setDriverName(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">{t("helperName")}</Label>
                      <Input
                        placeholder={t("enterHelperName")}
                        value={helperName}
                        onChange={(event) => setHelperName(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">{t("deliveryTime")}</Label>
                      <Input
                        type="time"
                        value={deliveryTime}
                        onChange={(event) => setDeliveryTime(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">{t("plateNumber")}</Label>
                      <Input
                        placeholder={t("enterPlateNumber")}
                        value={plateNumber}
                        onChange={(event) => setPlateNumber(event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t("dispatchNotes")}</Label>
                    <Textarea
                      placeholder={t("optionalDispatchNotes")}
                      value={dispatchNotes}
                      onChange={(event) => setDispatchNotes(event.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
              )}

              {actionType === "receive" && (
                <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
                  <Label className="text-sm font-medium">{t("receivingWarehouse")}</Label>
                  <WarehouseSelect
                    value={receivingWarehouseId}
                    onValueChange={setReceivingWarehouseId}
                    scope="current_business_unit"
                  />
                  <p className="text-xs text-muted-foreground">{t("receivingWarehouseHint")}</p>
                </div>
              )}

              {actionType === "void" && (
                <div className="space-y-2 rounded-lg border bg-red-50 p-4">
                  <Label className="text-sm font-medium">{t("voidReason")}</Label>
                  <Textarea
                    placeholder={t("voidReasonPlaceholder")}
                    value={voidReason}
                    onChange={(event) => setVoidReason(event.target.value)}
                    rows={3}
                  />
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setActionOpen(false)}>
                  {t("cancel")}
                </Button>
                <Button
                  onClick={handleConfirmAction}
                  disabled={
                    (actionType === "queue_picking" && selectedQueuePickerIds.size === 0) ||
                    confirmMutation.isPending ||
                    createPickListMutation.isPending ||
                    dispatchMutation.isPending ||
                    startReceivingMutation.isPending ||
                    (actionType === "receive" && !receivingWarehouseId) ||
                    voidMutation.isPending
                  }
                >
                  {actionType === "queue_picking"
                    ? t("confirmCreatePickList")
                    : actionType === "dispatch"
                      ? t("confirmDispatch")
                      : actionType === "receive"
                        ? t("confirmStartReceiving")
                        : actionType === "void"
                          ? t("confirmVoid")
                          : t("confirm")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
