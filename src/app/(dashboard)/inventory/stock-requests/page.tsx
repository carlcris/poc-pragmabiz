"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Plus,
  Search,
  Filter,
  ThumbsDown,
  Pencil,
  Trash2,
  Send,
  CheckCircle,
  ThumbsUp,
  XCircle,
  FileText,
  Clock,
  Package,
  Truck,
} from "lucide-react";
import {
  useStockRequests,
  useCreateStockRequest,
  useUpdateStockRequest,
  useDeleteStockRequest,
  useSubmitStockRequest,
  useApproveStockRequest,
  useRejectStockRequest,
  useDispatchStockRequest,
  useCompleteStockRequest,
  useCancelStockRequest,
} from "@/hooks/useStockRequests";
import { useWarehouses } from "@/hooks/useWarehouses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { EmptyStatePanel } from "@/components/shared/EmptyStatePanel";
import { Textarea } from "@/components/ui/textarea";
import type { StockRequest, StockRequestStatus, StockRequestPriority } from "@/types/stock-request";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";

const StockRequestFormDialog = dynamic(
  () =>
    import("@/components/stock-requests/StockRequestFormDialog").then(
      (mod) => mod.StockRequestFormDialog
    ),
  { ssr: false }
);
type StockRequestFormValues = import("@/components/stock-requests/StockRequestFormDialog").StockRequestFormValues;
type StockRequestLineItemPayload =
  import("@/components/stock-requests/StockRequestLineItemDialog").StockRequestLineItemPayload;
const ReceiveStockRequestDialog = dynamic(
  () =>
    import("@/components/stock-requests/ReceiveStockRequestDialog").then(
      (mod) => mod.ReceiveStockRequestDialog
    ),
  { ssr: false }
);
const StockRequestViewDialog = dynamic(
  () =>
    import("@/components/stock-requests/StockRequestViewDialog").then(
      (mod) => mod.StockRequestViewDialog
    ),
  { ssr: false }
);

export default function StockRequestsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<StockRequest | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<StockRequest | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<string>("");
  const [requestToAction, setRequestToAction] = useState<StockRequest | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [requestToReceive, setRequestToReceive] = useState<StockRequest | null>(null);
  const [viewRequest, setViewRequest] = useState<StockRequest | null>(null);

  const { data, isLoading, error } = useStockRequests({
    search: search || undefined,
    status: statusFilter === "all" ? undefined : (statusFilter as StockRequestStatus),
    priority: priorityFilter === "all" ? undefined : (priorityFilter as StockRequestPriority),
    page,
    limit: pageSize,
  });

  const currentBusinessUnit = useBusinessUnitStore((state) => state.currentBusinessUnit);
  const { data: warehousesData } = useWarehouses({ page: 1, limit: 50 });
  const warehouses = useMemo(() => warehousesData?.data || [], [warehousesData?.data]);
  const defaultRequestingWarehouseId = useMemo(() => {
    if (!currentBusinessUnit?.id) return "";
    return warehouses.find((warehouse) => warehouse.businessUnitId === currentBusinessUnit.id)?.id || "";
  }, [currentBusinessUnit?.id, warehouses]);

  const createMutation = useCreateStockRequest();
  const updateMutation = useUpdateStockRequest();
  const deleteMutation = useDeleteStockRequest();
  const submitMutation = useSubmitStockRequest();
  const approveMutation = useApproveStockRequest();
  const rejectMutation = useRejectStockRequest();
  const dispatchMutation = useDispatchStockRequest();
  const completeMutation = useCompleteStockRequest();
  const cancelMutation = useCancelStockRequest();

  const requests = data?.data || [];
  const pagination = data?.pagination;

  const getStatusBadge = (status: StockRequestStatus) => {
    const baseClass = "text-xs font-medium";

    switch (status) {
      case "draft":
        return <span className={`${baseClass} text-muted-foreground`}>Draft</span>;
      case "submitted":
        return <span className={`${baseClass} text-amber-600`}>Submitted</span>;
      case "approved":
        return <span className={`${baseClass} text-blue-600`}>Approved</span>;
      case "picked":
        return <span className={`${baseClass} text-indigo-600`}>Picked</span>;
      case "picking":
        return <span className={`${baseClass} text-indigo-600`}>Picking</span>;
      case "received":
        return <span className={`${baseClass} text-emerald-600`}>Received</span>;
      case "completed":
        return <span className={`${baseClass} text-emerald-600`}>Completed</span>;
      case "cancelled":
        return <span className={`${baseClass} text-red-600`}>Cancelled</span>;
      case "allocating":
        return <span className={`${baseClass} text-amber-600`}>Allocating</span>;
      case "partially_allocated":
        return <span className={`${baseClass} text-orange-600`}>Partially Allocated</span>;
      case "allocated":
        return <span className={`${baseClass} text-orange-700`}>Allocated</span>;
      case "dispatched":
        return <span className={`${baseClass} text-indigo-600`}>Dispatched</span>;
      case "partially_fulfilled":
        return <span className={`${baseClass} text-emerald-600`}>Partially Fulfilled</span>;
      case "fulfilled":
        return <span className={`${baseClass} text-emerald-700`}>Fulfilled</span>;
      default:
        return (
          <span className={`${baseClass} text-muted-foreground`}>
            {String(status).replace(/_/g, " ")}
          </span>
        );
    }
  };

  const getStatusIcon = (status: StockRequestStatus) => {
    switch (status) {
      case "draft":
        return <FileText className="h-4 w-4 text-gray-600" />;
      case "submitted":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "approved":
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case "allocating":
      case "partially_allocated":
      case "allocated":
        return <Package className="h-4 w-4 text-orange-600" />;
      case "picking":
      case "picked":
      case "dispatched":
        return <Truck className="h-4 w-4 text-indigo-600" />;
      case "received":
      case "partially_fulfilled":
      case "fulfilled":
        return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "cancelled":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getPriorityBadge = (priority: StockRequestPriority) => {
    const baseClass = "text-xs font-medium";

    switch (priority) {
      case "low":
        return <span className={`${baseClass} text-slate-500`}>Low</span>;
      case "normal":
        return <span className={`${baseClass} text-slate-600`}>Normal</span>;
      case "high":
        return <span className={`${baseClass} text-orange-600`}>High</span>;
      case "urgent":
        return <span className={`${baseClass} text-red-600`}>Urgent</span>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const canReceiveRequest = (request: StockRequest) => {
    if (!currentBusinessUnit?.id) return false;
    if (!request.fulfilling_warehouse?.id) return false;
    return request.requesting_warehouse?.businessUnitId === currentBusinessUnit.id;
  };

  const canFulfillRequest = (request: StockRequest) => {
    if (!currentBusinessUnit?.id) return false;
    return request.fulfilling_warehouse?.businessUnitId === currentBusinessUnit.id;
  };

  const hasRowActions = (request: StockRequest) => {
    if (request.status === "draft") return true;
    if (request.status === "submitted" && canFulfillRequest(request)) return true;
    if (request.status === "approved" && canFulfillRequest(request)) return true;
    if (["picking", "picked"].includes(request.status) && canFulfillRequest(request)) return true;
    if (
      request.status === "dispatched" &&
      canReceiveRequest(request)
    ) {
      return true;
    }
    if (["draft", "submitted", "approved"].includes(request.status)) return true;
    return false;
  };

  const hasAnyActions = requests.some((request) => hasRowActions(request));

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const handleCreateRequest = () => {
    setSelectedRequest(null);
    setDialogOpen(true);
  };

  const handleEditRequest = (request: StockRequest) => {
    setSelectedRequest(request);
    setDialogOpen(true);
  };

  const handleDeleteRequest = (request: StockRequest) => {
    setRequestToDelete(request);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!requestToDelete) return;

    await deleteMutation.mutateAsync(requestToDelete.id);
    setDeleteDialogOpen(false);
    setRequestToDelete(null);
  };

  const handleAction = (type: string, request: StockRequest) => {
    if (type === "receive") {
      setRequestToReceive(request);
      setReceiveDialogOpen(true);
      return;
    }

    setActionType(type);
    setRequestToAction(request);
    setActionReason("");
    setActionDialogOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!requestToAction) return;

    try {
      switch (actionType) {
        case "submit":
          await submitMutation.mutateAsync(requestToAction.id);
          break;
        case "approve":
          await approveMutation.mutateAsync(requestToAction.id);
          break;
        case "reject":
          await rejectMutation.mutateAsync({ id: requestToAction.id, reason: actionReason });
          break;
        case "dispatch":
          await dispatchMutation.mutateAsync({ id: requestToAction.id });
          break;
        case "complete":
          await completeMutation.mutateAsync(requestToAction.id);
          break;
        case "cancel":
          await cancelMutation.mutateAsync({ id: requestToAction.id, reason: actionReason });
          break;
      }
      setActionDialogOpen(false);
      setRequestToAction(null);
      setActionReason("");
    } catch {
      // Error is handled by mutation onError
    }
  };

  const handleSaveRequest = async (payload: {
    values: StockRequestFormValues;
    lineItems: StockRequestLineItemPayload[];
    selectedRequest: StockRequest | null;
  }) => {
    try {
      const submitData = {
        ...payload.values,
        items: payload.lineItems.map((item) => ({
          item_id: item.itemId,
          requested_qty: item.requestedQty,
          uom_id: item.uomId,
          notes: item.notes,
        })),
      };

      if (payload.selectedRequest) {
        await updateMutation.mutateAsync({
          id: payload.selectedRequest.id,
          data: submitData,
        });
      } else {
        await createMutation.mutateAsync(submitData);
      }
    } catch {
      // Error is handled by mutation onError
    }
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handlePriorityFilterChange = (value: string) => {
    setPriorityFilter(value);
    setPage(1);
  };

  const getActionDialogContent = () => {
    const actionLabels: Record<
      string,
      {
        title: string;
        description: string;
        confirmText: string;
        confirmClass: string;
        needsReason: boolean;
      }
    > = {
      submit: {
        title: "Submit Stock Request",
        description: "Submit this stock request for approval?",
        confirmText: "Submit",
        confirmClass: "bg-blue-600 hover:bg-blue-700",
        needsReason: false,
      },
      approve: {
        title: "Approve Stock Request",
        description: "Approve this stock request?",
        confirmText: "Approve",
        confirmClass: "bg-green-600 hover:bg-green-700",
        needsReason: false,
      },
      reject: {
        title: "Reject Stock Request",
        description: "Reject this stock request? Please provide a reason.",
        confirmText: "Reject",
        confirmClass: "bg-red-600 hover:bg-red-700",
        needsReason: true,
      },
      dispatch: {
        title: "Dispatch Stock Request",
        description: "Dispatch picked quantities and post outbound inventory movement?",
        confirmText: "Dispatch",
        confirmClass: "bg-indigo-600 hover:bg-indigo-700",
        needsReason: false,
      },
      complete: {
        title: "Complete Stock Request",
        description:
          "Complete this stock request? This will create stock transactions and update inventory levels.",
        confirmText: "Complete",
        confirmClass: "bg-green-600 hover:bg-green-700",
        needsReason: false,
      },
      cancel: {
        title: "Cancel Stock Request",
        description: "Cancel this stock request? Please provide a reason.",
        confirmText: "Cancel",
        confirmClass: "bg-red-600 hover:bg-red-700",
        needsReason: true,
      },
    };

    const config = actionLabels[actionType] || actionLabels.submit;

    return { ...config };
  };

  const actionConfig = getActionDialogContent();

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight whitespace-nowrap">Stock Requests</h1>
            <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">Manage stock requests and fulfillment workflow</p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button asChild variant="outline" className="w-full sm:w-auto flex-shrink-0">
              <Link href="/inventory/delivery-notes">Delivery Notes</Link>
            </Button>
            <Button onClick={handleCreateRequest} className="w-full sm:w-auto flex-shrink-0">
              <Plus className="mr-2 h-4 w-4" />
              Create Request
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative w-full sm:flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search stock requests..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="picking">Picking</SelectItem>
                <SelectItem value="picked">Picked</SelectItem>
                <SelectItem value="dispatched">Dispatched</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="allocating">Allocating</SelectItem>
                <SelectItem value="partially_allocated">Partially Allocated</SelectItem>
                <SelectItem value="allocated">Allocated</SelectItem>
                <SelectItem value="partially_fulfilled">Partially Fulfilled</SelectItem>
                <SelectItem value="fulfilled">Fulfilled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={handlePriorityFilterChange}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>Request #</TableHead>
                    <TableHead>Request Date</TableHead>
                    <TableHead>Required Date</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead>Requested To</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    {!hasAnyActions && <TableHead>Received</TableHead>}
                    <TableHead>Requested By</TableHead>
                    {hasAnyActions && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(8)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      {!hasAnyActions && (
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                      )}
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      {hasAnyActions && (
                        <TableCell className="text-right">
                          <div className="flex justify-end">
                            <Skeleton className="h-8 w-8" />
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : error ? (
            <div className="py-8 text-center text-destructive">
              Error loading stock requests. Please try again.
            </div>
          ) : requests.length === 0 ? (
            <EmptyStatePanel
              icon={Package}
              title="No stock requests found"
              description="Create your first request to get started."
            />
          ) : (
            <>
              <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead>Request #</TableHead>
                      <TableHead>Request Date</TableHead>
                      <TableHead>Required Date</TableHead>
                      <TableHead>Requested By</TableHead>
                      <TableHead>Requested To</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      {!hasAnyActions && <TableHead>Received</TableHead>}
                      <TableHead>Requested By</TableHead>
                      {hasAnyActions && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request) => (
                      <TableRow
                        key={request.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setViewRequest(request)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(request.status)}
                            {request.request_code}
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(request.request_date)}</TableCell>
                        <TableCell>{formatDate(request.required_date)}</TableCell>
                        <TableCell>{request.requesting_warehouse?.warehouse_code || "--"}</TableCell>
                        <TableCell>{request.fulfilling_warehouse?.warehouse_code || "--"}</TableCell>
                        <TableCell>{getPriorityBadge(request.priority)}</TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        {!hasAnyActions && (
                          <TableCell>
                            {request.received_at ? formatDate(request.received_at) : "--"}
                          </TableCell>
                        )}
                        <TableCell>
                          {request.requested_by_user?.full_name ||
                            request.requested_by_user?.email ||
                            "--"}
                        </TableCell>
                        {hasAnyActions && (
                          <TableCell
                            className="text-right"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <div className="flex justify-end gap-2">
                              {hasRowActions(request) ? (
                                <>
                                  {request.status === "draft" && (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditRequest(request)}
                                        title="Edit"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteRequest(request)}
                                        title="Delete"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleAction("submit", request)}
                                        title="Submit"
                                      >
                                        <Send className="h-4 w-4 text-blue-600" />
                                      </Button>
                                    </>
                                  )}

                                  {request.status === "submitted" && canFulfillRequest(request) && (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleAction("approve", request)}
                                        title="Approve"
                                      >
                                        <ThumbsUp className="h-4 w-4 text-green-600" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleAction("reject", request)}
                                        title="Reject"
                                      >
                                        <ThumbsDown className="h-4 w-4 text-red-600" />
                                      </Button>
                                    </>
                                  )}

                                  {["picking", "picked"].includes(request.status) &&
                                    canFulfillRequest(request) && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleAction("dispatch", request)}
                                        title="Dispatch"
                                      >
                                        <Truck className="h-4 w-4 text-indigo-600" />
                                      </Button>
                                    )}

                                  {request.status === "dispatched" && canReceiveRequest(request) && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleAction("receive", request)}
                                      title="Receive"
                                    >
                                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                                    </Button>
                                  )}

                                  {["draft", "submitted", "approved"].includes(request.status) && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleAction("cancel", request)}
                                      title="Cancel"
                                    >
                                      <XCircle className="h-4 w-4 text-red-600" />
                                    </Button>
                                  )}
                                </>
                              ) : (
                                <span className="text-xs text-muted-foreground">--</span>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {pagination && pagination.total > 0 && (
                <div className="mt-4">
                  <DataTablePagination
                    currentPage={page}
                    totalPages={pagination.totalPages}
                    pageSize={pageSize}
                    totalItems={pagination.total}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {dialogOpen && (
          <StockRequestFormDialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) setSelectedRequest(null);
            }}
            selectedRequest={selectedRequest}
            warehouses={warehouses.map((warehouse) => ({
              id: warehouse.id,
              code: warehouse.code ?? "",
              name: warehouse.name ?? "",
            }))}
            defaultRequestingWarehouseId={defaultRequestingWarehouseId}
            onSave={handleSaveRequest}
            isSaving={createMutation.isPending || updateMutation.isPending}
          />
        )}

        {receiveDialogOpen && (
          <ReceiveStockRequestDialog
            open={receiveDialogOpen}
            onOpenChange={(open) => {
              setReceiveDialogOpen(open);
              if (!open) {
                setRequestToReceive(null);
              }
            }}
            stockRequest={requestToReceive}
          />
        )}

        {viewRequest && (
          <StockRequestViewDialog
            open={!!viewRequest}
            onOpenChange={(open) => {
              if (!open) {
                setViewRequest(null);
              }
            }}
            request={viewRequest}
          />
        )}

        {/* Delete Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Stock Request</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete request{" "}
                <strong>{requestToDelete?.request_code}</strong>? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="bg-destructive hover:bg-destructive/90"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Action Dialog */}
        <AlertDialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{actionConfig.title}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>{actionConfig.description}</p>
                  {requestToAction && (
                    <p>
                      <strong>Request:</strong> {requestToAction.request_code}
                    </p>
                  )}
                  {actionConfig.needsReason && (
                    <Textarea
                      placeholder="Enter reason..."
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                      className="mt-2"
                    />
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmAction}
                className={actionConfig.confirmClass}
                disabled={
                  submitMutation.isPending ||
                  approveMutation.isPending ||
                  rejectMutation.isPending ||
                  dispatchMutation.isPending ||
                  completeMutation.isPending ||
                  cancelMutation.isPending ||
                  (actionConfig.needsReason && !actionReason.trim())
                }
              >
                {submitMutation.isPending ||
                approveMutation.isPending ||
                rejectMutation.isPending ||
                dispatchMutation.isPending ||
                completeMutation.isPending ||
                cancelMutation.isPending
                  ? "Processing..."
                  : actionConfig.confirmText}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

    </>
  );
}
