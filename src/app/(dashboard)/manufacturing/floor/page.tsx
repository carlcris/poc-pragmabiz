"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { isManufacturingStartBlocked } from "@/lib/manufacturing/start-eligibility";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  Clock,
  FileText,
  Maximize2,
  Minimize2,
  PauseCircle,
  PlayCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ProductionJobOrderDialog,
  type ProductionJobOrderPreview,
} from "@/components/manufacturing/ProductionJobOrderDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ManufacturingOrder = {
  id: string;
  manufacturingOrderCode: string;
  frameJobOrderId: string | null;
  frameJobOrderCode: string;
  customerName: string;
  status: string;
  priority: string;
  dueDate: string | null;
  createdAt: string;
  startedAt: string | null;
  currentWorkstationName: string;
  activeOperation: { name: string; status: string; type: string } | null;
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
    const body = (await response.json().catch(() => null)) as {
      code?: string;
      error?: string;
    } | null;
    throw new Error(body?.error || "Failed to update order", {
      cause: { code: body?.code },
    });
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

const canHoldOrder = (order: ManufacturingOrder) =>
  order.status === "in_progress" || order.status === "quality_check";

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

/**
 * The one workflow action offered beside the primary, or null.
 *
 * The primary button carries the job forward — Start, then Complete Step, and
 * the order closes itself once the last operation is done. This slot carries
 * the exception: pause a running job, or close a held one early.
 *
 * `complete` finishes EVERY remaining operation at once, so it is offered only
 * from `on_hold`, where the operator has already stopped to make a decision.
 * Beside a running job it would let one mis-tap skip the rest of production.
 */
const getSecondaryAction = (
  order: ManufacturingOrder
): { label: string; action: ManufacturingAction } | null => {
  if (order.status === "on_hold") return { label: "Complete", action: "complete" };
  if (canHoldOrder(order)) return { label: "Hold", action: "hold" };
  return null;
};

/**
 * Status as a filled chip rather than a card tint.
 *
 * A wall monitor is read from several metres away, where a 50%-opacity card
 * background is indistinguishable from white. A saturated chip with its own
 * dot survives that distance.
 */
const getStatusChipClass = (status: string) => {
  switch (status) {
    case "in_progress":
      return "border-blue-300 bg-blue-100 text-blue-800";
    case "ready":
    case "queued":
      return "border-green-300 bg-green-100 text-green-800";
    case "on_hold":
      return "border-amber-300 bg-amber-100 text-amber-900";
    case "quality_check":
      return "border-purple-300 bg-purple-100 text-purple-800";
    case "completed":
      return "border-gray-300 bg-gray-100 text-gray-700";
    default:
      return "border-gray-300 bg-gray-100 text-gray-700";
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

export default function ManufacturingFloorPage() {
  const t = useTranslations("manufacturingFloorPage");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const focusedOrderId = searchParams.get("focus");
  const isFullscreenMode = searchParams.get("fullscreen") === "1";
  const [station, setStation] = useState("all");
  const [previewJobOrder, setPreviewJobOrder] = useState<ProductionJobOrderPreview | null>(null);
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
      toast.success(t("updateSuccess"));
    } catch (mutationError) {
      toast.error(mutationError instanceof Error ? mutationError.message : t("updateFailed"));
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
          <div className="flex h-12 items-center justify-center gap-2 px-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Auto-refresh: 30s
          </div>
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
            <div key={item} className="min-h-72 rounded-lg border bg-card p-6 shadow-sm">
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
          <p className="font-semibold">
            {error instanceof Error ? error.message : "Failed to load production"}
          </p>
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <ChefHat className="mx-auto mb-4 h-14 w-14 text-muted-foreground/60" />
          <p className="text-lg font-semibold text-foreground">No jobs waiting at this station</p>
          <p className="text-sm text-muted-foreground">
            New production orders will appear here automatically
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orders.map((order) => {
            const primaryAction = getPrimaryAction(order);
            const secondaryAction = getSecondaryAction(order);
            const overdue = isOverdue(order.dueDate);
            const focused = order.id === focusedOrderId;
            const queueWaitLabel = getQueueWaitLabel(order);
            const frameJobOrderId = order.frameJobOrderId;
            const blocked = isManufacturingStartBlocked(order);

            return (
              <div
                key={order.id}
                className={[
                  "flex min-h-72 flex-col justify-between rounded-xl border bg-card shadow-sm",
                  focused ? "border-green-600 ring-2 ring-green-600/25" : "",
                  blocked && !focused ? "border-red-300" : "",
                  !focused && !blocked ? "border-border" : "",
                ].join(" ")}
              >
                {/* A blocked job announces itself before anything else, and loses
                    its Start button below — a shortage must be resolved, not
                    tapped past. */}
                {blocked ? (
                  <div className="flex items-center gap-2 rounded-t-xl bg-red-600 px-5 py-3 text-sm font-bold text-white">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <span>{t("materialShortageBlocksStart")}</span>
                  </div>
                ) : null}

                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={[
                        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-bold",
                        getStatusChipClass(order.status),
                      ].join(" ")}
                    >
                      <span className="h-2 w-2 rounded-full bg-current" />
                      {labelize(order.status)}
                    </span>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <Badge
                        variant={overdue ? "destructive" : "outline"}
                        className="text-sm font-semibold"
                      >
                        {formatDue(order.dueDate)}
                      </Badge>
                      {order.priority && order.priority.toLowerCase() !== "normal" ? (
                        <Badge variant={getPriorityColor(order.priority)} className="text-xs">
                          {labelize(order.priority)}
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  {/* The station and its step are what the operator acts on, so
                      they outrank the job number here. */}
                  <div className="mt-4 min-w-0">
                    <div className="truncate text-xl font-bold tracking-tight">
                      {order.currentWorkstationName || "No station"}
                    </div>
                    <div className="mt-0.5 truncate text-base text-muted-foreground">
                      {order.activeOperation?.name || "No active step"}
                    </div>
                  </div>

                  <div className="mt-4 space-y-1 border-t pt-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-base font-bold tabular-nums">
                        {order.frameJobOrderCode || order.manufacturingOrderCode}
                      </span>
                      <span className="truncate text-sm text-muted-foreground">
                        {order.customerName || "No customer"}
                      </span>
                    </div>
                    {queueWaitLabel ? (
                      <div className="text-sm text-muted-foreground">{queueWaitLabel}</div>
                    ) : null}
                  </div>

                  {order.hasMaterialShortage && !blocked ? (
                    <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-700">
                      <AlertTriangle className="h-5 w-5 shrink-0" />
                      <span>{order.frameJobOrderId ? t("residualMaterialsNotice") : t("materialShortage")}</span>
                    </div>
                  ) : null}

                  {/* The primary action owns a full-width row of its own: on a
                      touch monitor a mis-tap between adjacent large buttons is
                      the failure with a real cost on the floor. */}
                  <div className="mt-auto space-y-2.5 pt-5">
                    {blocked ? null : (
                      <Button
                        className="h-[76px] w-full text-xl font-bold shadow-sm"
                        onClick={() => runAction(order.id, primaryAction.action)}
                        disabled={actionMutation.isPending}
                      >
                        {primaryAction.action === "complete_step" ? (
                          <CheckCircle2 className="mr-2.5 h-6 w-6" />
                        ) : (
                          <PlayCircle className="mr-2.5 h-6 w-6" />
                        )}
                        {primaryAction.label}
                      </Button>
                    )}
                    <div className="grid grid-cols-2 gap-2.5">
                      {frameJobOrderId ? (
                        <Button
                          variant="outline"
                          className={[
                            "h-14 text-base font-semibold",
                            secondaryAction ? "" : "col-span-2",
                          ].join(" ")}
                          onClick={() =>
                            setPreviewJobOrder({
                              id: frameJobOrderId,
                              code: order.frameJobOrderCode,
                            })
                          }
                        >
                          <FileText className="mr-2 h-5 w-5" />
                          {t("viewJobOrder")}
                        </Button>
                      ) : null}
                      {secondaryAction ? (
                        <Button
                          variant="outline"
                          className={[
                            "h-14 text-base font-semibold",
                            frameJobOrderId ? "" : "col-span-2",
                          ].join(" ")}
                          onClick={() => runAction(order.id, secondaryAction.action)}
                          disabled={actionMutation.isPending}
                        >
                          {secondaryAction.action === "hold" ? (
                            <PauseCircle className="mr-2 h-5 w-5" />
                          ) : (
                            <CheckCircle2 className="mr-2 h-5 w-5" />
                          )}
                          {secondaryAction.label}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ProductionJobOrderDialog
        jobOrder={previewJobOrder}
        onClose={() => setPreviewJobOrder(null)}
      />
    </div>
  );
}
