"use client";

import { useState } from "react";
import { Plus, Search, Eye, Filter, CheckCircle, XCircle, Pencil, Trash2, Send, Package } from "lucide-react";
import { toast } from "sonner";
import {
  usePurchaseOrders,
  useDeletePurchaseOrder,
  useSubmitPurchaseOrder,
  useApprovePurchaseOrder,
  useCancelPurchaseOrder,
} from "@/hooks/usePurchaseOrders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { PurchaseOrderFormDialog } from "@/components/purchase-orders/PurchaseOrderFormDialog";
import { PurchaseOrderViewDialog } from "@/components/purchase-orders/PurchaseOrderViewDialog";
import { ReceiveGoodsDialog } from "@/components/purchase-receipts/ReceiveGoodsDialog";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { useCurrency } from "@/hooks/useCurrency";
import type { PurchaseOrder } from "@/types/purchase-order";
import { format } from "date-fns";

export default function PurchaseOrdersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [receiveGoodsDialogOpen, setReceiveGoodsDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);

  // Action dialogs
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderForAction, setOrderForAction] = useState<PurchaseOrder | null>(null);

  const { formatCurrency } = useCurrency();
  const deleteMutation = useDeletePurchaseOrder();
  const submitMutation = useSubmitPurchaseOrder();
  const approveMutation = useApprovePurchaseOrder();
  const cancelMutation = useCancelPurchaseOrder();

  const { data, isLoading, error } = usePurchaseOrders({
    search,
    status: statusFilter !== "all" ? statusFilter : undefined,
    page: 1,
    limit: 1000,
  });

  // Apply client-side filtering
  const filteredOrders = data?.data || [];

  // Calculate pagination
  const total = filteredOrders.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const orders = filteredOrders.slice(start, end);

  const pagination = {
    total,
    page,
    limit: pageSize,
    totalPages,
  };

  const getErrorMessage = (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "submitted":
        return <Badge variant="default" className="bg-blue-600">Submitted</Badge>;
      case "approved":
        return <Badge variant="default" className="bg-green-600">Approved</Badge>;
      case "in_transit":
        return <Badge variant="default" className="bg-purple-600">In Transit</Badge>;
      case "partially_received":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Partially Received</Badge>;
      case "received":
        return <Badge variant="default" className="bg-green-700">Received</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleCreateOrder = () => {
    setSelectedOrder(null);
    setFormDialogOpen(true);
  };

  const handleEditOrder = (order: PurchaseOrder) => {
    setSelectedOrder(order);
    setFormDialogOpen(true);
  };

  const handleViewOrder = (order: PurchaseOrder) => {
    setSelectedOrder(order);
    setViewDialogOpen(true);
  };

  const handleSubmitOrder = (order: PurchaseOrder) => {
    setOrderForAction(order);
    setSubmitDialogOpen(true);
  };

  const handleApproveOrder = (order: PurchaseOrder) => {
    setOrderForAction(order);
    setApproveDialogOpen(true);
  };

  const handleCancelOrder = (order: PurchaseOrder) => {
    setOrderForAction(order);
    setCancelDialogOpen(true);
  };

  const handleDeleteOrder = (order: PurchaseOrder) => {
    setOrderForAction(order);
    setDeleteDialogOpen(true);
  };

  const handleReceiveGoods = (order: PurchaseOrder) => {
    setSelectedOrder(order);
    setReceiveGoodsDialogOpen(true);
  };

  const confirmSubmit = async () => {
    if (!orderForAction) return;
    try {
      await submitMutation.mutateAsync(orderForAction.id);
      toast.success("Purchase order submitted successfully");
      setSubmitDialogOpen(false);
      setOrderForAction(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to submit purchase order"));
    }
  };

  const confirmApprove = async () => {
    if (!orderForAction) return;
    try {
      await approveMutation.mutateAsync(orderForAction.id);
      toast.success("Purchase order approved successfully");
      setApproveDialogOpen(false);
      setOrderForAction(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to approve purchase order"));
    }
  };

  const confirmCancel = async () => {
    if (!orderForAction) return;
    try {
      await cancelMutation.mutateAsync(orderForAction.id);
      toast.success("Purchase order cancelled successfully");
      setCancelDialogOpen(false);
      setOrderForAction(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to cancel purchase order"));
    }
  };

  const confirmDelete = async () => {
    if (!orderForAction) return;
    try {
      await deleteMutation.mutateAsync(orderForAction.id);
      toast.success("Purchase order deleted successfully");
      setDeleteDialogOpen(false);
      setOrderForAction(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete purchase order"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Purchase Orders</h1>
          <p className="text-muted-foreground">
            Manage purchase orders from suppliers
          </p>
        </div>
        <Button onClick={handleCreateOrder}>
          <Plus className="mr-2 h-4 w-4" />
          Create Purchase Order
        </Button>
      </div>

      <div className="space-y-4">
        <div className="mb-4 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search purchase orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="w-[200px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="in_transit">In Transit</SelectItem>
              <SelectItem value="partially_received">Partially Received</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-destructive">
            Error loading purchase orders. Please try again.
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No purchase orders found. Create your first purchase order to get started.
          </div>
        ) : (
          <>
            <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead>Expected Delivery</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        {order.orderCode}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{order.supplier?.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {order.supplier?.code}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(order.orderDate), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        {format(new Date(order.expectedDeliveryDate), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(order.status)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(order.totalAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewOrder(order)}
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {order.status === "draft" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditOrder(order)}
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSubmitOrder(order)}
                                title="Submit"
                              >
                                <Send className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteOrder(order)}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {order.status === "submitted" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleApproveOrder(order)}
                                title="Approve"
                              >
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelOrder(order)}
                                title="Cancel"
                              >
                                <XCircle className="h-4 w-4 text-red-600" />
                              </Button>
                            </>
                          )}
                          {(order.status === "approved" ||
                            order.status === "in_transit" ||
                            order.status === "partially_received") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReceiveGoods(order)}
                              title="Receive Goods"
                            >
                              <Package className="h-4 w-4 text-purple-600" />
                            </Button>
                          )}
                          {order.status !== "draft" &&
                           order.status !== "submitted" &&
                           order.status !== "received" &&
                           order.status !== "cancelled" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelOrder(order)}
                              title="Cancel"
                            >
                              <XCircle className="h-4 w-4 text-red-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
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
      <PurchaseOrderFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        purchaseOrder={selectedOrder}
      />

      {/* View Dialog */}
      <PurchaseOrderViewDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        purchaseOrder={selectedOrder}
      />

      {/* Receive Goods Dialog */}
      <ReceiveGoodsDialog
        open={receiveGoodsDialogOpen}
        onOpenChange={setReceiveGoodsDialogOpen}
        purchaseOrder={selectedOrder}
      />

      {/* Submit Confirmation Dialog */}
      <AlertDialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Purchase Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to submit {orderForAction?.orderCode}? Once submitted, the
              order will require approval before processing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSubmit}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? "Submitting..." : "Submit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve Confirmation Dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Purchase Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve {orderForAction?.orderCode}? Once approved, the
              order can be processed and received.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmApprove}
              disabled={approveMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {approveMutation.isPending ? "Approving..." : "Approve"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Purchase Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel {orderForAction?.orderCode}? This action cannot be
              undone and the order will be marked as cancelled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancel}
              disabled={cancelMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelMutation.isPending ? "Cancelling..." : "Cancel Order"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Purchase Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {orderForAction?.orderCode}? This action cannot be
              undone and the order will be permanently removed from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
