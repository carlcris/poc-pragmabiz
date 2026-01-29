"use client";

import { use, useState } from "react";
import { ArrowLeft, PlayCircle, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { useTransformationOrder } from "@/hooks/useTransformationOrders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { useCurrency } from "@/hooks/useCurrency";
import { transformationOrdersApi } from "@/lib/api/transformation-orders";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import type {
  TransformationOrderInputApi,
  TransformationOrderOutputApi,
} from "@/types/transformation-order";

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-500",
  PREPARING: "bg-blue-500",
  COMPLETED: "bg-green-500",
  CANCELLED: "bg-red-500",
};

type Props = {
  params: Promise<{ id: string }>;
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

function TransformationOrderContent({ id }: { id: string }) {
  const { formatCurrency } = useCurrency();
  const { t } = useLanguage();
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    action: "prepare" | "cancel" | null;
  }>({ open: false, action: null });
  const [executeDialogOpen, setExecuteDialogOpen] = useState(false);
  const [executeFormData, setExecuteFormData] = useState<ExecuteFormData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: orderResponse, isLoading, refetch } = useTransformationOrder(id);
  const order = orderResponse?.data;
  const handleCompleteClick = () => {
    if (!order) return;

    // Prepare execute form data with planned quantities as defaults
    const inputs = order.inputs ?? [];
    const outputs = order.outputs ?? [];
    setExecuteFormData({
      inputs: inputs.map((input: TransformationOrderInputApi) => ({
        id: input.id,
        itemName: input.items?.item_name || "N/A",
        plannedQty: input.planned_quantity,
        actualQty: input.planned_quantity,
      })),
      outputs: outputs.map((output: TransformationOrderOutputApi) => ({
        id: output.id,
        itemName: output.items?.item_name || "N/A",
        plannedQty: output.planned_quantity,
        actualQty: output.planned_quantity,
        wastedQty: 0,
        wasteReason: "",
        isScrap: output.is_scrap || false,
      })),
    });
    setExecuteDialogOpen(true);
  };

  const handleExecuteSubmit = async () => {
    if (!executeFormData || !order) return;

    setIsProcessing(true);
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
      await transformationOrdersApi.execute(order.id, executeData);
      toast.success(t.transformation.orderCompleted);
      setExecuteDialogOpen(false);
      refetch();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to execute transformation";
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAction = async () => {
    if (!actionDialog.action || !order) return;

    setIsProcessing(true);
    try {
      switch (actionDialog.action) {
        case "prepare":
          await transformationOrdersApi.prepare(order.id);
          toast.success(t.transformation.orderPrepared);
          break;
        case "cancel":
          await transformationOrdersApi.cancel(order.id);
          toast.success(t.transformation.orderCancelled);
          break;
      }
      refetch();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : `Failed to ${actionDialog.action} order`;
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
      setActionDialog({ open: false, action: null });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">{t.common.loading}</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">
          {t.transformation.order} {t.transformation.notFound}
        </p>
      </div>
    );
  }

  const canPrepare = order.status === "DRAFT";
  const canComplete = order.status === "PREPARING";
  const canCancel = order.status === "DRAFT" || order.status === "PREPARING";

  return (
    <div className="space-y-6">
      {/* Header with Title */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/inventory/transformations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{order.order_code}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.transformation.template}: {order.template?.template_code || "N/A"}
          </p>
        </div>
      </div>

      {/* Status and Key Info Card */}
      <Card className="border-2">
        <CardContent className="pt-6">
          <div className="grid grid-cols-5 gap-6">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t.common.status}
              </p>
              <Badge className={`${statusColors[order.status]} px-3 py-1 text-sm`}>
                {order.status}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t.common.warehouse}
              </p>
              <p className="text-sm font-semibold">
                {order.source_warehouse?.warehouse_name || "N/A"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t.transformation.orderDate}
              </p>
              <p className="text-sm font-semibold">
                {new Date(order.order_date).toLocaleDateString()}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t.transformation.plannedQuantity}
              </p>
              <p className="text-sm font-semibold">
                {order.outputs && order.outputs.length > 0
                  ? order.outputs.reduce((sum, output) => sum + output.planned_quantity, 0)
                  : order.planned_quantity}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t.transformation.actualQuantity}
              </p>
              <p className="text-sm font-semibold">
                {"actual_quantity" in order && order.actual_quantity ? order.actual_quantity : "-"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cost Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                {t.transformation.totalInputCost}
              </p>
              <p className="text-3xl font-bold tracking-tight">
                {formatCurrency(order.total_input_cost || 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                {t.transformation.totalOutputCost}
              </p>
              <p className="text-3xl font-bold tracking-tight">
                {formatCurrency(order.total_output_cost || 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`border-l-4 ${(order.cost_variance || 0) < 0 ? "border-l-red-500" : "border-l-gray-500"}`}
        >
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                {t.transformation.costVariance}
              </p>
              <p
                className={`text-3xl font-bold tracking-tight ${
                  (order.cost_variance || 0) < 0 ? "text-red-500" : ""
                }`}
              >
                {formatCurrency(order.cost_variance || 0)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Materials Flow - Two Column Layout */}
      <div className="grid grid-cols-2 gap-6">
        {/* Input Materials */}
        <Card className="border-t-4 border-t-orange-500">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="h-8 w-1 rounded-full bg-orange-500" />
              {t.transformation.inputMaterials}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(order.inputs ?? []).map((input) => (
                <div
                  key={input.id}
                  className="rounded-lg border p-4 transition-colors hover:bg-accent/50"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold">{input.items?.item_code || "N/A"}</p>
                      <p className="text-xs text-muted-foreground">
                        {input.items?.item_name || "N/A"}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {formatCurrency(input.unit_cost ?? 0)}/unit
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">{t.transformation.planned}</p>
                      <p className="font-semibold">{input.planned_quantity}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t.transformation.consumed}</p>
                      <p className="font-semibold text-orange-600">
                        {input.consumed_quantity ?? "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t.transformation.totalCost}</p>
                      <p className="font-semibold">{formatCurrency(input.total_cost ?? 0)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Output Products */}
        <Card className="border-t-4 border-t-green-500">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="h-8 w-1 rounded-full bg-green-500" />
              {t.transformation.outputProducts}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(order.outputs ?? []).map((output) => (
                <div
                  key={output.id}
                  className="rounded-lg border p-4 transition-colors hover:bg-accent/50"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold">{output.items?.item_code || "N/A"}</p>
                      <p className="text-xs text-muted-foreground">
                        {output.items?.item_name || "N/A"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {output.is_scrap && (
                        <Badge variant="outline" className="text-xs">
                          {t.transformation.scrap}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {formatCurrency(output.allocated_cost_per_unit ?? 0)}/unit
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">{t.transformation.planned}</p>
                      <p className="font-semibold">{output.planned_quantity}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t.transformation.produced}</p>
                      <p className="font-semibold text-green-600">
                        {output.produced_quantity ?? "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t.transformation.wastedQuantity}</p>
                      <p className="font-semibold text-orange-600">{output.wasted_quantity ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t.transformation.totalCost}</p>
                      <p className="font-semibold">
                        {formatCurrency(output.total_allocated_cost ?? 0)}
                      </p>
                    </div>
                  </div>
                  {/* Show waste reason if there is waste */}
                  {output.wasted_quantity && output.wasted_quantity > 0 && (
                    <div className="mt-2 border-t pt-2 text-xs">
                      <p className="text-muted-foreground">{t.transformation.wasteReason}:</p>
                      <p className="italic text-orange-600">
                        {output.waste_reason || "No reason provided"}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer with Action Buttons */}
      <div className="sticky bottom-0 flex justify-end gap-2 bg-background pb-6 pt-4">
        {canPrepare && (
          <Button onClick={() => setActionDialog({ open: true, action: "prepare" })}>
            <PlayCircle className="mr-2 h-4 w-4" />
            {t.transformation.prepare}
          </Button>
        )}
        {canComplete && (
          <Button onClick={handleCompleteClick}>
            <CheckCircle className="mr-2 h-4 w-4" />
            {t.transformation.complete}
          </Button>
        )}
        {canCancel && (
          <Button
            variant="destructive"
            onClick={() => setActionDialog({ open: true, action: "cancel" })}
          >
            <XCircle className="mr-2 h-4 w-4" />
            {t.transformation.cancelOrder}
          </Button>
        )}
      </div>

      {/* Action Confirmation Dialog (Prepare/Cancel) */}
      <AlertDialog
        open={actionDialog.open}
        onOpenChange={(open) => setActionDialog({ open, action: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog.action === "prepare" && t.transformation.prepareOrder}
              {actionDialog.action === "cancel" && t.transformation.cancelOrder}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionDialog.action === "prepare" && t.transformation.prepareConfirmation}
              {actionDialog.action === "cancel" && t.transformation.cancelConfirmation}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>
              {actionDialog.action === "cancel" ? t.common.no : t.common.cancel}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleAction} disabled={isProcessing}>
              {isProcessing
                ? `${t.transformation.preparing}...`
                : actionDialog.action === "cancel"
                  ? t.common.yes
                  : t.common.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Execute Transformation Dialog */}
      <AlertDialog open={executeDialogOpen} onOpenChange={setExecuteDialogOpen}>
        <AlertDialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{t.transformation.executeTransformation}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.transformation.enterActualQuantities}
            </AlertDialogDescription>
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
                      {/* Product Header */}
                      <div className="flex items-start justify-between border-b pb-3">
                        <div className="flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <h4 className="text-base font-semibold">{output.itemName}</h4>
                            {output.isScrap && (
                              <Badge variant="outline" className="text-xs">
                                {t.transformation.scrap}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {t.transformation.planned}:{" "}
                            <span className="font-medium">{output.plannedQty}</span>
                          </p>
                        </div>
                      </div>

                      {/* Actual Produced Section */}
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 items-start gap-4">
                          <div>
                            <label className="mb-2 block text-sm font-medium">
                              {t.transformation.actualProduced}
                            </label>
                            <Input
                              type="text"
                              inputMode="decimal"
                              placeholder={String(output.plannedQty)}
                              value={output.actualQty}
                              onChange={(e) => {
                                const value = e.target.value.replace(/[^0-9.]/g, "");
                                const numValue = parseFloat(value) || 0;
                                // Auto-calculate wasted quantity
                                const autoWasted = Math.max(0, output.plannedQty - numValue);
                                setExecuteFormData({
                                  ...executeFormData,
                                  outputs: executeFormData.outputs.map((out, i) =>
                                    i === index
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
                                {t.transformation.difference}: {difference > 0 ? "+" : ""}
                                {difference}
                              </div>
                              {exceeds && (
                                <p className="mt-1 text-xs text-red-600">
                                  {t.transformation.exceedsPlanned}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Waste Tracking Section */}
                      <div className="space-y-3 border-t pt-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">
                              {t.transformation.enterWasteDetails}
                            </p>
                            <Badge variant="secondary" className="text-xs">
                              {t.transformation.optional}
                            </Badge>
                          </div>
                          {hasVariance && (
                            <div
                              className={`text-xs font-medium ${totalAccounted > output.plannedQty ? "text-red-600" : "text-yellow-600"}`}
                            >
                              {totalAccounted > output.plannedQty
                                ? "⚠️ Total exceeds planned"
                                : "⚠️ Total less than planned"}
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-sm font-medium">
                              {t.transformation.wastedQuantity}
                            </label>
                            <Input
                              type="text"
                              inputMode="decimal"
                              placeholder="0"
                              value={output.wastedQty || ""}
                              onChange={(e) => {
                                const value = e.target.value.replace(/[^0-9.]/g, "");
                                const numValue = parseFloat(value) || 0;
                                // Recalculate actual produced to maintain total
                                const newActual = Math.max(0, output.plannedQty - numValue);
                                setExecuteFormData({
                                  ...executeFormData,
                                  outputs: executeFormData.outputs.map((out, i) =>
                                    i === index
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
                              {t.transformation.wasteReason}
                              {hasWaste && <span className="ml-1 text-red-600">*</span>}
                            </label>
                            <Input
                              type="text"
                              placeholder={`${t.transformation.wasteReason}...`}
                              value={output.wasteReason}
                              onChange={(e) => {
                                setExecuteFormData({
                                  ...executeFormData,
                                  outputs: executeFormData.outputs.map((out, i) =>
                                    i === index ? { ...out, wasteReason: e.target.value } : out
                                  ),
                                });
                              }}
                              className={needsWasteReason ? "border-red-500" : ""}
                            />
                            {needsWasteReason && (
                              <p className="mt-1 text-xs text-red-600">Waste reason is required</p>
                            )}
                          </div>
                        </div>
                        {/* Total Summary */}
                        <div
                          className={`flex items-center justify-between rounded p-2 text-sm ${
                            isValidTotal
                              ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                              : "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300"
                          }`}
                        >
                          <span className="font-medium">Total Accounted:</span>
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
            <AlertDialogCancel disabled={isProcessing}>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExecuteSubmit}
              disabled={
                isProcessing ||
                executeFormData?.outputs.some((o) => {
                  const totalAccounted = o.actualQty + (o.wastedQty || 0);
                  const hasWaste = (o.wastedQty || 0) > 0;
                  const missingReason = hasWaste && (!o.wasteReason || o.wasteReason.trim() === "");
                  return totalAccounted !== o.plannedQty || missingReason;
                })
              }
            >
              {isProcessing ? `${t.transformation.preparing}...` : t.transformation.complete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function TransformationOrderDetailPage({ params }: Props) {
  const { id } = use(params);
  return <TransformationOrderContent id={id} />;
}
