"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  Clock,
  Maximize2,
  Minimize2,
  Package,
  PauseCircle,
  PlayCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

type ManufacturingOrder = {
  id: string;
  manufacturingOrderCode: string;
  salesOrderCode: string;
  customerName: string;
  itemSummary: string;
  status: string;
  priority: string;
  dueDate: string | null;
  createdAt: string;
  startedAt: string | null;
  currentWorkstationId: string | null;
  currentWorkstationName: string;
  activeOperation: { name: string; status: string; type: string } | null;
  materialCount: number;
  requiredQuantity: number;
  issuedQuantity: number;
  materials: Array<{
    description: string;
    requiredQuantity: number;
    issuedQuantity: number;
    uomCode: string;
    status: string;
  }>;
  hasMaterialShortage: boolean;
};

type ManufacturingOrdersResponse = {
  data: ManufacturingOrder[];
};

type Workstation = {
  id: string;
  code: string;
  name: string;
};

type WorkstationsResponse = {
  data: Workstation[];
};

type ManufacturingAction = "start" | "complete_step" | "hold" | "resume" | "complete";

const fetchFloorOrders = async (station: string): Promise<ManufacturingOrdersResponse> => {
  const params = new URLSearchParams({ floor: "true", page: "1", limit: "50" });
  if (station !== "all") params.set("workstationId", station);

  const response = await fetch(`/api/manufacturing/orders?${params.toString()}`, {
    credentials: "include",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || "Failed to load production");
  }

  return response.json() as Promise<ManufacturingOrdersResponse>;
};

const fetchWorkstations = async (): Promise<WorkstationsResponse> => {
  const response = await fetch("/api/manufacturing/workstations", {
    credentials: "include",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || "Failed to load workstations");
  }

  return response.json() as Promise<WorkstationsResponse>;
};

const applyFloorAction = async ({ id, action }: { id: string; action: ManufacturingAction }) => {
  const response = await fetch(`/api/manufacturing/orders/${id}/action`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || "Failed to update order");
  }

  return response.json() as Promise<{ success: boolean }>;
};

const labelize = (value: string) =>
  value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatDue = (value: string | null) => {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
};

const formatElapsed = (milliseconds: number) => {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const getQueueWaitLabel = (order: ManufacturingOrder) => {
  const createdAt = new Date(order.createdAt).getTime();
  const endAt = order.startedAt ? new Date(order.startedAt).getTime() : Date.now();

  if (Number.isNaN(createdAt) || Number.isNaN(endAt) || endAt < createdAt) {
    return null;
  }

  const elapsed = formatElapsed(endAt - createdAt);
  return order.startedAt ? `Waited ${elapsed}` : `In queue ${elapsed}`;
};

const isOverdue = (value: string | null) => {
  if (!value) return false;
  const dueDate = new Date(value);
  dueDate.setHours(23, 59, 59, 999);
  return dueDate < new Date();
};

const getPrimaryAction = (
  order: ManufacturingOrder
): { label: string; action: ManufacturingAction } => {
  if (order.status === "on_hold") return { label: "Resume", action: "resume" };
  if (order.status === "ready" || order.status === "queued")
    return { label: "Start", action: "start" };
  if (order.activeOperation?.type === "ready")
    return { label: "Complete Job", action: "complete_step" };
  if (order.status === "in_progress" || order.status === "quality_check") {
    return { label: "Complete Step", action: "complete_step" };
  }
  return { label: "Start", action: "start" };
};

const materialStatusLabel = (status: string) => {
  if (status === "issued") return "Ready";
  if (status === "short") return "Short";
  if (status === "reserved") return "Reserved";
  return labelize(status);
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "in_progress":
      return "border-blue-500 bg-blue-50/50";
    case "ready":
    case "queued":
      return "border-green-500 bg-green-50/50";
    case "on_hold":
      return "border-yellow-500 bg-yellow-50/50";
    case "quality_check":
      return "border-purple-500 bg-purple-50/50";
    case "completed":
      return "border-gray-400 bg-gray-50/50";
    default:
      return "";
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority.toLowerCase()) {
    case "high":
    case "urgent":
      return "destructive";
    case "medium":
      return "secondary";
    default:
      return "outline";
  }
};

const calculateMaterialProgress = (order: ManufacturingOrder) => {
  if (order.requiredQuantity === 0) return 100;
  return Math.min((order.issuedQuantity / order.requiredQuantity) * 100, 100);
};

const canHoldOrder = (order: ManufacturingOrder) =>
  order.status === "in_progress" || order.status === "quality_check";

export default function ManufacturingFloorPage() {
  const t = useTranslations("manufacturingFloorPage");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const focusedOrderId = searchParams.get("focus");
  const isFullscreenMode = searchParams.get("fullscreen") === "1";
  const [station, setStation] = useState("all");
  const [materialsOrder, setMaterialsOrder] = useState<ManufacturingOrder | null>(null);
  const queryClient = useQueryClient();

  const { data: workstationsData } = useQuery({
    queryKey: ["manufacturing-workstations"],
    queryFn: fetchWorkstations,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["manufacturing-orders", "floor", station],
    queryFn: () => fetchFloorOrders(station),
    refetchInterval: 30_000,
  });

  const actionMutation = useMutation({
    mutationFn: applyFloorAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manufacturing-orders"] });
    },
  });

  const orders = useMemo(() => {
    const nextOrders = data?.data || [];
    if (!focusedOrderId) return nextOrders;
    return [...nextOrders].sort((a, b) => {
      if (a.id === focusedOrderId) return -1;
      if (b.id === focusedOrderId) return 1;
      return 0;
    });
  }, [data?.data, focusedOrderId]);

  const runAction = async (id: string, action: ManufacturingAction) => {
    try {
      await actionMutation.mutateAsync({ id, action });
      toast.success("Order updated");
    } catch (mutationError) {
      toast.error(
        mutationError instanceof Error ? mutationError.message : "Failed to update production order"
      );
    }
  };

  const handleFullscreenToggle = async () => {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (isFullscreenMode) {
      nextParams.delete("fullscreen");
      router.replace(nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname, {
        scroll: false,
      });

      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => undefined);
      }

      return;
    }

    nextParams.set("fullscreen", "1");
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
    await document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <div
      className={[
        "space-y-5",
        isFullscreenMode ? "min-h-screen bg-background p-6 md:p-8" : "",
      ].join(" ")}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant={isFullscreenMode ? "default" : "outline"}
            className="h-12 text-base"
            onClick={handleFullscreenToggle}
          >
            {isFullscreenMode ? (
              <Minimize2 className="mr-2 h-4 w-4" />
            ) : (
              <Maximize2 className="mr-2 h-4 w-4" />
            )}
            {isFullscreenMode ? "Exit Full Screen" : "Full Screen"}
          </Button>
          <Select value={station} onValueChange={setStation}>
            <SelectTrigger className="h-12 w-full text-base sm:w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stations</SelectItem>
              {(workstationsData?.data || []).map((workstation) => (
                <SelectItem key={workstation.id} value={workstation.id}>
                  {workstation.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div key={item} className="min-h-[360px] rounded-lg border bg-card p-6 shadow-sm">
              <div className="mb-6 h-7 w-40 animate-pulse rounded bg-muted" />
              <div className="mb-3 h-5 w-full animate-pulse rounded bg-muted" />
              <div className="mb-4 h-5 w-2/3 animate-pulse rounded bg-muted" />
              <div className="mb-3 h-16 w-full animate-pulse rounded bg-muted" />
              <div className="h-12 w-full animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center text-red-700">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10" />
          <p className="font-semibold">{error instanceof Error ? error.message : "Failed to load production"}</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <ChefHat className="mx-auto mb-4 h-14 w-14 text-muted-foreground/60" />
          <p className="text-lg font-semibold text-foreground">No jobs waiting at this station</p>
          <p className="text-sm text-muted-foreground">New production orders will appear here automatically</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orders.map((order) => {
            const primaryAction = getPrimaryAction(order);
            const overdue = isOverdue(order.dueDate);
            const focused = order.id === focusedOrderId;
            const statusColor = getStatusColor(order.status);
            const queueWaitLabel = getQueueWaitLabel(order);

            return (
              <div
                key={order.id}
                className={[
                  "group flex min-h-[380px] flex-col justify-between rounded-lg border-2 bg-card p-6 shadow-sm transition-all hover:shadow-md",
                  focused ? "border-green-600 bg-green-50/30 ring-2 ring-green-600/20" : statusColor,
                  overdue && !focused ? "border-red-500 bg-red-50/30" : "",
                ].join(" ")}
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-2xl font-bold tracking-tight">{order.manufacturingOrderCode}</div>
                        {order.priority && (
                          <Badge variant={getPriorityColor(order.priority)} className="text-xs">
                            {labelize(order.priority)}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground truncate">
                        {order.salesOrderCode || "No sales order"}
                      </div>
                      <div className="text-sm font-medium text-foreground">
                        {order.customerName || "No customer"}
                      </div>
                    </div>
                    <Badge
                      variant={overdue ? "destructive" : "outline"}
                      className="shrink-0 text-sm font-semibold"
                    >
                      {formatDue(order.dueDate)}
                    </Badge>
                  </div>

                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-base font-semibold text-foreground">
                          {order.itemSummary}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="font-medium">
                            {order.currentWorkstationName || "No station"}
                          </span>
                          <span>•</span>
                          <span>{order.activeOperation?.name || "No active step"}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Status
                        </div>
                        <div className="mt-1 text-lg font-bold text-foreground">
                          {labelize(order.status)}
                        </div>
                        {queueWaitLabel ? (
                          <div className="mt-1 text-xs font-medium text-muted-foreground">
                            {queueWaitLabel}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {order.hasMaterialShortage ? (
                    <div className="flex items-center gap-2 rounded-lg border-2 border-red-400 bg-red-50 p-3 text-sm font-semibold text-red-700">
                      <AlertTriangle className="h-5 w-5 shrink-0" />
                      <span>Material shortage detected</span>
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      className="h-14 text-base font-semibold shadow-sm"
                      variant={primaryAction.action === "start" ? "default" : "default"}
                      onClick={() => runAction(order.id, primaryAction.action)}
                      disabled={actionMutation.isPending}
                    >
                      {primaryAction.action === "start" ? (
                        <PlayCircle className="mr-2 h-5 w-5" />
                      ) : null}
                      {primaryAction.action === "complete_step" ? (
                        <CheckCircle2 className="mr-2 h-5 w-5" />
                      ) : null}
                      {primaryAction.action === "resume" ? (
                        <PlayCircle className="mr-2 h-5 w-5" />
                      ) : null}
                      {primaryAction.label}
                    </Button>
                    {order.status === "on_hold" ? (
                      <Button
                        variant="outline"
                        className="h-14 border-2 text-base font-semibold shadow-sm hover:bg-green-50"
                        onClick={() => runAction(order.id, "complete")}
                        disabled={actionMutation.isPending}
                      >
                        <CheckCircle2 className="mr-2 h-5 w-5" />
                        Complete
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="h-14 border-2 text-base font-semibold shadow-sm hover:bg-yellow-50"
                        onClick={() => runAction(order.id, "hold")}
                        disabled={actionMutation.isPending || !canHoldOrder(order)}
                      >
                        <PauseCircle className="mr-2 h-5 w-5" />
                        Hold
                      </Button>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    className="h-12 w-full border-2 text-base font-medium shadow-sm hover:bg-blue-50"
                    onClick={() => setMaterialsOrder(order)}
                  >
                    <ClipboardList className="mr-2 h-5 w-5" />
                    View Materials ({order.materialCount})
                  </Button>

                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    Auto-refresh: 30s
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={Boolean(materialsOrder)}
        onOpenChange={(open) => {
          if (!open) setMaterialsOrder(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {materialsOrder?.manufacturingOrderCode || "Materials"}
            </DialogTitle>
            <DialogDescription className="text-base">
              {materialsOrder?.itemSummary || "Material requirements for this production order"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
            {materialsOrder?.materials.length ? (
              <>
                <div className="sticky top-0 z-10 bg-background pb-2">
                  <div className="grid grid-cols-12 gap-4 rounded-lg bg-muted/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <div className="col-span-5">Material</div>
                    <div className="col-span-3 text-center">Quantity</div>
                    <div className="col-span-2 text-center">Progress</div>
                    <div className="col-span-2 text-right">Status</div>
                  </div>
                </div>

                {materialsOrder.materials.map((material, index) => {
                  const materialProgress = material.requiredQuantity > 0
                    ? Math.min((material.issuedQuantity / material.requiredQuantity) * 100, 100)
                    : 100;
                  const isShort = material.status === "short";
                  const isReady = material.status === "issued";

                  return (
                    <div
                      key={`${materialsOrder.id}-${material.description}-${index}`}
                      className={[
                        "grid grid-cols-12 gap-4 items-center rounded-lg border-2 p-4 transition-colors",
                        isShort ? "border-red-200 bg-red-50/50" : "border-border bg-background hover:bg-muted/30",
                      ].join(" ")}
                    >
                      <div className="col-span-5 min-w-0">
                        <div className="font-semibold text-foreground truncate">{material.description}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {material.uomCode || "units"}
                        </div>
                      </div>

                      <div className="col-span-3 text-center">
                        <div className="text-lg font-bold text-foreground">
                          {material.issuedQuantity.toFixed(0)}
                          <span className="text-sm font-normal text-muted-foreground">
                            {" "}/ {material.requiredQuantity.toFixed(0)}
                          </span>
                        </div>
                      </div>

                      <div className="col-span-2">
                        <div className="space-y-1">
                          <Progress
                            value={materialProgress}
                            className={`h-2 ${isShort ? "[&>div]:bg-red-500" : isReady ? "[&>div]:bg-green-500" : "[&>div]:bg-blue-500"}`}
                          />
                          <div className="text-center text-xs font-semibold text-muted-foreground">
                            {materialProgress.toFixed(0)}%
                          </div>
                        </div>
                      </div>

                      <div className="col-span-2 flex justify-end">
                        <Badge
                          variant={isShort ? "destructive" : isReady ? "default" : "outline"}
                          className="font-semibold"
                        >
                          {isShort && <AlertTriangle className="mr-1 h-3 w-3" />}
                          {isReady && <CheckCircle2 className="mr-1 h-3 w-3" />}
                          {materialStatusLabel(material.status)}
                        </Badge>
                      </div>
                    </div>
                  );
                })}

                <div className="sticky bottom-0 mt-4 rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-blue-900">Overall Material Status</div>
                      <div className="text-xs text-blue-700">
                        {materialsOrder.materialCount} material{materialsOrder.materialCount !== 1 ? "s" : ""} required
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-900">
                        {calculateMaterialProgress(materialsOrder).toFixed(0)}%
                      </div>
                      <div className="text-xs font-medium text-blue-700">Complete</div>
                    </div>
                  </div>
                  <Progress
                    value={calculateMaterialProgress(materialsOrder)}
                    className="mt-3 h-3 [&>div]:bg-blue-600"
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
                <Package className="mb-3 h-12 w-12 text-muted-foreground/60" />
                <p className="font-semibold text-foreground">No materials listed</p>
                <p className="text-sm text-muted-foreground">
                  This production order has no material requirements
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
