"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Filter,
  Pencil,
  Trash2,
  Send,
  CheckCircle,
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
  useMarkReadyForPick,
  useMarkDelivered,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { StockRequest, StockRequestStatus, StockRequestPriority } from "@/types/stock-request";
import {
  StockRequestLineItemDialog,
  type StockRequestLineItemPayload,
} from "@/components/stock-requests/StockRequestLineItemDialog";
import { ReceiveStockRequestDialog } from "@/components/stock-requests/ReceiveStockRequestDialog";
import { StockRequestViewDialog } from "@/components/stock-requests/StockRequestViewDialog";
import { MoreVertical } from "lucide-react";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";

const requestFormSchema = z
  .object({
    request_date: z.string().min(1, "Request date is required"),
    required_date: z.string().min(1, "Required date is required"),
    from_location_id: z.string().min(1, "From location is required"),
    to_location_id: z.string().optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]),
    purpose: z.string().optional(),
    notes: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.to_location_id && values.to_location_id === values.from_location_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "To location must be different from from location",
        path: ["to_location_id"],
      });
    }
  });

type RequestFormValues = z.infer<typeof requestFormSchema>;

export default function StockRequestsPage() {
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

  // Line items state
  const [lineItems, setLineItems] = useState<StockRequestLineItemPayload[]>([]);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    index: number;
    item: StockRequestLineItemPayload;
  } | null>(null);

  const { data, isLoading, error } = useStockRequests({
    search,
    page: 1,
    limit: 1000,
  });

  const { data: warehousesData } = useWarehouses({ page: 1, limit: 1000 });
  const warehouses = warehousesData?.data || [];

  const createMutation = useCreateStockRequest();
  const updateMutation = useUpdateStockRequest();
  const deleteMutation = useDeleteStockRequest();
  const submitMutation = useSubmitStockRequest();
  const approveMutation = useApproveStockRequest();
  const rejectMutation = useRejectStockRequest();
  const readyForPickMutation = useMarkReadyForPick();
  const deliveredMutation = useMarkDelivered();
  const completeMutation = useCompleteStockRequest();
  const cancelMutation = useCancelStockRequest();
  const currentBusinessUnit = useBusinessUnitStore((state) => state.currentBusinessUnit);

  // Client-side filtering
  let filteredRequests = data?.data || [];

  if (statusFilter !== "all") {
    filteredRequests = filteredRequests.filter((r) => r.status === statusFilter);
  }

  if (priorityFilter !== "all") {
    filteredRequests = filteredRequests.filter((r) => r.priority === priorityFilter);
  }

  // Pagination
  const total = filteredRequests.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const requests = filteredRequests.slice(start, end);

  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestFormSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      request_date: new Date().toISOString().split("T")[0],
      required_date: new Date().toISOString().split("T")[0],
      from_location_id: "",
      to_location_id: "",
      priority: "normal",
      purpose: "",
      notes: "",
    },
  });

  // Reset form and line items when dialog opens/closes
  useEffect(() => {
    if (dialogOpen && selectedRequest) {
      form.reset({
        request_date: selectedRequest.request_date,
        required_date: selectedRequest.required_date,
        from_location_id: selectedRequest.from_location_id,
        to_location_id: selectedRequest.to_location_id || "",
        priority: selectedRequest.priority,
        purpose: selectedRequest.purpose || "",
        notes: selectedRequest.notes || "",
      });
      // Convert request items to form format
      const formLineItems: StockRequestLineItemPayload[] =
        selectedRequest.stock_request_items?.map((item) => ({
          itemId: item.item_id,
          itemCode: item.items?.item_code || "",
          itemName: item.items?.item_name || "",
          uomId: item.uom_id,
          uomLabel: item.units_of_measure?.code || item.units_of_measure?.symbol || "",
          requestedQty: item.requested_qty,
          notes: item.notes || "",
        })) || [];
      setLineItems(formLineItems);
    } else if (dialogOpen) {
      form.reset({
        request_date: new Date().toISOString().split("T")[0],
        required_date: new Date().toISOString().split("T")[0],
        from_location_id: "",
        to_location_id: "",
        priority: "normal",
        purpose: "",
        notes: "",
      });
      setLineItems([]);
    }
  }, [dialogOpen, selectedRequest, form]);

  const getStatusBadge = (status: StockRequestStatus) => {
    const baseClass = "text-xs font-medium";

    switch (status) {
      case "draft":
        return <span className={`${baseClass} text-muted-foreground`}>Draft</span>;
      case "submitted":
        return <span className={`${baseClass} text-amber-600`}>Submitted</span>;
      case "approved":
        return <span className={`${baseClass} text-blue-600`}>Approved</span>;
      case "ready_for_pick":
        return <span className={`${baseClass} text-purple-600`}>Ready for Pick</span>;
      case "picked":
      case "delivered":
        return <span className={`${baseClass} text-indigo-600`}>Delivered</span>;
      case "received":
        return <span className={`${baseClass} text-emerald-600`}>Received</span>;
      case "completed":
        return <span className={`${baseClass} text-emerald-600`}>Completed</span>;
      case "cancelled":
        return <span className={`${baseClass} text-red-600`}>Cancelled</span>;
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
      case "ready_for_pick":
        return <Package className="h-4 w-4 text-purple-600" />;
      case "picked":
      case "delivered":
        return <Truck className="h-4 w-4 text-indigo-600" />;
      case "received":
        return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "cancelled":
        return <XCircle className="h-4 w-4 text-red-600" />;
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
    if (!request.to_location?.id) return false;
    return request.from_location?.businessUnitId === currentBusinessUnit.id;
  };

  const canFulfillRequest = (request: StockRequest) => {
    if (!currentBusinessUnit?.id) return false;
    return request.to_location?.businessUnitId === currentBusinessUnit.id;
  };

  const hasRowActions = (request: StockRequest) => {
    if (request.status === "draft") return true;
    if (request.status === "submitted" && canFulfillRequest(request)) return true;
    if (request.status === "approved" && canFulfillRequest(request)) return true;
    if (request.status === "ready_for_pick" && canFulfillRequest(request)) return true;
    if (
      (request.status === "delivered" || request.status === "picked") &&
      canReceiveRequest(request)
    ) {
      return true;
    }
    if (["draft", "submitted", "approved"].includes(request.status)) return true;
    return false;
  };

  const pagination = {
    total,
    page,
    limit: pageSize,
    totalPages,
  };

  const hasAnyActions = requests.some((request) => hasRowActions(request));

  const handleCreateRequest = () => {
    setSelectedRequest(null);
    setLineItems([]);
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

  const handleAddItem = () => {
    setEditingItem(null);
    setItemDialogOpen(true);
  };

  const handleEditItem = (index: number) => {
    setEditingItem({ index, item: lineItems[index] });
    setItemDialogOpen(true);
  };

  const handleDeleteItem = (index: number) => {
    setLineItems((items) => items.filter((_, i) => i !== index));
  };

  const handleSaveItem = (item: StockRequestLineItemPayload) => {
    if (editingItem !== null) {
      // Update existing item
      setLineItems((items) => items.map((it, i) => (i === editingItem.index ? item : it)));
    } else {
      // Add new item
      setLineItems((items) => [...items, item]);
    }
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
        case "ready_for_pick":
          await readyForPickMutation.mutateAsync(requestToAction.id);
          break;
        case "deliver":
          await deliveredMutation.mutateAsync(requestToAction.id);
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

  const onSubmit = async (values: RequestFormValues) => {
    if (lineItems.length === 0) {
      alert("Please add at least one line item");
      return;
    }

    try {
      const submitData = {
        ...values,
        items: lineItems.map((item) => ({
          item_id: item.itemId,
          requested_qty: item.requestedQty,
          uom_id: item.uomId,
          notes: item.notes,
        })),
      };

      if (selectedRequest) {
        await updateMutation.mutateAsync({
          id: selectedRequest.id,
          data: submitData,
        });
      } else {
        await createMutation.mutateAsync(submitData);
      }
      setDialogOpen(false);
      setLineItems([]);
      form.reset();
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
      ready_for_pick: {
        title: "Mark Ready for Picking",
        description: "Mark this stock request as ready for picking?",
        confirmText: "Mark Ready",
        confirmClass: "bg-purple-600 hover:bg-purple-700",
        needsReason: false,
      },
      deliver: {
        title: "Mark as Delivered",
        description: "Mark this stock request as delivered?",
        confirmText: "Mark Delivered",
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Stock Requests</h1>
            <p className="text-muted-foreground">Manage stock requests and fulfillment workflow</p>
          </div>
          <Button onClick={handleCreateRequest}>
            <Plus className="mr-2 h-4 w-4" />
            Create Request
          </Button>
        </div>

        <div className="space-y-4">
          <div className="mb-4 flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search stock requests..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="ready_for_pick">Ready for Pick</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={handlePriorityFilterChange}>
              <SelectTrigger className="w-[180px]">
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
                    <TableHead>From Location</TableHead>
                    <TableHead>To Location</TableHead>
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
            <div className="py-8 text-center text-muted-foreground">
              No stock requests found. Create your first request to get started.
            </div>
          ) : (
            <>
              <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead>Request #</TableHead>
                      <TableHead>Request Date</TableHead>
                      <TableHead>Required Date</TableHead>
                      <TableHead>From Location</TableHead>
                      <TableHead>To Location</TableHead>
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
                        <TableCell>{request.from_location?.warehouse_code || "--"}</TableCell>
                        <TableCell>{request.to_location?.warehouse_code || "--"}</TableCell>
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
                            <div className="flex justify-end">
                              {hasRowActions(request) ? (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreVertical className="h-4 w-4" />
                                      <span className="sr-only">Open actions</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {request.status === "draft" && (
                                      <>
                                        <DropdownMenuItem
                                          onClick={() => handleEditRequest(request)}
                                        >
                                          <Pencil className="mr-2 h-4 w-4" />
                                          Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => handleDeleteRequest(request)}
                                        >
                                          <Trash2 className="mr-2 h-4 w-4" />
                                          Delete
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={() => handleAction("submit", request)}
                                        >
                                          <Send className="mr-2 h-4 w-4" />
                                          Submit
                                        </DropdownMenuItem>
                                      </>
                                    )}

                                    {request.status === "submitted" &&
                                      canFulfillRequest(request) && (
                                        <>
                                          <DropdownMenuItem
                                            onClick={() => handleAction("approve", request)}
                                          >
                                            <CheckCircle className="mr-2 h-4 w-4" />
                                            Approve
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => handleAction("reject", request)}
                                          >
                                            <XCircle className="mr-2 h-4 w-4" />
                                            Reject
                                          </DropdownMenuItem>
                                        </>
                                      )}

                                    {request.status === "approved" &&
                                      canFulfillRequest(request) && (
                                        <DropdownMenuItem
                                          onClick={() => handleAction("ready_for_pick", request)}
                                        >
                                          <Package className="mr-2 h-4 w-4" />
                                          Ready to Pick
                                        </DropdownMenuItem>
                                      )}

                                    {request.status === "ready_for_pick" &&
                                      canFulfillRequest(request) && (
                                        <DropdownMenuItem
                                          onClick={() => handleAction("deliver", request)}
                                        >
                                          <Truck className="mr-2 h-4 w-4" />
                                          Mark Delivered
                                        </DropdownMenuItem>
                                      )}

                                    {(request.status === "delivered" ||
                                      request.status === "picked") &&
                                      canReceiveRequest(request) && (
                                        <DropdownMenuItem
                                          onClick={() => handleAction("receive", request)}
                                        >
                                          <CheckCircle className="mr-2 h-4 w-4" />
                                          Receive
                                        </DropdownMenuItem>
                                      )}

                                    {["draft", "submitted", "approved"].includes(
                                      request.status
                                    ) && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={() => handleAction("cancel", request)}
                                          className="text-destructive focus:text-destructive"
                                        >
                                          <XCircle className="mr-2 h-4 w-4" />
                                          Cancel
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
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

        {/* Form Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col overflow-hidden">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>
                {selectedRequest ? "Edit Stock Request" : "Create Stock Request"}
              </DialogTitle>
              <DialogDescription>
                {selectedRequest
                  ? `Edit request ${selectedRequest.request_code}`
                  : "Create a new stock request"}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex flex-1 flex-col overflow-hidden"
              >
                <div className="flex-1 overflow-y-auto px-1">
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <FormField
                        control={form.control}
                        name="request_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Request Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} className="h-9" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="required_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Required Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} className="h-9" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Priority</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="col-span-3 grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="from_location_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">From Location</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Select from location" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {warehouses.map((warehouse) => (
                                    <SelectItem key={warehouse.id} value={warehouse.id}>
                                      {warehouse.code} - {warehouse.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="to_location_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">To Location</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Select to location (optional)" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {warehouses.map((warehouse) => (
                                    <SelectItem key={warehouse.id} value={warehouse.id}>
                                      {warehouse.code} - {warehouse.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="purpose"
                        render={({ field }) => (
                          <FormItem className="col-span-3">
                            <FormLabel className="text-xs">Purpose</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter purpose of request (optional)"
                                {...field}
                                className="h-9"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem className="col-span-3">
                            <FormLabel className="text-xs">Notes</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Additional notes (optional)"
                                className="h-16 resize-none"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Line Items Section */}
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium">Line Items</h3>
                          <p className="text-xs text-muted-foreground">Add items to request</p>
                        </div>
                        <Button type="button" onClick={handleAddItem} size="sm" className="h-8">
                          <Plus className="mr-1 h-3 w-3" />
                          Add Item
                        </Button>
                      </div>

                      {lineItems.length === 0 ? (
                        <div className="rounded-lg border-2 border-dashed py-8 text-center text-muted-foreground">
                          <p className="text-sm">No items added yet.</p>
                          <p className="text-xs">Click &quot;Add Item&quot; to get started.</p>
                        </div>
                      ) : (
                        <div className="max-h-[300px] overflow-y-auto rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="py-2 text-xs">Item</TableHead>
                                <TableHead className="py-2 text-right text-xs">Qty</TableHead>
                                <TableHead className="py-2 text-xs">Unit</TableHead>
                                <TableHead className="py-2 text-xs">Notes</TableHead>
                                <TableHead className="w-[80px] py-2 text-xs">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {lineItems.map((item, index) => (
                                <TableRow key={index}>
                                  <TableCell className="py-2">
                                    <div>
                                      <div className="text-sm font-medium">{item.itemName}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {item.itemCode}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-2 text-right text-sm">
                                    {item.requestedQty.toFixed(2)}
                                  </TableCell>
                                  <TableCell className="py-2 text-sm">
                                    {item.uomLabel || "--"}
                                  </TableCell>
                                  <TableCell className="py-2">
                                    <div className="max-w-[150px] truncate text-sm">
                                      {item.notes || "--"}
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-2">
                                    <div className="flex items-center gap-1">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditItem(index)}
                                        className="h-7 w-7 p-0"
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteItem(index)}
                                        className="h-7 w-7 p-0"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <DialogFooter className="mt-4 flex-shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    className="h-9"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      createMutation.isPending ||
                      updateMutation.isPending ||
                      !form.formState.isValid ||
                      lineItems.length === 0
                    }
                    className="h-9"
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? "Saving..."
                      : selectedRequest
                        ? "Update Request"
                        : "Create Request"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

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

        <StockRequestViewDialog
          open={!!viewRequest}
          onOpenChange={(open) => {
            if (!open) {
              setViewRequest(null);
            }
          }}
          request={viewRequest}
        />

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
                  readyForPickMutation.isPending ||
                  deliveredMutation.isPending ||
                  completeMutation.isPending ||
                  cancelMutation.isPending ||
                  (actionConfig.needsReason && !actionReason.trim())
                }
              >
                {submitMutation.isPending ||
                approveMutation.isPending ||
                rejectMutation.isPending ||
                readyForPickMutation.isPending ||
                deliveredMutation.isPending ||
                completeMutation.isPending ||
                cancelMutation.isPending
                  ? "Processing..."
                  : actionConfig.confirmText}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Line Item Dialog */}
      <StockRequestLineItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        onSave={handleSaveItem}
        item={editingItem?.item || null}
        mode={editingItem ? "edit" : "add"}
      />
    </>
  );
}
