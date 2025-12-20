"use client";

import { use, useState } from "react";
import { ArrowLeft, PlayCircle, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { useTransformationOrder } from "@/hooks/useTransformationOrders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-500",
  PREPARING: "bg-blue-500",
  COMPLETED: "bg-green-500",
  CANCELLED: "bg-red-500",
};

type Props = {
  params: Promise<{ id: string }>;
};

function TransformationOrderContent({ id }: { id: string }) {
  const { formatCurrency } = useCurrency();
  const { t } = useLanguage();
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    action: "prepare" | "complete" | "cancel" | null;
  }>({ open: false, action: null });
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: orderResponse, isLoading, refetch } = useTransformationOrder(id);
  // @ts-ignore - API returns snake_case fields, will be fixed with API transformation layer
  const order = orderResponse?.data;
  console.log("orderResponse", orderResponse);
  const handleAction = async () => {
    if (!actionDialog.action || !order) return;

    setIsProcessing(true);
    try {
      switch (actionDialog.action) {
        case "prepare":
          await transformationOrdersApi.prepare(order.id);
          toast.success(t.transformation.orderPrepared);
          break;
        case "complete":
          // For now, auto-execute with planned quantities
          const executeData = {
            inputs: order.inputs.map((input: any) => ({
              inputLineId: input.id,
              consumedQuantity: input.planned_quantity,
            })),
            outputs: order.outputs.map((output: any) => ({
              outputLineId: output.id,
              producedQuantity: output.planned_quantity,
            })),
          };
          console.log('Completing transformation with data:', executeData);
          await transformationOrdersApi.execute(order.id, executeData);
          toast.success(t.transformation.orderCompleted);
          break;
        case "cancel":
          await transformationOrdersApi.cancel(order.id);
          toast.success(t.transformation.orderCancelled);
          break;
      }
      refetch();
    } catch (error) {
      console.error('Action failed:', error);
      const errorMessage = error instanceof Error ? error.message : `Failed to ${actionDialog.action} order`;
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
      setActionDialog({ open: false, action: null });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{t.common.loading}</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{t.transformation.order} {t.transformation.notFound}</p>
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
          {/* @ts-ignore - API returns snake_case until transformation is implemented */}
          <h1 className="text-3xl font-bold tracking-tight">{order.order_code}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t.transformation.template}:{" "}
            {/* @ts-ignore - API returns snake_case until transformation is implemented */}
            {"template" in order && order.template && typeof order.template === "object" && "template_code" in order.template
              ? String(order.template.template_code)
              : "N/A"}
          </p>
        </div>
      </div>

      {/* Status and Key Info Card */}
      <Card className="border-2">
        <CardContent className="pt-6">
          <div className="grid grid-cols-5 gap-6">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.common.status}</p>
              <Badge className={`${statusColors[order.status]} text-sm px-3 py-1`}>{order.status}</Badge>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.common.warehouse}</p>
              <p className="text-sm font-semibold">
                {"source_warehouse" in order && order.source_warehouse && typeof order.source_warehouse === "object" && "warehouse_name" in order.source_warehouse
                  ? String(order.source_warehouse.warehouse_name)
                  : "N/A"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.transformation.orderDate}</p>
              <p className="text-sm font-semibold">
                {new Date(order.order_date).toLocaleDateString()}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.transformation.plannedQuantity}</p>
              <p className="text-sm font-semibold">{order.planned_quantity}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.transformation.actualQuantity}</p>
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
              <p className="text-sm font-medium text-muted-foreground">{t.transformation.totalInputCost}</p>
              <p className="text-3xl font-bold tracking-tight">
                {formatCurrency(order.total_input_cost || 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">{t.transformation.totalOutputCost}</p>
              <p className="text-3xl font-bold tracking-tight">
                {formatCurrency(order.total_output_cost || 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className={`border-l-4 ${(order.cost_variance || 0) < 0 ? "border-l-red-500" : "border-l-gray-500"}`}>
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">{t.transformation.costVariance}</p>
              <p className={`text-3xl font-bold tracking-tight ${
                (order.cost_variance || 0) < 0 ? "text-red-500" : ""
              }`}>
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
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="h-8 w-1 bg-orange-500 rounded-full" />
              {t.transformation.inputMaterials}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {"inputs" in order && Array.isArray(order.inputs) && order.inputs.map((input: any) => (
                <div key={input.id} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-sm">
                        {"items" in input && input.items && typeof input.items === "object" && "item_code" in input.items
                          ? String(input.items.item_code)
                          : "N/A"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {"items" in input && input.items && typeof input.items === "object" && "item_name" in input.items
                          ? String(input.items.item_name)
                          : "N/A"}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {formatCurrency("unit_cost" in input && input.unit_cost ? Number(input.unit_cost) : 0)}/unit
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
                        {"consumed_quantity" in input && input.consumed_quantity ? input.consumed_quantity : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t.transformation.totalCost}</p>
                      <p className="font-semibold">
                        {formatCurrency("total_cost" in input && input.total_cost ? Number(input.total_cost) : 0)}
                      </p>
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
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="h-8 w-1 bg-green-500 rounded-full" />
              {t.transformation.outputProducts}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {"outputs" in order && Array.isArray(order.outputs) && order.outputs.map((output: any) => (
                <div key={output.id} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-sm">
                        {"items" in output && output.items && typeof output.items === "object" && "item_code" in output.items
                          ? String(output.items.item_code)
                          : "N/A"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {"items" in output && output.items && typeof output.items === "object" && "item_name" in output.items
                          ? String(output.items.item_name)
                          : "N/A"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {"is_scrap" in output && output.is_scrap && (
                        <Badge variant="outline" className="text-xs">{t.transformation.scrap}</Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {formatCurrency("allocated_cost_per_unit" in output && output.allocated_cost_per_unit ? Number(output.allocated_cost_per_unit) : 0)}/unit
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">{t.transformation.planned}</p>
                      <p className="font-semibold">{output.planned_quantity}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t.transformation.produced}</p>
                      <p className="font-semibold text-green-600">
                        {"produced_quantity" in output && output.produced_quantity ? output.produced_quantity : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t.transformation.totalCost}</p>
                      <p className="font-semibold">
                        {formatCurrency("total_allocated_cost" in output && output.total_allocated_cost ? Number(output.total_allocated_cost) : 0)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer with Action Buttons */}
      <div className="sticky bottom-0 bg-background pt-4 pb-6 flex gap-2 justify-end">
        {canPrepare && (
          <Button
            onClick={() => setActionDialog({ open: true, action: "prepare" })}
          >
            <PlayCircle className="mr-2 h-4 w-4" />
            {t.transformation.prepare}
          </Button>
        )}
        {canComplete && (
          <Button
            onClick={() => setActionDialog({ open: true, action: "complete" })}
          >
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

      {/* Action Confirmation Dialog */}
      <AlertDialog
        open={actionDialog.open}
        onOpenChange={(open) => setActionDialog({ open, action: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog.action === "prepare" && t.transformation.prepareOrder}
              {actionDialog.action === "complete" && t.transformation.completeOrder}
              {actionDialog.action === "cancel" && t.transformation.cancelOrder}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionDialog.action === "prepare" && t.transformation.prepareConfirmation}
              {actionDialog.action === "complete" && t.transformation.completeConfirmation}
              {actionDialog.action === "cancel" && t.transformation.cancelConfirmation}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>
              {actionDialog.action === "cancel" ? t.common.no : t.common.cancel}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleAction} disabled={isProcessing}>
              {isProcessing ? `${t.transformation.preparing}...` : actionDialog.action === "cancel" ? t.common.yes : t.common.confirm}
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
