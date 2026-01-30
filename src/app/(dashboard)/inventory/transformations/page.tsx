"use client";

import { useState } from "react";
import { Plus, Search, Eye, Trash2 } from "lucide-react";
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
import type {
  TransformationOrderApi,
  TransformationOrderStatus,
} from "@/types/transformation-order";
import { useCurrency } from "@/hooks/useCurrency";
import { useLanguage } from "@/contexts/LanguageContext";

const statusColors: Record<TransformationOrderStatus, string> = {
  DRAFT: "bg-gray-500",
  PREPARING: "bg-blue-500",
  COMPLETED: "bg-green-500",
  CANCELLED: "bg-red-500",
};

export default function TransformationOrdersPage() {
  const { formatCurrency } = useCurrency();
  const { t } = useLanguage();
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
          <h1 className="text-3xl font-bold">{t.transformation.transformationOrder}s</h1>
          <p className="text-muted-foreground">{t.transformation.manageMaterialTransformations}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/inventory/transformations/templates">
              {t.transformation.manageTemplates}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/inventory/transformations/new">
              <Plus className="mr-2 h-4 w-4" />
              {t.transformation.newTransformation}
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t.transformation.searchOrdersPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t.common.allStatuses} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t.common.allStatuses}</SelectItem>
            <SelectItem value="DRAFT">{t.common.draft}</SelectItem>
            <SelectItem value="PREPARING">{t.common.preparing}</SelectItem>
            <SelectItem value="COMPLETED">{t.common.completed}</SelectItem>
            <SelectItem value="CANCELLED">{t.common.cancelled}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Orders Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.transformation.orderCode}</TableHead>
              <TableHead>{t.transformation.template}</TableHead>
              <TableHead>{t.common.status}</TableHead>
              <TableHead>{t.transformation.orderDate}</TableHead>
              <TableHead>{t.common.warehouse}</TableHead>
              <TableHead>{t.transformation.plannedQuantity}</TableHead>
              <TableHead className="text-right">{t.transformation.totalInputCost}</TableHead>
              <TableHead className="text-right">{t.transformation.totalOutputCost}</TableHead>
              <TableHead className="text-right">{t.common.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center">
                  {t.common.loading}
                </TableCell>
              </TableRow>
            ) : ordersData?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center">
                  {t.transformation.noOrdersFound}
                </TableCell>
              </TableRow>
            ) : (
              ordersData?.data.map((order: TransformationOrderApi) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.order_code}</TableCell>
                  <TableCell>{order.template?.template_code || "N/A"}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[order.status]}>{order.status}</Badge>
                  </TableCell>
                  <TableCell>{new Date(order.order_date).toLocaleDateString()}</TableCell>
                  <TableCell>{order.source_warehouse?.warehouse_name || "N/A"}</TableCell>
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
          currentPage={page}
          totalPages={Math.ceil(ordersData.total / limit)}
          pageSize={limit}
          totalItems={ordersData.total}
          onPageChange={setPage}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteOrderId} onOpenChange={() => setDeleteOrderId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t.common.delete} {t.transformation.transformationOrder}?
            </AlertDialogTitle>
            <AlertDialogDescription>{t.forms.deleteConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t.common.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
