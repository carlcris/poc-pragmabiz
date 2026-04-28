"use client";

import { use } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  Factory,
  PackageCheck,
  Ruler,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Skeleton
} from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MetricCard } from "@/components/shared/MetricCard";

type FrameJobOrderComponent = {
  id: string;
  componentType: string;
  source: string;
  itemCode: string;
  itemName: string;
  description: string;
  qtyPerFrame: number;
  requiredQuantity: number;
  issuedQuantity: number;
  uomCode: string;
  unitRate: number;
  totalAmount: number;
  roundingMode: string;
  reservation: {
    quantity: number;
    status: string;
    warehouseCode: string;
    warehouseName: string;
    reservedAt: string;
    consumedAt: string | null;
    releasedAt: string | null;
  } | null;
};

type FrameJobOrderLine = {
  quotationItemId: string;
  itemCode: string;
  itemName: string;
  description: string;
  quantity: number;
  uomCode: string;
  rate: number;
  lineTotal: number;
  configuration: {
    width: number;
    height: number;
    fixedAllowance: number;
    moldingItemCode: string;
    moldingItemName: string;
    moldingStickLength: number;
    moldingSticksRequired: number;
    serviceFeeMode: string;
    serviceType: string;
    serviceFeeAmount: number;
    totalServiceFee: number;
    invoiceDisplayMode: string;
  } | null;
  components: FrameJobOrderComponent[];
};

type FrameJobOrderDetail = {
  id: string;
  jobOrderCode: string;
  salesOrderCode: string;
  quotationCode: string;
  draftInvoiceCode: string;
  customerName: string;
  status: string;
  orderDate: string;
  completedAt: string | null;
  notes: string | null;
  componentCount: number;
  requiredQuantity: number;
  issuedQuantity: number;
  createdAt: string;
  manufacturingOrder: {
    id: string;
    manufacturingOrderCode: string;
    status: string;
  } | null;
  lines: FrameJobOrderLine[];
};

type FrameJobOrderDetailResponse = {
  data: FrameJobOrderDetail;
};

type PageProps = {
  params: Promise<{ id: string }>;
};

const detailQueryKey = (id: string) => ["frame-job-order", id];
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

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
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

const formatMoney = (value: number) =>
  new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const labelize = (value: string) =>
  value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getStatusBadge = (status: string) => {
  if (status === "completed") return <Badge className="bg-green-600">Completed</Badge>;
  if (status === "pending") return <Badge variant="outline">Pending</Badge>;
  if (status === "queued") return <Badge className="bg-blue-600">Queued</Badge>;
  if (status === "in_progress") return <Badge variant="secondary">In progress</Badge>;
  if (status === "on_hold") return <Badge variant="destructive">On hold</Badge>;
  if (status === "cancelled") return <Badge variant="destructive">Cancelled</Badge>;
  return <Badge variant="outline">{labelize(status)}</Badge>;
};

const getComponentBadge = (type: string) => {
  if (type === "molding") return <Badge variant="secondary">Molding</Badge>;
  if (type === "accessory") return <Badge variant="outline">Accessory</Badge>;
  return <Badge variant="outline">Material</Badge>;
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
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
      </div>
      <Skeleton className="h-10 w-36" />
    </div>
    <div className="grid gap-4 md:grid-cols-4">
      {[1, 2, 3, 4].map((item) => (
        <Card key={item}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-28" />
          </CardContent>
        </Card>
      ))}
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

  const { data, isLoading, error } = useQuery({
    queryKey: detailQueryKey(id),
    queryFn: () => fetchFrameJobOrder(id),
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

  const order = data?.data;
  const canPushToProduction =
    order &&
    !order.manufacturingOrder &&
    order.status === "pending";

  const handlePushToProduction = async () => {
    if (!order) return;

    try {
      const result = await pushToProductionMutation.mutateAsync(order.id);
      toast.success(`${result.manufacturingOrder.manufacturingOrderCode} sent to production`);
    } catch (mutationError) {
      toast.error(
        mutationError instanceof Error
          ? mutationError.message
          : "Failed to push job order to production"
      );
    }
  };

  if (isLoading && !order) return <LoadingShell />;

  if (error || !order) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/sales/frame-job-orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to job orders
          </Link>
        </Button>
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

  const issuedPercent =
    order.requiredQuantity > 0
      ? Math.min((order.issuedQuantity / order.requiredQuantity) * 100, 100)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/sales/frame-job-orders" aria-label="Back to job orders">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{order.jobOrderCode}</h1>
              {getStatusBadge(order.status)}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Job order for {order.customerName || "unnamed customer"}
            </p>
          </div>
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

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard title="Customer" icon={UserRound} value={order.customerName || "-"} />
        <MetricCard title="Order date" icon={CalendarDays} value={formatDate(order.orderDate)} />
        <MetricCard title="Components" icon={ClipboardList} value={String(order.componentCount)} />
        <MetricCard
          title="Issued quantity"
          icon={PackageCheck}
          value={`${formatNumber(order.issuedQuantity)} / ${formatNumber(order.requiredQuantity)}`}
          caption={`${formatNumber(issuedPercent)}% issued`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Linked Documents</CardTitle>
          <CardDescription>Source quotation, draft invoice, and completion timing.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <DetailValue label="Quotation" value={order.quotationCode || "-"} />
          <DetailValue label="Sales order" value={order.salesOrderCode || "-"} />
          <DetailValue label="Draft invoice" value={order.draftInvoiceCode || "-"} />
          <DetailValue label="Completed at" value={formatDateTime(order.completedAt)} />
        </CardContent>
      </Card>

      {order.notes ? (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{order.notes}</p>
          </CardContent>
        </Card>
      ) : null}

      {order.lines.map((line, index) => (
        <Card key={line.quotationItemId || index}>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>{line.itemName || line.description || "Frame line"}</CardTitle>
                <CardDescription>
                  {[
                    line.itemCode,
                    line.quantity ? `${formatNumber(line.quantity)} ${line.uomCode}` : "",
                  ]
                    .filter(Boolean)
                    .join(" • ")}
                </CardDescription>
              </div>
              <Badge variant="outline">Line total {formatMoney(line.lineTotal)}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {line.configuration ? (
              <div className="grid gap-4 rounded-md border p-4 md:grid-cols-4">
                <DetailValue
                  label="Frame size"
                  value={
                    <span className="inline-flex items-center gap-2">
                      <Ruler className="h-4 w-4 text-muted-foreground" />
                      {formatNumber(line.configuration.width)} x{" "}
                      {formatNumber(line.configuration.height)}
                    </span>
                  }
                />
                <DetailValue
                  label="Allowance"
                  value={formatNumber(line.configuration.fixedAllowance)}
                />
                <DetailValue
                  label="Molding"
                  value={
                    [line.configuration.moldingItemCode, line.configuration.moldingItemName]
                      .filter(Boolean)
                      .join(" - ") || "-"
                  }
                />
                <DetailValue
                  label="Sticks required"
                  value={
                    line.configuration.moldingSticksRequired
                      ? `${formatNumber(line.configuration.moldingSticksRequired)} @ ${formatNumber(
                          line.configuration.moldingStickLength
                        )}`
                      : "-"
                  }
                />
                <DetailValue
                  label="Service fee"
                  value={`${labelize(line.configuration.serviceFeeMode)} / ${formatMoney(
                    line.configuration.totalServiceFee
                  )}`}
                />
                <DetailValue label="Service type" value={line.configuration.serviceType || "-"} />
                <DetailValue
                  label="Fee amount"
                  value={formatMoney(line.configuration.serviceFeeAmount)}
                />
                <DetailValue
                  label="Invoice display"
                  value={labelize(line.configuration.invoiceDisplayMode)}
                />
              </div>
            ) : null}

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Component</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Qty per frame</TableHead>
                    <TableHead className="text-right">Required</TableHead>
                    <TableHead className="text-right">Issued</TableHead>
                    <TableHead>Reservation</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {line.components.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                        No materials found for this frame line.
                      </TableCell>
                    </TableRow>
                  ) : (
                    line.components.map((component) => (
                      <TableRow key={component.id}>
                        <TableCell>{getComponentBadge(component.componentType)}</TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {[component.itemCode, component.itemName].filter(Boolean).join(" - ") ||
                              "-"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {component.description || labelize(component.source)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {component.qtyPerFrame ? formatNumber(component.qtyPerFrame) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(component.requiredQuantity)} {component.uomCode}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(component.issuedQuantity)} {component.uomCode}
                        </TableCell>
                        <TableCell>
                          {component.reservation ? (
                            <div>
                              <div className="font-medium">
                                {component.reservation.warehouseName ||
                                  component.reservation.warehouseCode ||
                                  "-"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {labelize(component.reservation.status)} • reserved{" "}
                                {formatNumber(component.reservation.quantity)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMoney(component.totalAmount)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}

      {order.lines.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No frame lines found for this job order.
          </CardContent>
        </Card>
      ) : null}

    </div>
  );
}
