"use client";

import { useState } from "react";
import { Plus, Search, Eye, Filter, CheckCircle, XCircle } from "lucide-react";
import { usePurchaseOrders, useUpdatePurchaseOrder } from "@/hooks/usePurchaseOrders";
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
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { useCurrency } from "@/hooks/useCurrency";
import type { PurchaseOrder } from "@/types/purchase-order";
import { toast } from "sonner";
import { format } from "date-fns";

export default function PurchaseOrdersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { formatCurrency } = useCurrency();
  const updatePurchaseOrder = useUpdatePurchaseOrder();

  const { data, isLoading, error } = usePurchaseOrders({
    search,
    page: 1,
    limit: 1000, // Get all for client-side filtering
  });

  // Apply client-side filters
  let filteredOrders = data?.data || [];

  if (statusFilter !== "all") {
    filteredOrders = filteredOrders.filter(o => o.status === statusFilter);
  }

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

  const getStatusBadge = (status: PurchaseOrder["status"]) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      draft: { variant: "secondary", label: "Draft" },
      submitted: { variant: "outline", label: "Submitted" },
      approved: { variant: "default", label: "Approved" },
      in_transit: { variant: "outline", label: "In Transit" },
      partially_received: { variant: "outline", label: "Partially Received" },
      received: { variant: "default", label: "Received" },
      cancelled: { variant: "destructive", label: "Cancelled" },
    };

    const config = variants[status] || { variant: "secondary" as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleApprove = async (order: PurchaseOrder) => {
    if (order.status !== "submitted") {
      toast.error("Only submitted orders can be approved");
      return;
    }

    try {
      await updatePurchaseOrder.mutateAsync({
        id: order.id,
        data: { status: "approved" },
      });
      toast.success("Purchase order approved successfully");
    } catch (error) {
      toast.error("Failed to approve purchase order");
    }
  };

  const handleCancel = async (order: PurchaseOrder) => {
    if (order.status === "received" || order.status === "cancelled") {
      toast.error("Cannot cancel this order");
      return;
    }

    try {
      await updatePurchaseOrder.mutateAsync({
        id: order.id,
        data: { status: "cancelled" },
      });
      toast.success("Purchase order cancelled successfully");
    } catch (error) {
      toast.error("Failed to cancel purchase order");
    }
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
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
        <Button>
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
                          {order.orderNumber}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{order.supplierName}</div>
                            <div className="text-xs text-muted-foreground">
                              {order.supplierEmail}
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
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {order.status === "submitted" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleApprove(order)}
                                title="Approve"
                                disabled={updatePurchaseOrder.isPending}
                              >
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                            {order.status !== "received" && order.status !== "cancelled" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancel(order)}
                                title="Cancel"
                                disabled={updatePurchaseOrder.isPending}
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
    </div>
  );
}
