"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ClipboardList,
  Search,
  Filter,
  Clock,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Package,
} from "lucide-react";
import {
  usePickLists,
  useUpdatePickListItems,
  useUpdatePickListStatus,
} from "@/hooks/usePickLists";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyStatePanel } from "@/components/shared/EmptyStatePanel";
import { toProperCase } from "@/lib/string";

const getStatusBadge = (status: string) => {
  const baseClass = "text-xs font-medium";

  switch (status) {
    case "pending":
      return <span className={`${baseClass} text-amber-600`}>Pending</span>;
    case "in_progress":
      return <span className={`${baseClass} text-blue-600`}>In Progress</span>;
    case "paused":
      return <span className={`${baseClass} text-orange-600`}>Paused</span>;
    case "done":
      return <span className={`${baseClass} text-emerald-600`}>Done</span>;
    case "cancelled":
      return <span className={`${baseClass} text-red-600`}>Cancelled</span>;
    default:
      return <span className={`${baseClass} text-muted-foreground`}>{toProperCase(status)}</span>;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "pending":
      return <Clock className="h-4 w-4 text-amber-600" />;
    case "in_progress":
      return <Play className="h-4 w-4 text-blue-600" />;
    case "paused":
      return <Pause className="h-4 w-4 text-orange-600" />;
    case "done":
      return <CheckCircle className="h-4 w-4 text-emerald-600" />;
    case "cancelled":
      return <XCircle className="h-4 w-4 text-red-600" />;
    default:
      return <Package className="h-4 w-4 text-muted-foreground" />;
  }
};

const formatDate = (value?: string | null) => {
  if (!value) return "--";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toNumber = (value: number | string | null | undefined) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const toItemLabel = (item: {
  items?: { item_name: string | null; item_code: string | null } | null;
  item_id: string;
}) => item.items?.item_name || item.items?.item_code || item.item_id;

const toUomLabel = (item: {
  units_of_measure?: { symbol: string | null; name: string | null } | null;
}) => item.units_of_measure?.symbol || item.units_of_measure?.name || "--";

export default function PickListsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [detailId, setDetailId] = useState<string>("");
  const [itemQtyMap, setItemQtyMap] = useState<Record<string, number>>({});
  const [cancelReason, setCancelReason] = useState("");

  const { data, isLoading } = usePickLists({
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const updateStatusMutation = useUpdatePickListStatus();
  const updateItemsMutation = useUpdatePickListItems();

  // Client-side filtering
  const allPickLists = useMemo(() => data?.data || [], [data?.data]);

  const pickLists = useMemo(() => {
    let filtered = allPickLists;

    // Apply search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (pl) =>
          pl.pick_list_no?.toLowerCase().includes(searchLower) ||
          pl.delivery_notes?.dn_no?.toLowerCase().includes(searchLower) ||
          pl.pick_list_assignees?.some((assignee) => {
            const user = assignee.users;
            const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ");
            return (
              fullName.toLowerCase().includes(searchLower) ||
              user?.email?.toLowerCase().includes(searchLower)
            );
          })
      );
    }

    return filtered;
  }, [allPickLists, search]);

  const selected = useMemo(() => pickLists.find((row) => row.id === detailId) || null, [detailId, pickLists]);

  const getLinePickedQty = (itemId: string, fallback: number) =>
    Object.prototype.hasOwnProperty.call(itemQtyMap, itemId) ? itemQtyMap[itemId] : fallback;

  const submitItems = async () => {
    if (!selected?.pick_list_items || selected.pick_list_items.length === 0) return;

    await updateItemsMutation.mutateAsync({
      id: selected.id,
      data: {
        items: selected.pick_list_items.map((item) => ({
          pickListItemId: item.id,
          pickedQty: getLinePickedQty(item.id, toNumber(item.picked_qty)),
        })),
      },
    });
  };

  const transitionStatus = async (status: "in_progress" | "paused" | "done" | "cancelled") => {
    if (!selected) return;
    await updateStatusMutation.mutateAsync({
      id: selected.id,
      data: {
        status,
        reason: status === "cancelled" ? cancelReason.trim() || undefined : undefined,
      },
    });
    if (status === "cancelled") {
      setCancelReason("");
    }
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      {/* Header Section */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight whitespace-nowrap">Pick Lists</h1>
          <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
            Manage picker assignments, picking quantities, and status flow
          </p>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative w-full sm:flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search pick lists, delivery notes, or assignees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="done">Done</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table List */}
      {isLoading ? (
        <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>Pick List #</TableHead>
                <TableHead>Delivery Note</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assignees</TableHead>
                <TableHead>Created</TableHead>
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
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <Skeleton className="h-8 w-16" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : pickLists.length === 0 ? (
        <EmptyStatePanel
          icon={ClipboardList}
          title="No pick lists found"
          description={
            search || statusFilter !== "all"
              ? "Try adjusting your search or filters."
              : "Pick lists will appear here once created from delivery notes."
          }
        />
      ) : (
        <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>Pick List #</TableHead>
                <TableHead>Delivery Note</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assignees</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pickLists.map((row) => {
                const assignees = (row.pick_list_assignees || []).map((assignee) => {
                  const user = assignee.users;
                  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
                  return fullName || user?.email || assignee.user_id;
                });

                return (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setDetailId(row.id)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(row.status)}
                        {row.pick_list_no}
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.delivery_notes ? (
                        <Link
                          href={`/inventory/delivery-notes/${row.delivery_notes.id}`}
                          className="text-blue-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.delivery_notes.dn_no}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(row.status)}</TableCell>
                    <TableCell className="max-w-60 truncate text-sm">
                      {assignees.length > 0 ? assignees.join(", ") : (
                        <span className="text-muted-foreground">No assignees</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(row.created_at)}</TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setDetailId(row.id)}>
                          View Details
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pick List Details Dialog */}
      <Dialog
        open={!!detailId}
        onOpenChange={(open) => {
          if (!open) {
            setDetailId("");
            setItemQtyMap({});
            setCancelReason("");
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getStatusIcon(selected?.status || "")}
              {selected?.pick_list_no || "Pick List Details"}
            </DialogTitle>
            <DialogDescription>
              Delivery Note: {selected?.delivery_notes?.dn_no || "--"} | Status:{" "}
              {selected ? getStatusBadge(selected.status) : "--"}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-5">
              {/* Pick List Summary */}
              <div className="grid grid-cols-2 gap-4 rounded-lg border bg-muted/30 p-4 text-sm md:grid-cols-3">
                <div>
                  <div className="text-xs text-muted-foreground">Pick List #</div>
                  <div className="font-medium">{selected.pick_list_no}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Delivery Note</div>
                  <div className="font-medium">
                    {selected.delivery_notes ? (
                      <Link
                        href={`/inventory/delivery-notes/${selected.delivery_notes.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {selected.delivery_notes.dn_no}
                      </Link>
                    ) : (
                      "--"
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Created</div>
                  <div className="font-medium">{formatDate(selected.created_at)}</div>
                </div>
              </div>

              {/* Assignees */}
              {selected.pick_list_assignees && selected.pick_list_assignees.length > 0 && (
                <div className="rounded-lg border p-4">
                  <div className="mb-2 text-sm font-medium">Assigned Pickers</div>
                  <div className="flex flex-wrap gap-2">
                    {selected.pick_list_assignees.map((assignee) => {
                      const user = assignee.users;
                      const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
                      const displayName = fullName || user?.email || "Unknown";
                      return (
                        <div
                          key={assignee.user_id}
                          className="rounded-md bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                        >
                          {displayName}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Items Table */}
              <div className="space-y-2">
                <div className="text-sm font-medium">Pick List Items</div>
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Item</TableHead>
                        <TableHead>UOM</TableHead>
                        <TableHead className="text-right">Allocated</TableHead>
                        <TableHead className="text-right">Picked</TableHead>
                        <TableHead className="text-right">Short</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selected.pick_list_items || []).map((item) => {
                        const allocated = toNumber(item.allocated_qty);
                        const picked = getLinePickedQty(item.id, toNumber(item.picked_qty));
                        const shortQty = Math.max(0, allocated - picked);

                        return (
                          <TableRow key={item.id}>
                            <TableCell className="text-sm font-medium">{toItemLabel(item)}</TableCell>
                            <TableCell className="text-sm">{toUomLabel(item)}</TableCell>
                            <TableCell className="text-right font-medium">{allocated.toFixed(2)}</TableCell>
                            <TableCell className="text-right">
                              <Input
                                className="ml-auto w-28 text-right"
                                type="number"
                                min="0"
                                max={allocated}
                                step="0.01"
                                value={picked}
                                disabled={["cancelled", "done"].includes(selected.status)}
                                onChange={(event) =>
                                  setItemQtyMap((prev) => ({
                                    ...prev,
                                    [item.id]: Math.max(
                                      0,
                                      Math.min(allocated, parseFloat(event.target.value) || 0)
                                    ),
                                  }))
                                }
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={shortQty > 0 ? "text-orange-600 font-medium" : ""}>
                                {shortQty.toFixed(2)}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Save Quantities Button */}
              {selected.status !== "cancelled" && selected.status !== "done" && (
                <div className="flex justify-end">
                  <Button onClick={submitItems} disabled={updateItemsMutation.isPending}>
                    {updateItemsMutation.isPending ? "Saving..." : "Save Picked Quantities"}
                  </Button>
                </div>
              )}

              {/* Status Actions */}
              {selected.status !== "done" && selected.status !== "cancelled" && (
                <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                  <div className="text-sm font-medium">Status Actions</div>
                  <div className="flex flex-wrap gap-2">
                    {selected.status === "pending" && (
                      <Button
                        onClick={() => transitionStatus("in_progress")}
                        disabled={updateStatusMutation.isPending}
                        className="gap-2"
                      >
                        <Play className="h-4 w-4" />
                        Start Picking
                      </Button>
                    )}
                    {selected.status === "in_progress" && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => transitionStatus("paused")}
                          disabled={updateStatusMutation.isPending}
                          className="gap-2"
                        >
                          <Pause className="h-4 w-4" />
                          Pause
                        </Button>
                        <Button
                          onClick={() => transitionStatus("done")}
                          disabled={updateStatusMutation.isPending}
                          className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Complete Picking
                        </Button>
                      </>
                    )}
                    {selected.status === "paused" && (
                      <Button
                        onClick={() => transitionStatus("in_progress")}
                        disabled={updateStatusMutation.isPending}
                        className="gap-2"
                      >
                        <Play className="h-4 w-4" />
                        Resume Picking
                      </Button>
                    )}
                  </div>

                  {/* Cancel Section */}
                  <div className="space-y-2 border-t pt-3">
                    <div className="text-xs text-muted-foreground">Cancel this pick list</div>
                    <Textarea
                      placeholder="Cancel reason (optional)"
                      value={cancelReason}
                      onChange={(event) => setCancelReason(event.target.value)}
                      rows={2}
                    />
                    <Button
                      variant="destructive"
                      onClick={() => transitionStatus("cancelled")}
                      disabled={updateStatusMutation.isPending}
                      className="gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      Cancel Pick List
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailId("")}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
