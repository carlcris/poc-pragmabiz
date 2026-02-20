"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Package2, TrendingDown } from "lucide-react";
import {
  useConfirmDeliveryNote,
  useDeliveryNote,
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


const formatDate = (value?: string | null) => {
  if (!value) return "--";
  return new Date(value).toLocaleString();
};

const statusLabel = (status: string) => toProperCase(status);

export default function DeliveryNoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: dn, isLoading, error } = useDeliveryNote(id);

  const confirmMutation = useConfirmDeliveryNote();
  const createPickListMutation = useCreatePickList();
  const dispatchMutation = useDispatchDeliveryNote();
  const receiveMutation = useReceiveDeliveryNote();
  const voidMutation = useVoidDeliveryNote();
  const { data: usersData } = useUsers();

  const [queueOpen, setQueueOpen] = useState(false);
  const [queuePickerSearch, setQueuePickerSearch] = useState("");
  const [queueNotes, setQueueNotes] = useState("");
  const [selectedQueuePickerIds, setSelectedQueuePickerIds] = useState<Set<string>>(new Set());

  const [receivedQtyMap, setReceivedQtyMap] = useState<Record<string, number>>({});
  const [driverName, setDriverName] = useState("");
  const [driverSignature, setDriverSignature] = useState("");
  const [dispatchNotes, setDispatchNotes] = useState("");
  const [receiveNotes, setReceiveNotes] = useState("");
  const [voidReason, setVoidReason] = useState("");

  const items = dn?.delivery_note_items || [];
  const { data: sourceWarehouseData } = useWarehouse(dn?.requesting_warehouse_id || "");
  const { data: destinationWarehouseData } = useWarehouse(dn?.fulfilling_warehouse_id || "");

  const linkedPickList = useMemo(() => {
    const rows = dn?.pick_lists || [];
    const sorted = rows
      .filter((row) => !row.deleted_at)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return sorted.find((row) => row.status !== "cancelled") || sorted[0] || null;
  }, [dn?.pick_lists]);

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

  const timeline = useMemo(
    () => [
      { label: "Created", value: dn?.created_at, userId: dn?.created_by },
      { label: "Confirmed", value: dn?.confirmed_at, userId: dn?.updated_by },
      { label: "Picking Started", value: dn?.picking_started_at, userId: dn?.picking_started_by },
      { label: "Picking Completed", value: dn?.picking_completed_at, userId: dn?.picking_completed_by },
      { label: "Dispatched", value: dn?.dispatched_at, userId: dn?.updated_by },
      { label: "Received", value: dn?.received_at, userId: dn?.updated_by },
      { label: "Voided", value: dn?.voided_at, userId: dn?.updated_by },
    ],
    [dn]
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

  const toNumber = (value: number | string | null | undefined) => {
    if (value == null) return 0;
    const parsed = typeof value === "number" ? value : parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  type EmbeddedItemRef = { item_name?: string | null; item_code?: string | null };
  type EmbeddedUomRef = { code?: string | null; symbol?: string | null; name?: string | null };
  type EmbeddedStockRequestRef = { request_code?: string | null };

  const one = <T,>(value: T | T[] | null | undefined): T | null =>
    Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

  const sourceWarehouseLabel =
    [sourceWarehouseData?.data?.code, sourceWarehouseData?.data?.name].filter(Boolean).join(" - ") ||
    "Unknown source warehouse";

  const destinationWarehouseLabel =
    [destinationWarehouseData?.data?.code, destinationWarehouseData?.data?.name]
      .filter(Boolean)
      .join(" - ") || "Unknown destination warehouse";

  const itemLabel = (item: (typeof items)[number]) => {
    const row = item as typeof item & { items?: EmbeddedItemRef | EmbeddedItemRef[] | null };
    const ref = one(row.items);
    return ref?.item_name || ref?.item_code || "Unknown item";
  };

  const uomLabel = (item: (typeof items)[number]) => {
    const row = item as typeof item & {
      units_of_measure?: EmbeddedUomRef | EmbeddedUomRef[] | null;
    };
    const ref = one(row.units_of_measure);
    return ref?.code || ref?.symbol || ref?.name || "Unknown unit";
  };

  const requestLabel = (item: (typeof items)[number]) => {
    const row = item as typeof item & {
      stock_requests?: EmbeddedStockRequestRef | EmbeddedStockRequestRef[] | null;
    };
    const ref = one(row.stock_requests);
    return ref?.request_code || "Unknown stock request";
  };

  const getReceivedQty = (itemId: string, fallback: number) =>
    Object.prototype.hasOwnProperty.call(receivedQtyMap, itemId) ? receivedQtyMap[itemId] : fallback;

  const submitDispatch = async () => {
    if (!dn) return;

    const payload = {
      driverName: driverName.trim() || undefined,
      driverSignature: driverSignature.trim(),
      notes: dispatchNotes.trim() || undefined,
      items: items.map((item) => ({
        deliveryNoteItemId: item.id,
        dispatchQty: toNumber(item.picked_qty),
      })),
    };

    await dispatchMutation.mutateAsync({ id: dn.id, data: payload });
  };

  const submitReceive = async () => {
    if (!dn) return;

    const payload = {
      notes: receiveNotes.trim() || undefined,
      items: items.map((item) => ({
        deliveryNoteItemId: item.id,
        receivedQty: getReceivedQty(item.id, toNumber(item.dispatched_qty)),
      })),
    };

    await receiveMutation.mutateAsync({ id: dn.id, data: payload });
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

  if (isLoading) {
    return <div className="container mx-auto p-6 text-sm text-muted-foreground">Loading...</div>;
  }

  if (error || !dn) {
    return (
      <div className="container mx-auto p-6 text-sm text-destructive">
        Failed to load delivery note.
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Delivery Note</h1>
            <p className="text-sm text-muted-foreground">{dn.dn_no}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {dn.status === "draft" && (
            <Button onClick={() => confirmMutation.mutateAsync(dn.id)} disabled={confirmMutation.isPending}>
              Confirm
            </Button>
          )}
          {dn.status === "confirmed" && !linkedPickList && (
            <Button onClick={() => setQueueOpen(true)} disabled={createPickListMutation.isPending}>
              Queue Picking
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
              onClick={() => voidMutation.mutateAsync({ id: dn.id, reason: voidReason || undefined })}
              disabled={voidMutation.isPending}
            >
              Void
            </Button>
          )}
        </div>
      </div>

      {/* Summary Section */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Status</div>
          <div className="mt-1 text-sm font-semibold">{statusLabel(dn.status)}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Source Warehouse</div>
          <div className="mt-1 text-sm font-medium">{sourceWarehouseLabel}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Destination Warehouse</div>
          <div className="mt-1 text-sm font-medium">{destinationWarehouseLabel}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Linked Pick List</div>
          {linkedPickList ? (
            <Link href="/inventory/pick-lists" className="mt-1 inline-block text-sm font-medium text-blue-600 hover:underline">
              {linkedPickList.pick_list_no}
            </Link>
          ) : (
            <div className="mt-1 text-sm font-medium text-muted-foreground">--</div>
          )}
        </div>
      </div>

      {/* Items Section */}
      <div className="space-y-3">
        {/* Items Summary Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2">
              <Package2 className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium text-muted-foreground">Total Items</span>
            </div>
            <div className="mt-2 text-2xl font-bold">{items.length}</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2">
              <Package2 className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-muted-foreground">Total Allocated</span>
            </div>
            <div className="mt-2 text-2xl font-bold">
              {items.reduce((sum, item) => sum + toNumber(item.allocated_qty), 0).toFixed(2)}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-orange-600" />
              <span className="text-xs font-medium text-muted-foreground">Total Short</span>
            </div>
            <div className="mt-2 text-2xl font-bold text-orange-600">
              {items.reduce((sum, item) => sum + toNumber(item.short_qty), 0).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="rounded-lg border bg-card">
          <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
            <Package2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Item Details</h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">Stock Request</TableHead>
                  <TableHead className="font-semibold">Item</TableHead>
                  <TableHead className="font-semibold">UOM</TableHead>
                  <TableHead className="text-right font-semibold">Allocated</TableHead>
                  <TableHead className="text-right font-semibold">Picked</TableHead>
                  <TableHead className="text-right font-semibold">Short</TableHead>
                  <TableHead className="text-right font-semibold">Dispatched</TableHead>
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
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {requestLabel(item)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{itemLabel(item)}</div>
                      </TableCell>
                      <TableCell>
                        <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                          {uomLabel(item)}
                        </span>
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
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Picking Control Section */}
      {(dn.status === "queued_for_picking" || dn.status === "picking_in_progress") && (
        <div className="rounded-lg border bg-blue-50/50 p-4">
          <h2 className="text-base font-semibold">Picking Control</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Picking progress and status transitions are managed on the Pick Lists page.
          </p>
          <div className="mt-3">
            <Button asChild variant="outline">
              <Link href="/inventory/pick-lists">Open Pick Lists</Link>
            </Button>
          </div>
        </div>
      )}

      {/* Dispatch Section */}
      {dn.status === "dispatch_ready" && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Dispatch Information</h2>
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Driver Name</Label>
              <Input
                placeholder="Enter driver name"
                value={driverName}
                onChange={(event) => setDriverName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Driver Signature <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="Required"
                value={driverSignature}
                onChange={(event) => setDriverSignature(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Dispatch Notes</Label>
              <Textarea
                placeholder="Optional notes"
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
              {dispatchMutation.isPending ? "Dispatching..." : "Confirm Dispatch"}
            </Button>
          </div>
        </div>
      )}

      {/* Receive Section */}
      {dn.status === "dispatched" && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Receive Delivery</h2>
          <div className="rounded-lg border bg-card p-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Receive Notes</Label>
              <Textarea
                placeholder="Optional notes"
                value={receiveNotes}
                onChange={(event) => setReceiveNotes(event.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-3">
              <div className="text-sm font-medium">Received Quantities</div>
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{itemLabel(item)}</div>
                    <div className="text-xs text-muted-foreground">{requestLabel(item)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Qty:</span>
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
              {receiveMutation.isPending ? "Receiving..." : "Confirm Receive"}
            </Button>
          </div>
        </div>
      )}

      {/* Void Reason Display (for voided delivery notes) */}
      {dn.status === "voided" && dn.void_reason && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Void Information</h2>
          <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Void Reason</Label>
              <p className="text-sm">{dn.void_reason}</p>
            </div>
          </div>
        </div>
      )}

      {/* Void Section (for active delivery notes) */}
      {["draft", "confirmed", "queued_for_picking", "picking_in_progress", "dispatch_ready"].includes(
        dn.status
      ) && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Void Delivery Note</h2>
          <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 space-y-3">
            <Textarea
              placeholder="Reason for voiding (optional)"
              value={voidReason}
              onChange={(event) => setVoidReason(event.target.value)}
              rows={3}
            />
          </div>
        </div>
      )}

      {/* Timeline Section */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Timeline</h2>
        <div className="relative rounded-lg border bg-muted/20 p-6">
          <div className="space-y-6">
            {timeline.map((event, index) => {
              const userName = getUserDisplayName(event.userId);

              return (
                <div key={event.label} className="relative flex gap-4">
                  {/* Timeline connector */}
                  <div className="flex flex-col items-center">
                    <div className={`h-3 w-3 rounded-full border-2 ${event.value ? 'bg-blue-600 border-blue-600' : 'bg-background border-muted-foreground/30'}`} />
                    {index < timeline.length - 1 && (
                      <div className={`w-0.5 flex-1 mt-1 ${timeline[index + 1].value ? 'bg-blue-600' : 'bg-muted-foreground/20'}`} style={{ minHeight: '24px' }} />
                    )}
                  </div>

                  {/* Event content */}
                  <div className="flex-1 pb-2">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className={`text-sm font-medium ${event.value ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {event.label}
                        </div>
                        {userName && event.value && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            by {userName}
                          </div>
                        )}
                      </div>
                      <span className={`text-sm whitespace-nowrap ${event.value ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {formatDate(event.value)}
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
            <DialogTitle>Create Pick List</DialogTitle>
            <DialogDescription>
              Assign pickers for {dn.dn_no}. Picker assignment is owned by the pick list.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Assign Pickers</Label>
              <Input
                placeholder="Search name or email..."
                value={queuePickerSearch}
                onChange={(event) => setQueuePickerSearch(event.target.value)}
              />
              <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border bg-muted/30 p-3">
                {filteredQueuePickerUsers.map((user) => (
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
                ))}
                {filteredQueuePickerUsers.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">No matching users</div>
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setQueueOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitCreatePickList}
              disabled={selectedQueuePickerIds.size === 0 || createPickListMutation.isPending}
            >
              {createPickListMutation.isPending ? "Creating..." : "Create Pick List"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
