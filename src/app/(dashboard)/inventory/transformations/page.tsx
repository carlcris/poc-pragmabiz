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
import { DataTableSkeletonRows } from "@/components/shared/DataTableSkeletonRows";
import { EmptyStatePanel } from "@/components/shared/EmptyStatePanel";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageToolbar } from "@/components/shared/PageToolbar";
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
      <PageHeader
        title={t("transformations")}
        subtitle={t("manageMaterialTransformations")}
        actions={
          <>
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
          </>
        }
      />

      <PageToolbar>
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
      </PageToolbar>

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
              <DataTableSkeletonRows
                columnWidths={["w-24", "w-24", "w-20", "w-24", "w-24", "w-16", "w-20", "w-20", "w-8"]}
                badgeColumns={[2]}
                rightAlignedColumns={[6, 7, 8]}
                actionColumnIndex={8}
              />
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
