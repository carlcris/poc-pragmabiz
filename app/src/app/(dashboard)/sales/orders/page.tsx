"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Filter,
  Eye,
  FileText,
  CheckCircle,
  XCircle,
  Truck,
  Package,
  Clock,
  Receipt,
} from "lucide-react";
import { useSalesOrders, useConvertToInvoice, useConfirmOrder } from "@/hooks/useSalesOrders";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { useCurrency } from "@/hooks/useCurrency";
import { SalesOrderFormDialog } from "@/components/sales-orders/SalesOrderFormDialog";
import { SalesOrderViewDialog } from "@/components/sales-orders/SalesOrderViewDialog";
import type { SalesOrder, SalesOrderStatus } from "@/types/sales-order";
import type { WarehouseLocation } from "@/types/inventory-location";

export default function SalesOrdersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [warehouseDialogOpen, setWarehouseDialogOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [orderToInvoice, setOrderToInvoice] = useState<SalesOrder | null>(null);

  const { formatCurrency } = useCurrency();
  const router = useRouter();
  const convertToInvoice = useConvertToInvoice();
  const confirmOrder = useConfirmOrder();

  const { data: warehousesData } = useWarehouses({ limit: 1000 });
  const warehouses = warehousesData?.data || [];

  const { data: locationsData } = useQuery<{ data: WarehouseLocation[] }>({
    queryKey: ["warehouse-locations", selectedWarehouse],
    queryFn: () => apiClient.get(`/api/warehouses/${selectedWarehouse}/locations`),
    enabled: !!selectedWarehouse,
  });

  const locations = useMemo(
    () => (locationsData?.data || []).filter((location) => location.isActive),
    [locationsData]
  );

  const { data, isLoading, error } = useSalesOrders({
    search,
    page: 1,
    limit: 1000, // Get all for client-side filtering
  });

  // Apply client-side filters
  let filteredOrders = data?.data || [];

  if (statusFilter !== "all") {
    filteredOrders = filteredOrders.filter((o) => o.status === statusFilter);
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

  const getStatusIcon = (status: SalesOrderStatus) => {
    switch (status) {
      case "draft":
        return <FileText className="h-4 w-4 text-gray-600" />;
      case "confirmed":
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "shipped":
        return <Truck className="h-4 w-4 text-purple-600" />;
      case "delivered":
        return <Package className="h-4 w-4 text-green-600" />;
      case "invoiced":
        return <Receipt className="h-4 w-4 text-indigo-600" />;
      case "cancelled":
        return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getStatusBadge = (status: SalesOrderStatus) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "confirmed":
        return (
          <Badge variant="default" className="bg-blue-600">
            Confirmed
          </Badge>
        );
      case "in_progress":
        return (
          <Badge variant="default" className="bg-yellow-600">
            In Progress
          </Badge>
        );
      case "shipped":
        return (
          <Badge variant="default" className="bg-purple-600">
            Shipped
          </Badge>
        );
      case "delivered":
        return (
          <Badge variant="default" className="bg-green-600">
            Delivered
          </Badge>
        );
      case "invoiced":
        return (
          <Badge variant="default" className="bg-indigo-600">
            Invoiced
          </Badge>
        );
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const isOverdue = (expectedDeliveryDate: string, status: SalesOrderStatus) => {
    if (status === "delivered" || status === "cancelled" || status === "invoiced") return false;
    return new Date(expectedDeliveryDate) < new Date();
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleCreateOrder = () => {
    setSelectedOrder(null);
    setDialogOpen(true);
  };

  const handleEditOrder = (order: SalesOrder) => {
    setSelectedOrder(order);
    setDialogOpen(true);
  };

  const handleViewOrder = (order: SalesOrder) => {
    setSelectedOrder(order);
    setViewDialogOpen(true);
  };

  const handleConvertToInvoice = (order: SalesOrder) => {
    setOrderToInvoice(order);
    setSelectedWarehouse("");
    setSelectedLocation("");
    setWarehouseDialogOpen(true);
  };

  const handleConfirmInvoiceConversion = async () => {
    if (!orderToInvoice || !selectedWarehouse) return;

    try {
      await convertToInvoice.mutateAsync({
        orderId: orderToInvoice.id,
        warehouseId: selectedWarehouse,
        locationId: selectedLocation || undefined,
      });
      setWarehouseDialogOpen(false);
      // Navigate to invoices page after conversion
      router.push('/sales/invoices');
    } catch (error) {
      // Error is handled by the mutation hook with toast
    }
  };

  const handleConfirmOrder = async (order: SalesOrder) => {
    try {
      await confirmOrder.mutateAsync(order.id);
    } catch (error) {
      // Error is handled by the mutation hook with toast
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales Orders</h1>
          <p className="text-muted-foreground">Process and manage customer orders</p>
        </div>
        <Button onClick={handleCreateOrder}>
          <Plus className="mr-2 h-4 w-4" />
          Create Order
        </Button>
      </div>

      <div className="space-y-4">
        <div className="mb-4 flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
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
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="invoiced">Invoiced</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead>Expected Delivery</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(10)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-4" />
                          <div className="flex-1">
                            <Skeleton className="h-4 w-24 mb-2" />
                            <Skeleton className="h-3 w-20" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32 mb-2" />
                        <Skeleton className="h-3 w-40" />
                      </TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-4 w-24 ml-auto mb-2" />
                        <Skeleton className="h-3 w-16 ml-auto" />
                      </TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Skeleton className="h-8 w-8" />
                          <Skeleton className="h-8 w-8" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              Error loading sales orders. Please try again.
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No sales orders found. Create your first order to get started.
            </div>
          ) : (
            <>
              <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Order Date</TableHead>
                      <TableHead>Expected Delivery</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(order.status)}
                            <div>
                              <div>{order.orderNumber}</div>
                              {order.quotationNumber && (
                                <div className="text-xs text-muted-foreground">
                                  From {order.quotationNumber}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{order.customerName}</div>
                          <div className="text-xs text-muted-foreground">
                            {order.customerEmail}
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(order.orderDate)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {formatDate(order.expectedDeliveryDate)}
                            {isOverdue(order.expectedDeliveryDate, order.status) && (
                              <Badge
                                variant="secondary"
                                className="bg-red-100 text-red-800 text-xs"
                              >
                                Overdue
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-medium">{formatCurrency(order.totalAmount)}</div>
                          <div className="text-xs text-muted-foreground">
                            {order.lineItems.length} item
                            {order.lineItems.length !== 1 ? "s" : ""}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleViewOrder(order)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {(order.status === "draft" || order.status === "confirmed") && (
                              <Button variant="ghost" size="sm" onClick={() => handleEditOrder(order)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {order.status === "draft" && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleConfirmOrder(order)}
                                className="bg-green-600 hover:bg-green-700"
                                disabled={confirmOrder.isPending}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Confirm
                              </Button>
                            )}
                            {(order.status === "confirmed" || order.status === "in_progress") && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleConvertToInvoice(order)}
                                className="bg-blue-600 hover:bg-blue-700"
                                disabled={convertToInvoice.isPending}
                              >
                                <Receipt className="h-4 w-4 mr-1" />
                                Invoice
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

      <SalesOrderFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        salesOrder={selectedOrder}
      />

      <SalesOrderViewDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        salesOrder={selectedOrder}
      />

      <Dialog open={warehouseDialogOpen} onOpenChange={setWarehouseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Warehouse</DialogTitle>
            <DialogDescription>
              Choose the warehouse from which stock will be deducted for this invoice.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select
              value={selectedWarehouse}
              onValueChange={(value) => {
                setSelectedWarehouse(value);
                setSelectedLocation("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a warehouse" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} - {warehouse.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="pb-2">
            <Select
              value={selectedLocation}
              onValueChange={setSelectedLocation}
              disabled={!selectedWarehouse}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    selectedWarehouse ? "Select a location (optional)" : "Select warehouse first"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.code} {location.name ? `- ${location.name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWarehouseDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmInvoiceConversion}
              disabled={!selectedWarehouse || convertToInvoice.isPending}
            >
              {convertToInvoice.isPending ? "Converting..." : "Create Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
