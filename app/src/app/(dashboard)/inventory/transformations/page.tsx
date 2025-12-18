"use client";

import { useState } from "react";
import { Plus, Search, Eye, Trash2, PlayCircle } from "lucide-react";
import Link from "next/link";
import {
  useTransformationOrders,
  useDeleteTransformationOrder,
} from "@/hooks/useTransformationOrders";
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
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import type { TransformationOrderStatus } from "@/types/transformation-order";
import { useCurrency } from "@/hooks/useCurrency";

const statusColors: Record<TransformationOrderStatus, string> = {
  DRAFT: "bg-gray-500",
  PREPARING: "bg-blue-500",
  COMPLETED: "bg-green-500",
  CANCELLED: "bg-red-500",
};

export default function TransformationOrdersPage() {
  const { formatCurrency } = useCurrency();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);

  const limit = 20;

  // Fetch orders
  const { data: ordersData, isLoading } = useTransformationOrders({
    search,
    status: status === "ALL" ? undefined : (status as TransformationOrderStatus),
    page,
    limit,
  });

  const deleteOrder = useDeleteTransformationOrder();

  const handleDelete = async () => {
    if (deleteOrderId) {
      await deleteOrder.mutateAsync(deleteOrderId);
      setDeleteOrderId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transformation Orders</h1>
          <p className="text-muted-foreground">
            Manage material and product transformations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/inventory/transformations/templates">
              Manage Templates
            </Link>
          </Button>
          <Button asChild>
            <Link href="/inventory/transformations/new">
              <Plus className="mr-2 h-4 w-4" />
              New Transformation
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by order code or notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="PREPARING">Preparing</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Orders Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order Code</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Order Date</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Planned Qty</TableHead>
              <TableHead className="text-right">Input Cost</TableHead>
              <TableHead className="text-right">Output Cost</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : ordersData?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  No transformation orders found
                </TableCell>
              </TableRow>
            ) : (
              ordersData?.data.map((order: any) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.order_code}</TableCell>
                  <TableCell>
                    {order.template?.template_code || "N/A"}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[order.status]}>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(order.order_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {order.source_warehouse?.warehouse_name || "N/A"}
                  </TableCell>
                  <TableCell>{order.planned_quantity}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(order.total_input_cost || 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(order.total_output_cost || 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/inventory/transformations/${order.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      {order.status === "DRAFT" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteOrderId(order.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {ordersData && ordersData.total > limit && (
        <DataTablePagination
          page={page}
          totalPages={Math.ceil(ordersData.total / limit)}
          onPageChange={setPage}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteOrderId} onOpenChange={() => setDeleteOrderId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transformation Order?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the transformation
              order.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
