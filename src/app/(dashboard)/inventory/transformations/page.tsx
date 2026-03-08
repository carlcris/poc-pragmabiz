"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Search, Eye, Trash2, Package } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

const statusColors: Record<TransformationOrderStatus, string> = {
  DRAFT: "bg-gray-500",
  PREPARING: "bg-blue-500",
  COMPLETED: "bg-green-500",
  CANCELLED: "bg-red-500",
};

const getStatusLabel = (status: TransformationOrderStatus, tCommon: ReturnType<typeof useTranslations>) => {
  switch (status) {
    case "DRAFT":
      return tCommon("draft");
    case "PREPARING":
      return tCommon("preparing");
    case "COMPLETED":
      return tCommon("completed");
    case "CANCELLED":
      return tCommon("cancelled");
    default:
      return status;
  }
};

export default function TransformationOrdersPage() {
  const router = useRouter();
  const { formatCurrency } = useCurrency();
  const t = useTranslations("transformation");
  const tCommon = useTranslations("common");
  const tForms = useTranslations("forms");
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
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight whitespace-nowrap">{t("transformations")}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">{t("manageMaterialTransformations")}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
          <Button variant="outline" asChild className="w-full sm:w-auto">
            <Link href="/inventory/transformations/templates">
              {t("manageTemplates")}
            </Link>
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/inventory/transformations/new">
              <Plus className="mr-2 h-4 w-4" />
              {t("newTransformation")}
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <div className="relative w-full sm:flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("searchOrdersPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <ClientOnly fallback={<Skeleton className="h-10 w-full sm:w-[180px]" />}>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={tCommon("allStatuses")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{tCommon("allStatuses")}</SelectItem>
              <SelectItem value="DRAFT">{tCommon("draft")}</SelectItem>
              <SelectItem value="PREPARING">{tCommon("preparing")}</SelectItem>
              <SelectItem value="COMPLETED">{tCommon("completed")}</SelectItem>
              <SelectItem value="CANCELLED">{tCommon("cancelled")}</SelectItem>
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
                <TableHead>{t("orderCode")}</TableHead>
                <TableHead>{t("template")}</TableHead>
                <TableHead>{tCommon("status")}</TableHead>
                <TableHead>{t("orderDate")}</TableHead>
                <TableHead>{tCommon("warehouse")}</TableHead>
                <TableHead>{t("plannedQuantity")}</TableHead>
                <TableHead className="text-right">{t("totalInputCost")}</TableHead>
                <TableHead className="text-right">{t("totalOutputCost")}</TableHead>
                <TableHead className="text-right">{tCommon("actions")}</TableHead>
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
          title={t("noOrdersFound")}
          description={t("tryAdjustingSearchOrStatus")}
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("orderCode")}</TableHead>
                <TableHead>{t("template")}</TableHead>
                <TableHead>{tCommon("status")}</TableHead>
                <TableHead>{t("orderDate")}</TableHead>
                <TableHead>{tCommon("warehouse")}</TableHead>
                <TableHead>{t("plannedQuantity")}</TableHead>
                <TableHead className="text-right">{t("totalInputCost")}</TableHead>
                <TableHead className="text-right">{t("totalOutputCost")}</TableHead>
                <TableHead className="text-right">{tCommon("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordersData.data.map((order: TransformationOrderApi) => (
                <TableRow
                  key={order.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/inventory/transformations/${order.id}`)}
                >
                  <TableCell className="font-medium">{order.order_code}</TableCell>
                  <TableCell>{order.template?.template_code || t("notAvailable")}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[order.status]}>{getStatusLabel(order.status, tCommon)}</Badge>
                  </TableCell>
                  <TableCell>{new Date(order.order_date).toLocaleDateString()}</TableCell>
                  <TableCell>{order.source_warehouse?.warehouse_name || t("notAvailable")}</TableCell>
                  <TableCell>{order.planned_quantity}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(order.total_input_cost || 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(order.total_output_cost || 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
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
              {tCommon("delete")} {t("transformationOrder")}?
            </AlertDialogTitle>
            <AlertDialogDescription>{tForms("deleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{tCommon("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
