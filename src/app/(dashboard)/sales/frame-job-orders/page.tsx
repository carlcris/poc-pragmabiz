"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
type FrameJobOrder = {
  id: string;
  jobOrderCode: string;
  salesOrderCode: string;
  quotationCode: string;
  draftInvoiceCode: string;
  customerName: string;
  status: string;
  orderDate: string;
  completedAt: string | null;
  componentCount: number;
  requiredQuantity: number;
  issuedQuantity: number;
  manufacturingOrder: {
    id: string;
    manufacturingOrderCode: string;
    status: string;
  } | null;
};

type FrameJobOrdersResponse = {
  data: FrameJobOrder[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const FRAME_JOB_ORDERS_QUERY_KEY = "frame-job-orders";

const fetchFrameJobOrders = async (
  status: string,
  page: number
): Promise<FrameJobOrdersResponse> => {
  const params = new URLSearchParams({
    page: String(page),
    limit: "10",
  });
  if (status !== "all") params.set("status", status);

  const response = await fetch(`/api/frame-job-orders?${params.toString()}`, {
    credentials: "include",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || "Failed to load job orders");
  }

  return response.json() as Promise<FrameJobOrdersResponse>;
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

const getStatusBadge = (status: string) => {
  if (status === "completed") return <Badge className="bg-green-600">Completed</Badge>;
  if (status === "pending") return <Badge variant="outline">Pending</Badge>;
  if (status === "queued") return <Badge className="bg-blue-600">Queued</Badge>;
  if (status === "in_progress") return <Badge variant="secondary">In progress</Badge>;
  if (status === "on_hold") return <Badge variant="destructive">On hold</Badge>;
  if (status === "cancelled") return <Badge variant="destructive">Cancelled</Badge>;
  return <Badge variant="outline">{status}</Badge>;
};

export default function FrameJobOrdersPage() {
  const t = useTranslations("frameJobOrdersPage");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: [FRAME_JOB_ORDERS_QUERY_KEY, status, page],
    queryFn: () => fetchFrameJobOrders(status, page),
    placeholderData: keepPreviousData,
  });

  const pushToProductionMutation = useMutation({
    mutationFn: pushFrameJobOrderToProduction,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [FRAME_JOB_ORDERS_QUERY_KEY] }),
        queryClient.invalidateQueries({ queryKey: ["manufacturing-orders"] }),
      ]);
    },
  });

  const orders = data?.data || [];

  const handlePushToProduction = async (order: FrameJobOrder) => {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Select
          value={status}
          onValueChange={(nextStatus) => {
            setStatus(nextStatus);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="on_hold">On hold</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Sales order</TableHead>
              <TableHead>Quotation</TableHead>
              <TableHead>Draft invoice</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Components</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Loading job orders...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-destructive">
                  {error instanceof Error ? error.message : "Failed to load job orders"}
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  No job orders found.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow
                  key={order.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/sales/frame-job-orders/${order.id}`)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-muted-foreground" />
                      {order.jobOrderCode}
                    </div>
                  </TableCell>
                  <TableCell>{order.customerName}</TableCell>
                  <TableCell>{order.salesOrderCode || "-"}</TableCell>
                  <TableCell>{order.quotationCode}</TableCell>
                  <TableCell>{order.draftInvoiceCode}</TableCell>
                  <TableCell>{getStatusBadge(order.status)}</TableCell>
                  <TableCell className="text-right">
                    <div>{order.componentCount}</div>
                    <div className="text-xs text-muted-foreground">
                      {order.issuedQuantity.toFixed(2)} / {order.requiredQuantity.toFixed(2)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div
                      className="flex justify-end gap-2"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {order.status === "pending" && !order.manufacturingOrder ? (
                        <Button
                          size="sm"
                          onClick={() => void handlePushToProduction(order)}
                          disabled={pushToProductionMutation.isPending}
                        >
                          {pushToProductionMutation.isPending ? "Pushing..." : "Push to Production"}
                        </Button>
                      ) : null}
                      {order.manufacturingOrder ? (
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/manufacturing/floor?focus=${order.manufacturingOrder.id}`}>
                            Open Production
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                    {order.status === "pending" ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Push this job order to production to begin work.
                      </p>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>{data ? `${data.pagination.total} job orders` : "0 job orders"}</div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!data || page >= data.pagination.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
