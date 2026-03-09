"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Package2, Pencil, Plus, TrendingDown, XCircle } from "lucide-react";
import {
  useAddDeliveryNoteItems,
  useAdjustDispatchedDeliveryNoteItem,
  useConfirmDeliveryNote,
  useDeliveryNote,
  useDeliveryNoteAllocatableItems,
  useDispatchDeliveryNote,
  useReceiveDeliveryNote,
  useVoidDeliveryNote,
} from "@/hooks/useDeliveryNotes";
import { useCreatePickList } from "@/hooks/usePickLists";
import { useUsers } from "@/hooks/useUsers";
import { useWarehouse } from "@/hooks/useWarehouses";
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
import { toProperCase } from "@/lib/string";

const formatDate = (value: string | null | undefined, locale: string) => {
  if (!value) return "--";
  return new Date(value).toLocaleString(locale);
};

const toNumber = (value: number | string | null | undefined) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function DeliveryNoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("deliveryNoteDetailPage");
  const id = params.id as string;

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
  const { data: usersData } = useUsers();

  const [queueOpen, setQueueOpen] = useState(false);
  const [queuePickerSearch, setQueuePickerSearch] = useState("");
  const [queueNotes, setQueueNotes] = useState("");
  const [selectedQueuePickerIds, setSelectedQueuePickerIds] = useState<Set<string>>(new Set());

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
  const [dispatchNotes, setDispatchNotes] = useState("");
  const [receiveNotes, setReceiveNotes] = useState("");
  const [voidReason, setVoidReason] = useState("");

  const items = useMemo(() => dn?.delivery_note_items || [], [dn?.delivery_note_items]);
  const allocatableItems = useMemo(() => allocatableItemsData?.data || [], [allocatableItemsData?.data]);
  const { data: sourceWarehouseData } = useWarehouse(dn?.requesting_warehouse_id || "");
  const { data: destinationWarehouseData } = useWarehouse(dn?.fulfilling_warehouse_id || "");

  const activePickList = useMemo(() => {
    const rows = dn?.pick_lists || [];
    return rows.find((row) => !row.deleted_at && ["pending", "in_progress", "paused"].includes(row.status)) || null;
  }, [dn?.pick_lists]);

  const linkedPickList = useMemo(() => {
    const rows = dn?.pick_lists || [];
    const sorted = rows
      .filter((row) => !row.deleted_at)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return sorted.find((row) => row.status !== "cancelled") || sorted[0] || null;
  }, [dn?.pick_lists]);

  const hasPendingPickableLines = useMemo(
    () => items.some((item) => !item.is_voided && toNumber(item.allocated_qty) > toNumber(item.picked_qty)),
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
      { label: t("pickingCompleted"), value: dn?.picking_completed_at, userId: dn?.picking_completed_by },
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

  const one = <T,>(value: T | T[] | null | undefined): T | null =>
    Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

  const sourceWarehouseLabel =
    [sourceWarehouseData?.data?.code, sourceWarehouseData?.data?.name].filter(Boolean).join(" - ") ||
    t("unknownSourceWarehouse");

  const destinationWarehouseLabel =
    [destinationWarehouseData?.data?.code, destinationWarehouseData?.data?.name]
      .filter(Boolean)
      .join(" - ") || t("unknownDestinationWarehouse");

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
      units_of_measure?: EmbeddedUomRef | EmbeddedUomRef[] | null;
    };
    const ref = one(row.units_of_measure);
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
    Object.prototype.hasOwnProperty.call(receivedQtyMap, itemId) ? receivedQtyMap[itemId] : fallback;

  const canQueuePicking =
    !!dn &&
    ["confirmed", "dispatched"].includes(dn.status) &&
    !activePickList &&
    hasPendingPickableLines;

  const submitDispatch = async () => {
    if (!dn) return;

    const payload = {
      driverName: driverName.trim() || undefined,
      driverSignature: driverSignature.trim(),
      notes: dispatchNotes.trim() || undefined,
      items: items.map((item) => ({
        deliveryNoteItemId: item.id,
        dispatchQty: Math.max(0, toNumber(item.picked_qty) - toNumber(item.dispatched_qty)),
      })),
    };

    await dispatchMutation.mutateAsync({ id: dn.id, data: payload });
  };

  const submitReceive = async () => {
    if (!dn) return;

    const payload = {
      notes: receiveNotes.trim() || undefined,
      items: items
        .filter((item) => !item.is_voided && toNumber(item.dispatched_qty) > 0)
        .map((item) => ({
          deliveryNoteItemId: item.id,
          receivedQty: getReceivedQty(item.id, toNumber(item.dispatched_qty)),
        })),
    };

    await receiveMutation.mutateAsync({
      id: dn.id,
      fulfillmentMode: dn.fulfillment_mode || "transfer_to_store",
      data: payload,
    });
  };

  const submitCreatePickList = async () => {
    if (!dn) return;
    const pickerUserIds = Array.from(selectedQueuePickerIds);
    if (pickerUserIds.length === 0) return;

    await createPickListMutation.mutateAsync({
      dnId: dn.id,
      pickerUserIds,
      notes: queueNotes.trim() || undefined,
    });

    setQueueOpen(false);
    setQueuePickerSearch("");
    setQueueNotes("");
    setSelectedQueuePickerIds(new Set());
  };

  const submitAdjustItem = async () => {
    if (!dn || !adjustItemId) return;

    await adjustItemMutation.mutateAsync({
      id: dn.id,
      itemId: adjustItemId,
      data: {
        dispatchedQty: Math.max(0, parseFloat(adjustDispatchedQty) || 0),
        reason: adjustReason.trim() || undefined,
      },
    });

    setAdjustItemId(null);
    setAdjustDispatchedQty("");
    setAdjustReason("");
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

    setAddItemsOpen(false);
    setAddItemSearch("");
    setAddItemNotes("");
    setSelectedAddPickerIds(new Set());
    setSelectedAddQtyMap({});
  };

  if (isLoading) {
    return <div className="container mx-auto p-6 text-sm text-muted-foreground">{t("loading")}</div>;
  }

  if (error || !dn) {
    return <div className="container mx-auto p-6 text-sm text-destructive">{t("loadError")}</div>;
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">{dn.dn_no}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {dn.status === "draft" && (
            <Button onClick={() => confirmMutation.mutateAsync(dn.id)} disabled={confirmMutation.isPending}>
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
          {["picking_in_progress", "dispatch_ready", "draft", "confirmed", "queued_for_picking"].includes(
            dn.status
          ) && (
            <Button
              variant="destructive"
              onClick={() => voidMutation.mutateAsync({ id: dn.id, reason: voidReason || undefined })}
              disabled={voidMutation.isPending}
            >
              {t("void")}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">{t("status")}</div>
          <div className="mt-1 text-sm font-semibold">{statusLabel(dn.status)}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">{t("sourceWarehouse")}</div>
          <div className="mt-1 text-sm font-medium">{sourceWarehouseLabel}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">{t("destinationWarehouse")}</div>
          <div className="mt-1 text-sm font-medium">{destinationWarehouseLabel}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">{t("linkedPickList")}</div>
          {linkedPickList ? (
            <Link href="/inventory/pick-lists" className="mt-1 inline-block text-sm font-medium text-blue-600 hover:underline">
              {linkedPickList.pick_list_no}
            </Link>
          ) : (
            <div className="mt-1 text-sm font-medium text-muted-foreground">{t("noValue")}</div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2">
              <Package2 className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium text-muted-foreground">{t("totalItems")}</span>
            </div>
            <div className="mt-2 text-2xl font-bold">{items.length}</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2">
              <Package2 className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-muted-foreground">{t("totalAllocated")}</span>
            </div>
            <div className="mt-2 text-2xl font-bold">
              {items.reduce((sum, item) => sum + toNumber(item.allocated_qty), 0).toFixed(2)}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-orange-600" />
              <span className="text-xs font-medium text-muted-foreground">{t("totalShort")}</span>
            </div>
            <div className="mt-2 text-2xl font-bold text-orange-600">
              {items.reduce((sum, item) => sum + toNumber(item.short_qty), 0).toFixed(2)}
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card">
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
                  <TableHead className="text-right font-semibold">{t("allocated")}</TableHead>
                  <TableHead className="text-right font-semibold">{t("picked")}</TableHead>
                  <TableHead className="text-right font-semibold">{t("short")}</TableHead>
                  <TableHead className="text-right font-semibold">{t("dispatchedQty")}</TableHead>
                  <TableHead className="font-semibold">{t("lineState")}</TableHead>
                  {dn.status === "dispatched" && <TableHead className="text-right font-semibold">{t("actions")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const allocatedQty = toNumber(item.allocated_qty);
                  const pickedQty = toNumber(item.picked_qty);
                  const shortQty = toNumber(item.short_qty);
                  const dispatchedQty = toNumber(item.dispatched_qty);
                  const pickCompletion = allocatedQty > 0 ? ((pickedQty / allocatedQty) * 100).toFixed(0) : 0;

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{requestLabel(item)}</TableCell>
                      <TableCell>
                        <div className="font-medium">{itemLabel(item)}</div>
                        {item.void_reason && item.is_voided && (
                          <div className="mt-1 text-xs text-muted-foreground">{item.void_reason}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">{uomLabel(item)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-semibold">{allocatedQty.toFixed(2)}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="space-y-1">
                          <div className="font-medium">{pickedQty.toFixed(2)}</div>
                          <div className="text-xs text-muted-foreground">{pickCompletion}%</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {shortQty > 0 ? (
                          <div className="inline-flex items-center gap-1 rounded-md bg-orange-50 px-2 py-1">
                            <TrendingDown className="h-3 w-3 text-orange-600" />
                            <span className="font-semibold text-orange-600">{shortQty.toFixed(2)}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">{shortQty.toFixed(2)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-medium">{dispatchedQty.toFixed(2)}</div>
                      </TableCell>
                      <TableCell>
                        <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">{lineStateLabel(item)}</span>
                      </TableCell>
                      {dn.status === "dispatched" && (
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

      {(dn.status === "queued_for_picking" || dn.status === "picking_in_progress") && (
        <div className="rounded-lg border bg-blue-50/50 p-4">
          <h2 className="text-base font-semibold">{t("pickingControl")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("pickingControlDescription")}</p>
          <div className="mt-3">
            <Button asChild variant="outline">
              <Link href="/inventory/pick-lists">{t("openPickLists")}</Link>
            </Button>
          </div>
        </div>
      )}

      {dn.status === "dispatch_ready" && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">{t("dispatchInformation")}</h2>
          <div className="space-y-3 rounded-lg border bg-card p-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">{t("driverName")}</Label>
              <Input placeholder={t("enterDriverName")} value={driverName} onChange={(event) => setDriverName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                {t("driverSignature")} <span className="text-red-500">*</span>
              </Label>
              <Input placeholder={t("required")} value={driverSignature} onChange={(event) => setDriverSignature(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">{t("dispatchNotes")}</Label>
              <Textarea placeholder={t("optionalNotes")} value={dispatchNotes} onChange={(event) => setDispatchNotes(event.target.value)} rows={3} />
            </div>
            <Button onClick={submitDispatch} disabled={dispatchMutation.isPending || !driverSignature.trim()} className="w-full sm:w-auto">
              {dispatchMutation.isPending ? t("dispatching") : t("confirmDispatch")}
            </Button>
          </div>
        </div>
      )}

      {dn.status === "dispatched" && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">{t("receiveDelivery")}</h2>
          <div className="space-y-4 rounded-lg border bg-card p-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">{t("receiveNotes")}</Label>
              <Textarea placeholder={t("optionalNotes")} value={receiveNotes} onChange={(event) => setReceiveNotes(event.target.value)} rows={3} />
            </div>
            <div className="space-y-3">
              <div className="text-sm font-medium">{t("receivedQuantities")}</div>
              {items
                .filter((item) => !item.is_voided && toNumber(item.dispatched_qty) > 0)
                .map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
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
                              Math.min(toNumber(item.dispatched_qty), parseFloat(event.target.value) || 0)
                            ),
                          }))
                        }
                      />
                    </div>
                  </div>
                ))}
            </div>
            <Button onClick={submitReceive} disabled={receiveMutation.isPending} className="w-full sm:w-auto">
              {receiveMutation.isPending ? t("receiving") : t("confirmReceive")}
            </Button>
          </div>
        </div>
      )}

      {dn.status === "voided" && dn.void_reason && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">{t("voidInformation")}</h2>
          <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">{t("voidReason")}</Label>
              <p className="text-sm">{dn.void_reason}</p>
            </div>
          </div>
        </div>
      )}

      {["draft", "confirmed", "queued_for_picking", "picking_in_progress", "dispatch_ready"].includes(dn.status) && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">{t("voidDeliveryNote")}</h2>
          <div className="space-y-3 rounded-lg border border-red-200 bg-red-50/50 p-4">
            <Textarea
              placeholder={t("reasonForVoidingOptional")}
              value={voidReason}
              onChange={(event) => setVoidReason(event.target.value)}
              rows={3}
            />
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-base font-semibold">{t("timeline")}</h2>
        <div className="relative rounded-lg border bg-muted/20 p-6">
          <div className="space-y-6">
            {timeline.map((event, index) => {
              const userName = getUserDisplayName(event.userId);

              return (
                <div key={event.label} className="relative flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className={`h-3 w-3 rounded-full border-2 ${
                        event.value ? "border-blue-600 bg-blue-600" : "border-muted-foreground/30 bg-background"
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
                        <div className={`text-sm font-medium ${event.value ? "text-foreground" : "text-muted-foreground"}`}>
                          {event.label}
                        </div>
                        {userName && event.value && (
                          <div className="mt-1 text-xs text-muted-foreground">{t("byUser", { user: userName })}</div>
                        )}
                      </div>
                      <span className={`whitespace-nowrap text-sm ${event.value ? "text-foreground" : "text-muted-foreground"}`}>
                        {formatDate(event.value, locale)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Dialog open={queueOpen} onOpenChange={setQueueOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("createPickList")}</DialogTitle>
            <DialogDescription>{t("createPickListDescription", { code: dn.dn_no })}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("assignPickers")}</Label>
              <Input placeholder={t("searchNameOrEmail")} value={queuePickerSearch} onChange={(event) => setQueuePickerSearch(event.target.value)} />
              <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border bg-muted/30 p-3">
                {filteredQueuePickerUsers.map((user) => (
                  <label key={user.id} className="flex cursor-pointer items-center gap-3 rounded p-2 text-sm transition-colors hover:bg-muted/50">
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
                {filteredQueuePickerUsers.length === 0 && <div className="py-4 text-center text-sm text-muted-foreground">{t("noMatchingUsers")}</div>}
              </div>
              {selectedQueuePickerIds.size > 0 && (
                <div className="text-xs text-muted-foreground">{t("pickersSelected", { count: selectedQueuePickerIds.size })}</div>
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
            <Button onClick={submitCreatePickList} disabled={selectedQueuePickerIds.size === 0 || createPickListMutation.isPending}>
              {createPickListMutation.isPending ? t("creating") : t("createPickList")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <Input type="number" min="0" step="0.01" value={adjustDispatchedQty} onChange={(event) => setAdjustDispatchedQty(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("reason")}</Label>
              <Textarea rows={3} placeholder={t("reasonOptional")} value={adjustReason} onChange={(event) => setAdjustReason(event.target.value)} />
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
              <Input placeholder={t("searchItems")} value={addItemSearch} onChange={(event) => setAddItemSearch(event.target.value)} />
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
                        <div className="font-medium">{item.itemName || item.itemCode || t("unknownItem")}</div>
                        {item.itemCode && <div className="text-xs text-muted-foreground">{item.itemCode}</div>}
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
                  <label key={user.id} className="flex cursor-pointer items-center gap-3 rounded p-2 text-sm hover:bg-muted/50">
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
              <Textarea rows={3} placeholder={t("optionalPickingInstructions")} value={addItemNotes} onChange={(event) => setAddItemNotes(event.target.value)} />
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
                  (item) => Math.max(0, Math.min(item.allocatableQty, parseFloat(selectedAddQtyMap[item.srItemId] || "0") || 0)) > 0
                )
              }
            >
              {addItemsMutation.isPending ? t("creatingReplacementPickList") : t("addSelectedItems")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
