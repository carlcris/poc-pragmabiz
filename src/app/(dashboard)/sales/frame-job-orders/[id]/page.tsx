"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowLeft, Factory, PackageOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusText } from "@/components/shared/StatusText";
import { FrameJobOrderRequisitionView } from "@/components/frame-job-orders/FrameJobOrderRequisitionView";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WarehouseSelect } from "@/components/warehouses/WarehouseSelect";
import { RESOURCES } from "@/constants/resources";
import { useCanCreate, useCanEdit } from "@/hooks/usePermissions";
import {
  getProductionMaterialRequestErrorCode,
  mutateProductionMaterialRequest,
  type ProductionMaterialRequestAction,
  type ProductionMaterialRequestErrorCode,
} from "@/lib/frame-job-orders/production-material-request";
import { INVENTORY_RESERVATIONS_QUERY_KEY } from "@/hooks/queryKeys";
import type { FrameJobOrderRequisitionResponse } from "@/lib/frame-job-orders/requisition";

type FrameJobOrderDetail = {
  id: string;
  jobOrderCode: string;
  customerName: string;
  status: string;
  requiredQuantity: number;
  issuedQuantity: number;
  manufacturingOrder: {
    id: string;
    manufacturingOrderCode: string;
    status: string;
  } | null;
  materialRequest: {
    id: string;
    status: "draft" | "approved" | "issued";
    warehouseId: string;
    warehouseCode: string;
    warehouseName: string;
    requestedAt: string;
    approvedAt: string | null;
    issuedAt: string | null;
    cancelledAt: string | null;
    items: Array<{
      id: string;
      frameJobOrderItemId: string;
      itemCode: string;
      itemName: string;
      requestedQuantity: number;
      issuedQuantity: number;
      baseQuantity: number;
      baseUomCode: string;
    }>;
  } | null;
};

type FrameJobOrderDetailResponse = {
  data: FrameJobOrderDetail;
};

type PageProps = {
  params: Promise<{ id: string }>;
};

const detailQueryKey = (id: string) => ["frame-job-order", id];
const requisitionQueryKey = (id: string) => ["frame-job-order", id, "requisition"];
const listQueryKey = ["frame-job-orders"];

const fetchFrameJobOrder = async (id: string): Promise<FrameJobOrderDetailResponse> => {
  const response = await fetch(`/api/frame-job-orders/${id}`, {
    credentials: "include",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || "Failed to load job order");
  }

  return response.json() as Promise<FrameJobOrderDetailResponse>;
};

const fetchFrameJobOrderRequisition = async (
  id: string
): Promise<FrameJobOrderRequisitionResponse> => {
  const response = await fetch(`/api/frame-job-orders/${id}/requisition`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("FAILED_TO_LOAD_JOB_REQUISITION");
  }

  return response.json() as Promise<FrameJobOrderRequisitionResponse>;
};

const pushFrameJobOrderToProduction = async (id: string) => {
  const response = await fetch(`/api/frame-job-orders/${id}/push-to-production`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || "Failed to push job order to production");
  }

  return response.json() as Promise<{
    success: boolean;
    jobOrderId: string;
    manufacturingOrder: { id: string; manufacturingOrderCode: string };
  }>;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 4,
  }).format(value);

const labelize = (value: string) =>
  value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getStatusText = (status: string) => {
  const tone =
    status === "completed"
      ? "green"
      : status === "queued" || status === "in_progress"
        ? "blue"
        : status === "on_hold" || status === "cancelled"
          ? "red"
          : "muted";

  return <StatusText tone={tone}>{labelize(status)}</StatusText>;
};

const DetailValue = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="space-y-1">
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
    <div className="break-words text-sm font-medium">{value || "-"}</div>
  </div>
);

const LoadingShell = () => (
  <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-10 w-36" />
    </div>
    <div className="space-y-4">
      <Skeleton className="h-96 w-full rounded-lg" />
      <div className="flex gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-36" />
      </div>
    </div>
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2, 3, 4].map((row) => (
          <Skeleton key={row} className="h-12 w-full" />
        ))}
      </CardContent>
    </Card>
  </div>
);

export default function FrameJobOrderDetailsPage({ params }: PageProps) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const t = useTranslations("frameJobOrderDetailsPage");
  const tCommon = useTranslations("common");
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [materialRequestError, setMaterialRequestError] =
    useState<ProductionMaterialRequestErrorCode | null>(null);
  const canCreateMaterialRequest = useCanCreate(RESOURCES.STOCK_REQUESTS);
  const canManageMaterialRequest = useCanEdit(RESOURCES.STOCK_REQUESTS);

  const { data, isLoading, error } = useQuery({
    queryKey: detailQueryKey(id),
    queryFn: () => fetchFrameJobOrder(id),
  });
  const {
    data: requisitionData,
    isLoading: isRequisitionLoading,
    error: requisitionError,
    refetch: refetchRequisition,
  } = useQuery({
    queryKey: requisitionQueryKey(id),
    queryFn: () => fetchFrameJobOrderRequisition(id),
  });

  const pushToProductionMutation = useMutation({
    mutationFn: pushFrameJobOrderToProduction,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: detailQueryKey(id) }),
        queryClient.invalidateQueries({ queryKey: listQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["manufacturing-orders"] }),
      ]);
    },
  });

  const materialRequestMutation = useMutation({
    mutationFn: ({
      action,
      warehouseId,
    }: {
      action: ProductionMaterialRequestAction;
      warehouseId?: string;
    }) => mutateProductionMaterialRequest(id, action, warehouseId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: detailQueryKey(id) }),
        queryClient.invalidateQueries({ queryKey: listQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["manufacturing-orders"] }),
        queryClient.invalidateQueries({ queryKey: [INVENTORY_RESERVATIONS_QUERY_KEY] }),
      ]);
    },
  });

  const order = data?.data;
  const canPushToProduction = order && !order.manufacturingOrder && order.status === "pending";

  const getMaterialRequestErrorMessage = (code: ProductionMaterialRequestErrorCode) => {
    switch (code) {
      case "MATERIAL_REQUEST_INVALID":
        return t("errors.invalid");
      case "MATERIAL_REQUEST_UNAUTHORIZED":
        return t("errors.unauthorized");
      case "MATERIAL_REQUEST_CONTEXT_INVALID":
        return t("errors.contextInvalid");
      case "MATERIAL_REQUEST_PERMISSION_DENIED":
        return t("errors.permissionDenied");
      case "MATERIAL_REQUEST_WAREHOUSE_REQUIRED":
        return t("errors.warehouseRequired");
      case "MATERIAL_REQUEST_WAREHOUSE_INVALID":
        return t("errors.warehouseInvalid");
      case "MATERIAL_REQUEST_JOB_NOT_FOUND":
        return t("errors.jobNotFound");
      case "MATERIAL_REQUEST_JOB_CLOSED":
        return t("errors.jobClosed");
      case "MATERIAL_REQUEST_ACTIVE_EXISTS":
        return t("errors.activeExists");
      case "MATERIAL_REQUEST_NO_OUTSTANDING_MATERIALS":
        return t("errors.noOutstandingMaterials");
      case "MATERIAL_REQUEST_MATERIAL_UNAVAILABLE":
        return t("errors.materialUnavailable");
      case "MATERIAL_REQUEST_TOO_LARGE":
        return t("errors.tooLarge");
      case "MATERIAL_REQUEST_NOT_FOUND":
        return t("errors.notFound");
      case "MATERIAL_REQUEST_STATUS_CHANGED":
        return t("errors.statusChanged");
      case "MATERIAL_REQUEST_STOCK_UNAVAILABLE":
        return t("errors.stockUnavailable");
      case "MATERIAL_REQUEST_INSUFFICIENT_STOCK":
        return t("errors.insufficientStock");
      case "MATERIAL_REQUEST_RESERVATION_MISSING":
        return t("errors.reservationMissing");
      case "MATERIAL_REQUEST_FAILED":
        return t("errors.failed");
    }
  };

  const handleMaterialRequestAction = async (
    action: ProductionMaterialRequestAction,
    warehouseId?: string
  ) => {
    setMaterialRequestError(null);
    try {
      await materialRequestMutation.mutateAsync({ action, warehouseId });
      if (action === "create") {
        setMaterialDialogOpen(false);
        setSelectedWarehouse("");
      }
      const successMessage =
        action === "create"
          ? t("success.create")
          : action === "approve"
            ? t("success.approve")
            : action === "issue"
              ? t("success.issue")
              : t("success.cancel");
      toast.success(successMessage);
    } catch (mutationError) {
      const code = getProductionMaterialRequestErrorCode(mutationError);
      setMaterialRequestError(code);
      if (action !== "create") toast.error(getMaterialRequestErrorMessage(code));
    }
  };

  const handlePushToProduction = async () => {
    if (!order) return;

    try {
      const result = await pushToProductionMutation.mutateAsync(order.id);
      toast.success(
        t("productionSent", { code: result.manufacturingOrder.manufacturingOrderCode })
      );
    } catch (mutationError) {
      toast.error(mutationError instanceof Error ? mutationError.message : t("productionFailed"));
    }
  };

  if (isLoading && !order) return <LoadingShell />;

  if (error || !order) {
    return (
      <div className="space-y-6">
        <Link
          href="/sales/frame-job-orders"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("backToJobOrders")}
        </Link>
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load job order"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasOutstandingMaterials = order.issuedQuantity < order.requiredQuantity;
  const materialRequest = order.materialRequest;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link
            href="/sales/frame-job-orders"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("backToJobOrders")}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">{order.jobOrderCode}</h1>
            {getStatusText(order.status)}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Job order for {order.customerName || "unnamed customer"}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {order.manufacturingOrder ? (
            <Button variant="outline" asChild>
              <Link href={`/manufacturing/floor?focus=${order.manufacturingOrder.id}`}>
                <Factory className="mr-2 h-4 w-4" />
                Open Production
              </Link>
            </Button>
          ) : canPushToProduction ? (
            <Button
              variant="outline"
              onClick={handlePushToProduction}
              disabled={pushToProductionMutation.isPending}
            >
              <Factory className="mr-2 h-4 w-4" />
              {pushToProductionMutation.isPending ? "Pushing..." : "Push to Production"}
            </Button>
          ) : null}
        </div>
      </div>

      {isRequisitionLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-96 w-full rounded-lg" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-36" />
          </div>
        </div>
      ) : requisitionError || !requisitionData ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-destructive">{t("requisitionLoadFailed")}</p>
            <Button variant="outline" onClick={() => void refetchRequisition()}>
              {t("retryRequisition")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <FrameJobOrderRequisitionView requisition={requisitionData.data} />
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>{t("materialRequest.title")}</CardTitle>
              <CardDescription>{t("materialRequest.description")}</CardDescription>
            </div>
            {materialRequest ? (
              <StatusText
                tone={
                  materialRequest.status === "issued"
                    ? "green"
                    : materialRequest.status === "approved"
                      ? "blue"
                      : "muted"
                }
              >
                {materialRequest.status === "issued"
                  ? t("materialRequest.statusIssued")
                  : materialRequest.status === "approved"
                    ? t("materialRequest.statusApproved")
                    : t("materialRequest.statusDraft")}
              </StatusText>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {materialRequest ? (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <DetailValue
                  label={t("materialRequest.warehouse")}
                  value={
                    [materialRequest.warehouseCode, materialRequest.warehouseName]
                      .filter(Boolean)
                      .join(" - ") || "-"
                  }
                />
                <DetailValue
                  label={t("materialRequest.requested")}
                  value={formatDateTime(materialRequest.requestedAt)}
                />
                <DetailValue
                  label={t("materialRequest.approved")}
                  value={formatDateTime(materialRequest.approvedAt)}
                />
                <DetailValue
                  label={t("materialRequest.issued")}
                  value={formatDateTime(materialRequest.issuedAt)}
                />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("materialRequest.material")}</TableHead>
                    <TableHead className="text-right">
                      {t("materialRequest.requestQuantity")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("materialRequest.issuedQuantity")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materialRequest.items.map((requestItem) => (
                    <TableRow key={requestItem.id}>
                      <TableCell>
                        {[requestItem.itemCode, requestItem.itemName].filter(Boolean).join(" - ") ||
                          "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(requestItem.baseQuantity)} {requestItem.baseUomCode}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(
                          requestItem.issuedQuantity > 0 ? requestItem.baseQuantity : 0
                        )}{" "}
                        {requestItem.baseUomCode}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex flex-wrap gap-2">
                {materialRequest.status === "draft" && canManageMaterialRequest ? (
                  <Button
                    onClick={() => handleMaterialRequestAction("approve")}
                    disabled={materialRequestMutation.isPending}
                  >
                    {materialRequestMutation.isPending
                      ? t("materialRequest.approving")
                      : t("materialRequest.approve")}
                  </Button>
                ) : null}
                {materialRequest.status === "approved" && canManageMaterialRequest ? (
                  <Button
                    onClick={() => handleMaterialRequestAction("issue")}
                    disabled={materialRequestMutation.isPending}
                  >
                    <PackageOpen className="mr-2 h-4 w-4" />
                    {materialRequestMutation.isPending
                      ? t("materialRequest.issuing")
                      : t("materialRequest.issue")}
                  </Button>
                ) : null}
                {(materialRequest.status === "draft" || materialRequest.status === "approved") &&
                canManageMaterialRequest ? (
                  <Button
                    variant="outline"
                    onClick={() => handleMaterialRequestAction("cancel")}
                    disabled={materialRequestMutation.isPending}
                  >
                    {t("materialRequest.cancel")}
                  </Button>
                ) : null}
              </div>
            </>
          ) : hasOutstandingMaterials ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {t("materialRequest.emptyDescription")}
              </p>
              {canCreateMaterialRequest ? (
                <Button
                  onClick={() => {
                    setMaterialRequestError(null);
                    setMaterialDialogOpen(true);
                  }}
                >
                  <PackageOpen className="mr-2 h-4 w-4" />
                  {t("materialRequest.create")}
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("materialRequest.noStockManagedMaterials")}
            </p>
          )}

          {materialRequestError && !materialDialogOpen ? (
            <p className="text-sm text-destructive">
              {getMaterialRequestErrorMessage(materialRequestError)}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={materialDialogOpen}
        onOpenChange={(open) => {
          setMaterialDialogOpen(open);
          if (!open) {
            setSelectedWarehouse("");
            setMaterialRequestError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("materialRequest.dialogTitle")}</DialogTitle>
            <DialogDescription>{t("materialRequest.dialogDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <WarehouseSelect
              value={selectedWarehouse}
              onValueChange={(value) => {
                setSelectedWarehouse(value);
                setMaterialRequestError(null);
              }}
              scope="current_business_unit"
            />
            {materialRequestError ? (
              <p className="text-sm text-destructive">
                {getMaterialRequestErrorMessage(materialRequestError)}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaterialDialogOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={() => handleMaterialRequestAction("create", selectedWarehouse)}
              disabled={!selectedWarehouse || materialRequestMutation.isPending}
            >
              {materialRequestMutation.isPending
                ? t("materialRequest.creating")
                : t("materialRequest.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
