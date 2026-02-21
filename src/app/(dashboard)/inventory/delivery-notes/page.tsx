"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { pdf } from "@react-pdf/renderer";
import {
  Plus,
  Search,
  Filter,
  FileText,
  Eye,
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
  useDeliveryNote,
  useDeliveryNotes,
  useDispatchDeliveryNote,
  useReceiveDeliveryNote,
  useVoidDeliveryNote,
} from "@/hooks/useDeliveryNotes";
import { useCreatePickList } from "@/hooks/usePickLists";
import { useStockRequests } from "@/hooks/useStockRequests";
import { useUsers } from "@/hooks/useUsers";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import { deliveryNotesApi } from "@/lib/api/delivery-notes";
import { DeliveryNotePDF } from "@/components/delivery-notes/DeliveryNotePDF";
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
import type { DeliveryNote, DeliveryNotePickListSummary } from "@/types/delivery-note";
import type { Warehouse } from "@/types/warehouse";
import { toProperCase } from "@/lib/string";

const getStatusBadge = (status: string) => {
  const baseClass = "text-xs font-medium";

  switch (status) {
    case "draft":
      return <span className={`${baseClass} text-slate-500`}>Draft</span>;
    case "confirmed":
      return <span className={`${baseClass} text-blue-600`}>Confirmed</span>;
    case "queued_for_picking":
      return <span className={`${baseClass} text-amber-600`}>Queued for Picking</span>;
    case "picking_in_progress":
      return <span className={`${baseClass} text-orange-600`}>Picking in Progress</span>;
    case "dispatch_ready":
      return <span className={`${baseClass} text-purple-600`}>Dispatch Ready</span>;
    case "dispatched":
      return <span className={`${baseClass} text-indigo-600`}>Dispatched</span>;
    case "received":
      return <span className={`${baseClass} text-emerald-600`}>Received</span>;
    case "voided":
      return <span className={`${baseClass} text-red-600`}>Voided</span>;
    default:
      return <span className={`${baseClass} text-muted-foreground`}>{toProperCase(status)}</span>;
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
  srId: string;
  requestCode: string;
  srItemId: string;
  itemId: string;
  uomId: string;
  itemName: string;
  requestedQty: number;
  allocatableQty: number;
  allocatedQty: number;
  requestingWarehouseId: string;
  fulfillingWarehouseId: string;
  sourceBuId: string;
};

type WarehouseInventoryApiResponse = {
  data?: {
    inventory?: Array<{
      itemId: string;
      availableStock: number;
    }>;
  };
};

const resolveActivePickList = (deliveryNote: DeliveryNote): DeliveryNotePickListSummary | null => {
  const rows = deliveryNote.pick_lists || [];
  const active = rows
    .filter((row) => !row.deleted_at)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return active.find((row) => row.status !== "cancelled") || active[0] || null;
};

export default function DeliveryNotesPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
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
  const [dispatchNotes, setDispatchNotes] = useState("");
  const [printingDnId, setPrintingDnId] = useState<string | null>(null);
  const [receiveNotes, setReceiveNotes] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const [selectedSourceBuId, setSelectedSourceBuId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());
  const [createValidationError, setCreateValidationError] = useState<string>("");
  const [availableQtyByWarehouseItem, setAvailableQtyByWarehouseItem] = useState<
    Record<string, number>
  >({});
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);

  const { data: deliveryNotesData, isLoading } = useDeliveryNotes(
    statusFilter === "all" ? undefined : statusFilter
  );
  const { data: stockRequestsData } = useStockRequests({ page: 1, limit: 50 });
  const { data: usersData } = useUsers();
  const { data: warehousesData } = useWarehouses({ page: 1, limit: 1000 });
  const { data: actionDn, isLoading: isLoadingActionDn } = useDeliveryNote(actionDnId);
  const currentBusinessUnit = useBusinessUnitStore((state) => state.currentBusinessUnit);
  const createMutation = useCreateDeliveryNote();
  const createPickListMutation = useCreatePickList();
  const confirmMutation = useConfirmDeliveryNote();
  const dispatchMutation = useDispatchDeliveryNote();
  const receiveMutation = useReceiveDeliveryNote();
  const voidMutation = useVoidDeliveryNote();

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

  // Client-side filtering
  const allDeliveryNotes = useMemo(() => deliveryNotesData?.data || [], [deliveryNotesData?.data]);

  const deliveryNotes = useMemo(() => {
    let filtered = allDeliveryNotes;

    // Apply search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (dn) =>
          dn.dn_no?.toLowerCase().includes(searchLower) ||
          warehouseLabelById.get(dn.requesting_warehouse_id)?.toLowerCase().includes(searchLower) ||
          warehouseLabelById.get(dn.fulfilling_warehouse_id)?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [allDeliveryNotes, search, warehouseLabelById]);

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

  const actionItems = useMemo(() => actionDn?.delivery_note_items || [], [actionDn?.delivery_note_items]);

  const filteredQueuePickerUsers = useMemo(() => {
    const q = queuePickerSearch.trim().toLowerCase();
    if (!q) return pickerUsers;
    return pickerUsers.filter((user) => user.label.toLowerCase().includes(q));
  }, [pickerUsers, queuePickerSearch]);

  const warehouseBusinessUnitById = useMemo(() => {
    const map = new Map<string, string>();
    for (const warehouse of warehousesData?.data || []) {
      if (warehouse.businessUnitId) {
        map.set(warehouse.id, warehouse.businessUnitId);
      }
    }
    return map;
  }, [warehousesData?.data]);

  const resolveWarehouseLabel = (warehouseId?: string | null) => {
    if (!warehouseId) return "Unknown warehouse";
    return warehouseLabelById.get(warehouseId) || "Unknown warehouse";
  };

  const canReceiveDn = (dn: Pick<DeliveryNote, "fulfilling_warehouse_id">) => {
    if (!currentBusinessUnit?.id) return true;
    const fulfillingWarehouseBuId = warehouseBusinessUnitById.get(dn.fulfilling_warehouse_id);
    return fulfillingWarehouseBuId !== currentBusinessUnit.id;
  };

  const formatWarehouseAddress = (warehouseId?: string | null) => {
    if (!warehouseId) return "";
    const warehouse = warehouseById.get(warehouseId);
    if (!warehouse) return "";

    const parts = [warehouse.address, warehouse.city, warehouse.state, warehouse.postalCode, warehouse.country]
      .map((part) => part?.trim())
      .filter(Boolean);
    return parts.join(", ");
  };

  const handlePrintDeliveryNote = async (dn: DeliveryNote) => {
    try {
      setPrintingDnId(dn.id);
      const fullDn = await deliveryNotesApi.getById(dn.id);
      const logoUrl = `${window.location.origin}/achlers_circle.png`;

      const blob = await pdf(
        <DeliveryNotePDF
          deliveryNote={fullDn}
          sourceLabel={resolveWarehouseLabel(fullDn.requesting_warehouse_id)}
          sourceAddress={formatWarehouseAddress(fullDn.requesting_warehouse_id)}
          destinationLabel={resolveWarehouseLabel(fullDn.fulfilling_warehouse_id)}
          destinationAddress={formatWarehouseAddress(fullDn.fulfilling_warehouse_id)}
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
    const requestRef = Array.isArray(item.stock_requests) ? item.stock_requests[0] : item.stock_requests;
    return requestRef?.request_code || "Unknown stock request";
  };

  const actionUomLabel = (item: (typeof actionItems)[number]) => {
    const uomRef = Array.isArray(item.units_of_measure) ? item.units_of_measure[0] : item.units_of_measure;
    return uomRef?.symbol || uomRef?.name || "Unknown unit";
  };

  const selectableRequests = useMemo(() => {
    return stockRequests.filter(
      (request) => !["draft", "cancelled", "completed", "fulfilled"].includes(request.status)
    );
  }, [stockRequests]);

  const sourceBusinessUnits = useMemo(() => {
    const map = new Map<string, string>();
    for (const request of selectableRequests) {
      const sourceBuId = request.requesting_warehouse?.businessUnitId || request.business_unit_id || "";
      if (!sourceBuId) continue;
      const label =
        request.requesting_warehouse?.warehouse_name ||
        request.requesting_warehouse?.warehouse_code ||
        sourceBuId;
      if (!map.has(sourceBuId)) map.set(sourceBuId, label);
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [selectableRequests]);

  const resetCreateState = () => {
    setSelectedSourceBuId("");
    setNotes("");
    setDraftLines([]);
    setSelectedLineIds(new Set());
    setCreateValidationError("");
    setAvailableQtyByWarehouseItem({});
    setIsLoadingInventory(false);
  };

  const resetActionState = () => {
    setActionDnId("");
    setActionType("");
    setQueuePickerSearch("");
    setQueueNotes("");
    setSelectedQueuePickerIds(new Set());
    setDriverName("");
    setDispatchNotes("");
    setReceiveNotes("");
    setVoidReason("");
  };

  const onSelectSourceBu = (buId: string) => {
    setSelectedSourceBuId(buId);
    setSelectedLineIds(new Set());
    setCreateValidationError("");

    const lines = selectableRequests
      .filter((request) => {
        const sourceBuId = request.requesting_warehouse?.businessUnitId || request.business_unit_id || "";
        return sourceBuId === buId;
      })
      .flatMap((request) =>
        (request.stock_request_items || [])
          .filter((item) => !!item.uom_id)
          .map((item) => {
            const requestedQty = Number(item.requested_qty || 0);
            const receivedQty = Number(item.received_qty || 0);
            const allocatableQty = Math.max(0, requestedQty - receivedQty);
            return {
              srId: request.id,
              requestCode: request.request_code,
              srItemId: item.id,
              itemId: item.item_id,
              uomId: item.uom_id,
              itemName: item.items?.item_name || item.items?.item_code || item.item_id,
              requestedQty,
              allocatableQty,
              allocatedQty: allocatableQty,
              requestingWarehouseId: request.requesting_warehouse_id,
              fulfillingWarehouseId: request.fulfilling_warehouse_id || "",
              sourceBuId: request.requesting_warehouse?.businessUnitId || request.business_unit_id || "",
            } satisfies DraftLine;
          })
          .filter((line) => line.allocatableQty > 0 && !!line.fulfillingWarehouseId)
      );

    setDraftLines(lines);
  };

  const getAvailableQty = useCallback(
    (line: DraftLine) => {
      const key = `${line.fulfillingWarehouseId}:${line.itemId}`;
      return availableQtyByWarehouseItem[key];
    },
    [availableQtyByWarehouseItem]
  );

  const getMaxAllowedQty = useCallback(
    (line: DraftLine) => {
      const availableQty = getAvailableQty(line);
      if (availableQty === undefined) return line.allocatableQty;
      return Math.max(0, Math.min(line.allocatableQty, availableQty));
    },
    [getAvailableQty]
  );

  const updateAllocatedQty = (lineId: string, qty: number) => {
    setCreateValidationError("");
    setDraftLines((prev) =>
      prev.map((line) => {
        if (line.srItemId !== lineId) return line;
        const safeQty = Math.max(0, Math.min(line.allocatableQty, Number.isFinite(qty) ? qty : 0));
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

  useEffect(() => {
    if (!createOpen || !selectedSourceBuId || draftLines.length === 0) {
      setAvailableQtyByWarehouseItem({});
      setIsLoadingInventory(false);
      return;
    }

    const warehouseIds = Array.from(new Set(draftLines.map((line) => line.fulfillingWarehouseId)));
    if (warehouseIds.length === 0) {
      setAvailableQtyByWarehouseItem({});
      setIsLoadingInventory(false);
      return;
    }

    let cancelled = false;
    setIsLoadingInventory(true);

    const loadWarehouseInventory = async () => {
      const responses = await Promise.all(
        warehouseIds.map(async (warehouseId) => {
          try {
            const response = await fetch(`/api/warehouses/${warehouseId}/inventory`);
            if (!response.ok) return { warehouseId, inventory: [] };
            const payload = (await response.json()) as WarehouseInventoryApiResponse;
            return { warehouseId, inventory: payload.data?.inventory || [] };
          } catch {
            return { warehouseId, inventory: [] };
          }
        })
      );

      if (cancelled) return;

      const next: Record<string, number> = {};
      for (const entry of responses) {
        for (const row of entry.inventory) {
          next[`${entry.warehouseId}:${row.itemId}`] = Number(row.availableStock || 0);
        }
      }

      setAvailableQtyByWarehouseItem(next);
      setIsLoadingInventory(false);
    };

    void loadWarehouseInventory();

    return () => {
      cancelled = true;
    };
  }, [createOpen, draftLines, selectedSourceBuId]);

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
      setCreateValidationError("Please wait for inventory availability to finish loading.");
      return;
    }
    if (invalidSelectedLine) {
      const maxAllocatableQty = getMaxAllowedQty(invalidSelectedLine);
      setCreateValidationError(
        `Allocated quantity for ${invalidSelectedLine.itemName} exceeds the allowed maximum (${maxAllocatableQty.toFixed(2)}).`
      );
      return;
    }

    const distinctSrIds = Array.from(new Set(lines.map((line) => line.srId)));
    const requestingWarehouseId = lines[0]?.requestingWarehouseId;
    const fulfillingWarehouseId = lines[0]?.fulfillingWarehouseId;
    if (!requestingWarehouseId || !fulfillingWarehouseId) return;

    try {
      await createMutation.mutateAsync({
        requestingWarehouseId,
        fulfillingWarehouseId,
        srIds: distinctSrIds,
        notes: notes.trim() || undefined,
        items: lines.map((line) => ({
          srId: line.srId,
          srItemId: line.srItemId,
          itemId: line.itemId,
          uomId: line.uomId,
          allocatedQty: line.allocatedQty,
        })),
      });

      setCreateOpen(false);
      resetCreateState();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to create delivery note. Please review allocated quantities and try again.";
      setCreateValidationError(message);
    }
  };

  const actionTitleByType: Record<Exclude<typeof actionType, "">, string> = {
    confirm: "Confirm Delivery Note",
    queue_picking: "Queue Picking",
    dispatch: "Dispatch Delivery Note",
    receive: "Receive Delivery Note",
    void: "Void Delivery Note",
  };

  const actionDescriptionByType: Record<Exclude<typeof actionType, "">, string> = {
    confirm: "Review the details below, then confirm this delivery note.",
    queue_picking: "Review this delivery note, assign pickers, then create the pick list.",
    dispatch: "Review the details and confirm dispatch. Dispatched quantities will use picked quantities.",
    receive: "Review the details and confirm receive.",
    void: "Review the details and confirm void.",
  };

  const handleConfirmAction = async () => {
    if (!actionDn || !actionType) return;

    if (actionType === "confirm") {
      await confirmMutation.mutateAsync(actionDn.id);
    }

    if (actionType === "queue_picking") {
      const pickerUserIds = Array.from(selectedQueuePickerIds);
      if (pickerUserIds.length === 0) return;

      await createPickListMutation.mutateAsync({
        dnId: actionDn.id,
        pickerUserIds,
        notes: queueNotes.trim() || undefined,
      });
    }

    if (actionType === "dispatch") {
      await dispatchMutation.mutateAsync({
        id: actionDn.id,
        data: {
          driverName: driverName.trim() || undefined,
          notes: dispatchNotes.trim() || undefined,
          items: actionItems.map((item) => ({
            deliveryNoteItemId: item.id,
            dispatchQty: Number(item.picked_qty || 0),
          })),
        },
      });
    }

    if (actionType === "receive") {
      if (!canReceiveDn(actionDn)) {
        return;
      }

      await receiveMutation.mutateAsync({
        id: actionDn.id,
        data: {
          notes: receiveNotes.trim() || undefined,
          items: actionItems.map((item) => ({
            deliveryNoteItemId: item.id,
            receivedQty: Number(item.dispatched_qty || 0),
          })),
        },
      });
    }

    if (actionType === "void") {
      await voidMutation.mutateAsync({
        id: actionDn.id,
        reason: voidReason.trim() || undefined,
      });
    }

    setActionOpen(false);
    resetActionState();
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      {/* Header Section */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight whitespace-nowrap">Delivery Notes</h1>
          <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
            Manage DN lifecycle for stock request fulfillment
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button onClick={() => setCreateOpen(true)} className="w-full sm:w-auto flex-shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            Create DN
          </Button>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative w-full sm:flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search delivery notes or warehouses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="queued_for_picking">Queued for Picking</SelectItem>
            <SelectItem value="picking_in_progress">Picking in Progress</SelectItem>
            <SelectItem value="dispatch_ready">Dispatch Ready</SelectItem>
            <SelectItem value="dispatched">Dispatched</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table List */}
      {isLoading ? (
        <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>DN No</TableHead>
                <TableHead>Requested By</TableHead>
                <TableHead>Fulfilled By</TableHead>
                <TableHead>Pick List</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
                    <div className="flex justify-end">
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
          title="No delivery notes found"
          description={
            search || statusFilter !== "all"
              ? "Try adjusting your search or filters."
              : "Create your first delivery note to get started."
          }
        />
      ) : (
        <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>DN No</TableHead>
                <TableHead>Requested By</TableHead>
                <TableHead>Fulfilled By</TableHead>
                <TableHead>Pick List</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveryNotes.map((dn) => {
                const linkedPickList = resolveActivePickList(dn);
                const detailsHref = `/inventory/delivery-notes/${dn.id}`;

                return (
                  <TableRow
                    key={dn.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={(event) => {
                      const target = event.target as HTMLElement;
                      if (target.closest("a,button,input,textarea,select,[role='menuitem']")) return;
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
                      {resolveWarehouseLabel(dn.requesting_warehouse_id)}
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
                        <span className="text-xs text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(dn.status)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(detailsHref)}
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            void handlePrintDeliveryNote(dn);
                          }}
                          disabled={printingDnId === dn.id}
                          title={printingDnId === dn.id ? "Generating PDF..." : "Print PDF"}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        {dn.status === "draft" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openActionDialog("confirm", dn.id)}
                            title="Confirm"
                          >
                            <CheckCircle className="h-4 w-4 text-blue-600" />
                          </Button>
                        )}
                        {dn.status === "confirmed" && !linkedPickList && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openActionDialog("queue_picking", dn.id)}
                            title="Queue Picking"
                          >
                            <Package className="h-4 w-4 text-amber-600" />
                          </Button>
                        )}
                        {dn.status === "dispatch_ready" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openActionDialog("dispatch", dn.id)}
                            title="Dispatch"
                          >
                            <Truck className="h-4 w-4 text-indigo-600" />
                          </Button>
                        )}
                        {dn.status === "dispatched" && canReceiveDn(dn) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openActionDialog("receive", dn.id)}
                            title="Receive"
                          >
                            <ClipboardCheck className="h-4 w-4 text-emerald-600" />
                          </Button>
                        )}
                        {[
                          "draft",
                          "confirmed",
                          "queued_for_picking",
                          "picking_in_progress",
                          "dispatch_ready",
                        ].includes(dn.status) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openActionDialog("void", dn.id)}
                            title="Void"
                          >
                            <XCircle className="h-4 w-4 text-red-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreateState();
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Delivery Note</DialogTitle>
            <DialogDescription>
              Select source business unit, then choose stock-request lines for allocation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Request Source Business Unit</Label>
              <Select value={selectedSourceBuId} onValueChange={onSelectSourceBu}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source business unit" />
                </SelectTrigger>
                <SelectContent>
                  {sourceBusinessUnits.map((bu) => (
                    <SelectItem key={bu.id} value={bu.id}>
                      {bu.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>

            {createValidationError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {createValidationError}
              </div>
            ) : null}

            {selectedSourceBuId && (
              <div className="rounded-lg border bg-blue-50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-muted-foreground">Source BU:</span>{" "}
                    <span className="font-medium">
                      {sourceBusinessUnits.find((bu) => bu.id === selectedSourceBuId)?.label || "--"}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <div>
                      <span className="text-muted-foreground">Eligible:</span>{" "}
                      <span className="font-medium">{draftLines.length}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Selected:</span>{" "}
                      <span className="font-medium text-blue-600">{selectedLines.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!selectedSourceBuId ? (
              <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Select a source business unit to load stock request lines
                </p>
              </div>
            ) : draftLines.length > 0 ? (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-12">Use</TableHead>
                      <TableHead>SR</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Requested</TableHead>
                      <TableHead className="text-right">Allocatable</TableHead>
                      <TableHead className="text-right">Allocated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {draftLines.map((line) => {
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
                            onCheckedChange={(checked) => toggleLine(line, checked === true)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{line.requestCode}</TableCell>
                        <TableCell className="text-sm">
                          <div className="font-medium">{line.itemName}</div>
                          <div className="text-xs font-medium text-orange-600">
                            Available:{" "}
                            {isLoadingInventory && getAvailableQty(line) === undefined
                              ? "--"
                              : (getAvailableQty(line) || 0).toFixed(2)}
                          </div>
                          {hasInsufficientInventory && (
                            <div className="text-xs font-medium text-red-600">
                              Insufficient inventory for this allocation.
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{line.requestedQty.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium">{line.allocatableQty.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            className="ml-auto w-28 text-right"
                            type="number"
                            min="0"
                            max={line.allocatableQty}
                            step="0.01"
                            value={line.allocatedQty}
                            disabled={!selectedLineIds.has(line.srItemId)}
                            onChange={(event) =>
                              updateAllocatedQty(line.srItemId, parseFloat(event.target.value) || 0)
                            }
                          />
                        </TableCell>
                      </TableRow>
                    )})}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No eligible stock request lines found for this source business unit
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                !selectedSourceBuId ||
                selectedLines.length === 0 ||
                !!invalidSelectedLine ||
                createMutation.isPending
              }
            >
              Create
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
              {actionType ? actionTitleByType[actionType as Exclude<typeof actionType, "">] : "Action"}
            </DialogTitle>
            <DialogDescription>
              {actionType
                ? actionDescriptionByType[actionType as Exclude<typeof actionType, "">]
                : "Review details and confirm action."}
            </DialogDescription>
          </DialogHeader>

          {!actionDnId || isLoadingActionDn ? (
            <div className="text-sm text-muted-foreground">Loading details...</div>
          ) : !actionDn ? (
            <div className="text-sm text-destructive">Unable to load delivery note details.</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 rounded-lg border bg-muted/30 p-4 text-sm md:grid-cols-4">
                <div>
                  <div className="text-xs text-muted-foreground">DN No</div>
                  <div className="font-medium">{actionDn.dn_no}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="font-medium">{getStatusBadge(actionDn.status)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Source</div>
                  <div className="font-medium">{resolveWarehouseLabel(actionDn.requesting_warehouse_id)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Destination</div>
                  <div className="font-medium">{resolveWarehouseLabel(actionDn.fulfilling_warehouse_id)}</div>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Request</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Allocated</TableHead>
                      <TableHead className="text-right">Picked</TableHead>
                      <TableHead className="text-right">Dispatched</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actionItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm">{actionRequestLabel(item)}</TableCell>
                        <TableCell className="text-sm font-medium">{actionItemLabel(item)}</TableCell>
                        <TableCell className="text-sm">{actionUomLabel(item)}</TableCell>
                        <TableCell className="text-right font-medium">{Number(item.allocated_qty || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-right">{Number(item.picked_qty || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-right">{Number(item.dispatched_qty || 0).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {actionType === "queue_picking" && (
                <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Assign Pickers</Label>
                    <Input
                      placeholder="Search name or email..."
                      value={queuePickerSearch}
                      onChange={(event) => setQueuePickerSearch(event.target.value)}
                      className="mb-2"
                    />
                    <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border bg-background p-3">
                      {filteredQueuePickerUsers.length > 0 ? (
                        filteredQueuePickerUsers.map((user) => (
                          <label key={user.id} className="flex cursor-pointer items-center gap-3 text-sm hover:bg-muted/50 rounded p-2 transition-colors">
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
                        <div className="text-sm text-muted-foreground text-center py-4">No pickers found</div>
                      )}
                    </div>
                    {selectedQueuePickerIds.size > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {selectedQueuePickerIds.size} picker{selectedQueuePickerIds.size > 1 ? 's' : ''} selected
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Picking Instructions</Label>
                    <Textarea
                      placeholder="Optional picking instructions..."
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
                    <Label className="text-sm font-medium">Driver Name</Label>
                    <Input
                      placeholder="Enter driver name"
                      value={driverName}
                      onChange={(event) => setDriverName(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Dispatch Notes</Label>
                    <Textarea
                      placeholder="Optional dispatch notes..."
                      value={dispatchNotes}
                      onChange={(event) => setDispatchNotes(event.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
              )}

              {actionType === "receive" && (
                <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
                  <Label className="text-sm font-medium">Receive Notes</Label>
                  <Textarea
                    placeholder="Optional receive notes..."
                    value={receiveNotes}
                    onChange={(event) => setReceiveNotes(event.target.value)}
                    rows={3}
                  />
                </div>
              )}

              {actionType === "void" && (
                <div className="space-y-2 rounded-lg border bg-red-50 p-4">
                  <Label className="text-sm font-medium">Void Reason</Label>
                  <Textarea
                    placeholder="Please provide a reason for voiding this delivery note..."
                    value={voidReason}
                    onChange={(event) => setVoidReason(event.target.value)}
                    rows={3}
                  />
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setActionOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmAction}
                  disabled={
                    (actionType === "queue_picking" && selectedQueuePickerIds.size === 0) ||
                    confirmMutation.isPending ||
                    createPickListMutation.isPending ||
                    dispatchMutation.isPending ||
                    receiveMutation.isPending ||
                    voidMutation.isPending
                  }
                >
                  {actionType === "queue_picking"
                    ? "Confirm Create Pick List"
                    : actionType === "dispatch"
                      ? "Confirm Dispatch"
                      : actionType === "receive"
                        ? "Confirm Receive"
                        : actionType === "void"
                          ? "Confirm Void"
                          : "Confirm"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
