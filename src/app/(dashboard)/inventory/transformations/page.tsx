"use client";

import { useState } from "react";
import { Plus, Search, Eye, Trash2, Package } from "lucide-react";
import Link from "next/link";
import {
  useTransformationOrders,
  useDeleteTransformationOrder,
} from "@/hooks/useTransformationOrders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientOnly } from "@/components/shared/ClientOnly";
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight whitespace-nowrap">{t.transformation.transformationOrder}s</h1>
          <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">{t.transformation.manageMaterialTransformations}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
          <Button variant="outline" asChild className="w-full sm:w-auto">
            <Link href="/inventory/transformations/templates">
              {t.transformation.manageTemplates}
            </Link>
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/inventory/transformations/new">
              <Plus className="mr-2 h-4 w-4" />
              {t.transformation.newTransformation}
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <div className="relative w-full sm:flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t.transformation.searchOrdersPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <ClientOnly fallback={<Skeleton className="h-10 w-full sm:w-[180px]" />}>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-[180px]">
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
        </ClientOnly>
      </div>

      {/* Orders Table */}
      {isLoading ? (
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
              {[...Array(8)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20 rounded-full" />
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
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-4 w-20" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-4 w-20" />
                  </TableCell>
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
      ) : !ordersData?.data || ordersData.data.length === 0 ? (
        <EmptyStatePanel
          icon={Package}
          title={t.transformation.noOrdersFound}
          description="Try adjusting your search or status filter."
        />
      ) : (
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
              {ordersData.data.map((order: TransformationOrderApi) => (
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
              ))}
            </TableBody>
          </Table>
        </div>
      )}

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
