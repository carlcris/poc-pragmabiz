"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  Plus,
  Search,
  Trash2,
  Package,
  MoreVertical,
  PlayCircle,
  XCircle,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useTransformationOrders,
  useDeleteTransformationOrder,
  TRANSFORMATION_ORDERS_QUERY_KEY,
} from "@/hooks/useTransformationOrders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientOnly } from "@/components/shared/ClientOnly";
import { StatusText } from "@/components/shared/StatusText";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { DataTableSkeletonRows } from "@/components/shared/DataTableSkeletonRows";
import { EmptyStatePanel } from "@/components/shared/EmptyStatePanel";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageToolbar } from "@/components/shared/PageToolbar";
import type {
  TransformationOrderApi,
  TransformationOrderInputApi,
  TransformationOrderOutputApi,
  TransformationOrderStatus,
} from "@/types/transformation-order";
import { useCurrency } from "@/hooks/useCurrency";
import { transformationOrdersApi } from "@/lib/api/transformation-orders";
import { toast } from "sonner";

const getStatusLabel = (
  status: TransformationOrderStatus,
  tCommon: ReturnType<typeof useTranslations>
) => {
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

const getStatusTone = (status: TransformationOrderStatus) => {
  switch (status) {
    case "PREPARING":
      return "blue";
    case "COMPLETED":
      return "green";
    case "CANCELLED":
      return "red";
    case "DRAFT":
    default:
      return "muted";
  }
};

type ExecuteFormData = {
  inputs: Array<{ id: string; itemName: string; plannedQty: number; actualQty: number }>;
  outputs: Array<{
    id: string;
    itemName: string;
    plannedQty: number;
    actualQty: number;
    wastedQty: number;
    wasteReason: string;
    isScrap: boolean;
  }>;
};

export default function TransformationOrdersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { formatCurrency } = useCurrency();
  const t = useTranslations("transformation");
  const tCommon = useTranslations("common");
  const tForms = useTranslations("forms");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);
  const [actionDialog, setActionDialog] = useState<{
    orderId: string | null;
    action: "prepare" | "cancel" | null;
  }>({ orderId: null, action: null });
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [executeDialogOpen, setExecuteDialogOpen] = useState(false);
  const [executeOrder, setExecuteOrder] = useState<TransformationOrderApi | null>(null);
  const [executeFormData, setExecuteFormData] = useState<ExecuteFormData | null>(null);
  const [isLoadingExecuteOrder, setIsLoadingExecuteOrder] = useState(false);

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

  const handleOrderAction = async () => {
    if (!actionDialog.orderId || !actionDialog.action) return;

    setIsProcessingAction(true);
    try {
      if (actionDialog.action === "prepare") {
        await transformationOrdersApi.prepare(actionDialog.orderId);
        toast.success(t("orderPrepared"));
      } else {
        await transformationOrdersApi.cancel(actionDialog.orderId);
        toast.success(t("orderCancelled"));
      }

      await queryClient.invalidateQueries({ queryKey: [TRANSFORMATION_ORDERS_QUERY_KEY] });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t("failedOrderAction");
      toast.error(errorMessage);
    } finally {
      setIsProcessingAction(false);
      setActionDialog({ orderId: null, action: null });
    }
  };

  const handleCompleteClick = async (orderId: string) => {
    setIsLoadingExecuteOrder(true);
    try {
      const response = await transformationOrdersApi.getById(orderId);
      const order = response.data;
      const inputs = order.inputs ?? [];
      const outputs = order.outputs ?? [];

      setExecuteOrder(order);
      setExecuteFormData({
        inputs: inputs.map((input: TransformationOrderInputApi) => ({
          id: input.id,
          itemName: input.items?.item_name || t("notAvailable"),
          plannedQty: Number(input.planned_quantity) || 0,
          actualQty: Number(input.planned_quantity) || 0,
        })),
        outputs: outputs.map((output: TransformationOrderOutputApi) => ({
          id: output.id,
          itemName: output.items?.item_name || t("notAvailable"),
          plannedQty: Number(output.planned_quantity) || 0,
          actualQty: Number(output.planned_quantity) || 0,
          wastedQty: 0,
          wasteReason: "",
          isScrap: output.is_scrap || false,
        })),
      });
      setExecuteDialogOpen(true);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : t("failedExecuteTransformation");
      toast.error(errorMessage);
    } finally {
      setIsLoadingExecuteOrder(false);
    }
  };

  const handleExecuteSubmit = async () => {
    if (!executeFormData || !executeOrder) return;

    setIsProcessingAction(true);
    try {
      const executeData = {
        inputs: executeFormData.inputs.map((input) => ({
          inputLineId: input.id,
          consumedQuantity: input.actualQty,
        })),
        outputs: executeFormData.outputs.map((output) => ({
          outputLineId: output.id,
          producedQuantity: output.actualQty,
          wastedQuantity: output.wastedQty || 0,
          wasteReason: output.wasteReason || null,
        })),
      };

      await transformationOrdersApi.execute(executeOrder.id, executeData);
      toast.success(t("orderCompleted"));
      await queryClient.invalidateQueries({ queryKey: [TRANSFORMATION_ORDERS_QUERY_KEY] });
      setExecuteDialogOpen(false);
      setExecuteOrder(null);
      setExecuteFormData(null);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : t("failedExecuteTransformation");
      toast.error(errorMessage);
    } finally {
      setIsProcessingAction(false);
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
              <Link href="/manufacturing/transformations/templates">{t("manageTemplates")}</Link>
            </Button>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/manufacturing/transformations/new">
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
                columnWidths={[
                  "w-24",
                  "w-24",
                  "w-20",
                  "w-24",
                  "w-24",
                  "w-16",
                  "w-20",
                  "w-20",
                  "w-8",
                ]}
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
                  onClick={() => router.push(`/manufacturing/transformations/${order.id}`)}
                >
                  <TableCell className="font-medium">{order.order_code}</TableCell>
                  <TableCell>{order.template?.template_code || t("notAvailable")}</TableCell>
                  <TableCell>
                    <StatusText tone={getStatusTone(order.status)}>
                      {getStatusLabel(order.status, tCommon)}
                    </StatusText>
                  </TableCell>
                  <TableCell>{new Date(order.order_date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {order.source_warehouse?.warehouse_name || t("notAvailable")}
                  </TableCell>
                  <TableCell>{order.planned_quantity}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(order.total_input_cost || 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(order.total_output_cost || 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      {order.status === "DRAFT" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => setActionDialog({ orderId: order.id, action: "prepare" })}
                        >
                          <PlayCircle className="mr-2 h-4 w-4" />
                          <span>{t("prepare")}</span>
                        </Button>
                      )}
                      {order.status === "PREPARING" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2"
                          disabled={isLoadingExecuteOrder}
                          onClick={() => handleCompleteClick(order.id)}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          <span>{t("complete")}</span>
                        </Button>
                      )}
                      {(order.status === "DRAFT" || order.status === "PREPARING") && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0"
                              aria-label={tCommon("actions")}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                setActionDialog({ orderId: order.id, action: "cancel" })
                              }
                              className="text-destructive focus:text-destructive"
                            >
                              <XCircle className="h-4 w-4" />
                              <span>{t("cancelOrder")}</span>
                            </DropdownMenuItem>
                            {order.status === "DRAFT" && (
                              <DropdownMenuItem
                                onClick={() => setDeleteOrderId(order.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span>{tCommon("delete")}</span>
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
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

      <AlertDialog
        open={!!actionDialog.action}
        onOpenChange={(open) => {
          if (!open) {
            setActionDialog({ orderId: null, action: null });
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog.action === "prepare" && t("prepareOrder")}
              {actionDialog.action === "cancel" && t("cancelOrder")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionDialog.action === "prepare" && t("prepareConfirmation")}
              {actionDialog.action === "cancel" && t("cancelConfirmation")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessingAction}>
              {actionDialog.action === "cancel" ? tCommon("no") : tCommon("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleOrderAction} disabled={isProcessingAction}>
              {isProcessingAction
                ? tCommon("loading")
                : actionDialog.action === "cancel"
                  ? t("cancelOrder")
                  : t("prepare")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={executeDialogOpen}
        onOpenChange={(open) => {
          setExecuteDialogOpen(open);
          if (!open) {
            setExecuteOrder(null);
            setExecuteFormData(null);
          }
        }}
      >
        <AlertDialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("executeTransformation")}</AlertDialogTitle>
            <AlertDialogDescription>{t("enterActualQuantities")}</AlertDialogDescription>
          </AlertDialogHeader>

          {executeFormData && (
            <div className="py-4">
              <div className="space-y-4">
                {executeFormData.outputs.map((output, index) => {
                  const difference = output.actualQty - output.plannedQty;
                  const exceeds = output.actualQty > output.plannedQty;
                  const totalAccounted = output.actualQty + (output.wastedQty || 0);
                  const isValidTotal = totalAccounted === output.plannedQty;
                  const hasVariance = totalAccounted !== output.plannedQty;
                  const hasWaste = (output.wastedQty || 0) > 0;
                  const needsWasteReason =
                    hasWaste && (!output.wasteReason || output.wasteReason.trim() === "");

                  return (
                    <div key={output.id} className="space-y-4 rounded-lg border p-4">
                      <div className="flex items-start justify-between border-b pb-3">
                        <div className="flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <h4 className="text-base font-semibold">{output.itemName}</h4>
                            {output.isScrap && (
                              <Badge variant="outline" className="text-xs">
                                {t("scrap")}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {t("planned")}: <span className="font-medium">{output.plannedQty}</span>
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="grid grid-cols-2 items-start gap-4">
                          <div>
                            <label className="mb-2 block text-sm font-medium">
                              {t("actualProduced")}
                            </label>
                            <Input
                              type="text"
                              inputMode="decimal"
                              placeholder={String(output.plannedQty)}
                              value={output.actualQty}
                              onChange={(event) => {
                                const value = event.target.value.replace(/[^0-9.]/g, "");
                                const numValue = parseFloat(value) || 0;
                                const plannedQty = Number(output.plannedQty) || 0;
                                const autoWasted = Math.max(0, plannedQty - numValue);

                                setExecuteFormData({
                                  ...executeFormData,
                                  outputs: executeFormData.outputs.map((out, outputIndex) =>
                                    outputIndex === index
                                      ? { ...out, actualQty: numValue, wastedQty: autoWasted }
                                      : out
                                  ),
                                });
                              }}
                              className={`text-base ${exceeds ? "border-red-500" : ""}`}
                            />
                          </div>
                          {difference !== 0 && (
                            <div className="pt-7">
                              <div
                                className={`text-sm font-medium ${difference > 0 ? "text-red-600" : "text-yellow-600"}`}
                              >
                                {t("difference")}: {difference > 0 ? "+" : ""}
                                {difference}
                              </div>
                              {exceeds && (
                                <p className="mt-1 text-xs text-red-600">{t("exceedsPlanned")}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3 border-t pt-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{t("enterWasteDetails")}</p>
                            <Badge variant="secondary" className="text-xs">
                              {t("optional")}
                            </Badge>
                          </div>
                          {hasVariance && (
                            <div
                              className={`text-xs font-medium ${totalAccounted > output.plannedQty ? "text-red-600" : "text-yellow-600"}`}
                            >
                              {totalAccounted > output.plannedQty
                                ? t("totalExceedsPlanned")
                                : t("totalLessThanPlanned")}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-sm font-medium">
                              {t("wastedQuantity")}
                            </label>
                            <Input
                              type="text"
                              inputMode="decimal"
                              placeholder="0"
                              value={output.wastedQty || ""}
                              onChange={(event) => {
                                const value = event.target.value.replace(/[^0-9.]/g, "");
                                const numValue = parseFloat(value) || 0;
                                const plannedQty = Number(output.plannedQty) || 0;
                                const newActual = Math.max(0, plannedQty - numValue);

                                setExecuteFormData({
                                  ...executeFormData,
                                  outputs: executeFormData.outputs.map((out, outputIndex) =>
                                    outputIndex === index
                                      ? { ...out, wastedQty: numValue, actualQty: newActual }
                                      : out
                                  ),
                                });
                              }}
                              className={hasVariance ? "border-yellow-500" : ""}
                            />
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-medium">
                              {t("wasteReason")}
                              {hasWaste && <span className="ml-1 text-red-600">*</span>}
                            </label>
                            <Input
                              type="text"
                              placeholder={`${t("wasteReason")}...`}
                              value={output.wasteReason}
                              onChange={(event) => {
                                setExecuteFormData({
                                  ...executeFormData,
                                  outputs: executeFormData.outputs.map((out, outputIndex) =>
                                    outputIndex === index
                                      ? { ...out, wasteReason: event.target.value }
                                      : out
                                  ),
                                });
                              }}
                              className={needsWasteReason ? "border-red-500" : ""}
                            />
                            {needsWasteReason && (
                              <p className="mt-1 text-xs text-red-600">
                                {t("wasteReasonRequired")}
                              </p>
                            )}
                          </div>
                        </div>

                        <div
                          className={`flex items-center justify-between rounded p-2 text-sm ${
                            isValidTotal
                              ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                              : "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300"
                          }`}
                        >
                          <span className="font-medium">{t("totalAccounted")}:</span>
                          <span className="font-semibold">
                            {output.actualQty} + {output.wastedQty || 0} = {totalAccounted} /{" "}
                            {output.plannedQty}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessingAction}>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExecuteSubmit}
              disabled={
                isProcessingAction ||
                executeFormData?.outputs.some((output) => {
                  const totalAccounted = output.actualQty + (output.wastedQty || 0);
                  const hasWaste = (output.wastedQty || 0) > 0;
                  const missingReason =
                    hasWaste && (!output.wasteReason || output.wasteReason.trim() === "");

                  return totalAccounted !== output.plannedQty || missingReason;
                })
              }
            >
              {isProcessingAction ? `${t("preparing")}...` : t("complete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
