"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Loader2, PackageCheck, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { usePostPutawayTask, usePutawayTasks } from "@/hooks/usePutawayTasks";
import { putawayTasksApi } from "@/lib/api/putaway-tasks";
import type { BarcodeData } from "@/lib/barcode";
import { cn } from "@/lib/utils";
import type {
  PostPutawayTaskResponse,
  PutawayTask,
  PutawayTaskLabel,
  PutawayTaskStatus,
} from "@/types/putaway-task";
import type { WarehouseLocation } from "@/types/inventory-location";

const formatQty = (value: number) =>
  new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);

const sourceLabel = (sourceType: string) =>
  sourceType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const putawayStatusClassName: Record<PutawayTaskStatus, string> = {
  pending: "text-amber-700",
  partial: "text-blue-700",
  completed: "text-emerald-700",
  cancelled: "text-muted-foreground",
};

const createPutawayLabelId = (taskId: string, labelNumber: number) => {
  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${labelNumber}`;

  return `putaway-${taskId}-${randomId}`;
};

const allocateLabelCounts = (quantities: number[], totalLabelCount: number) => {
  if (quantities.length === 0) return [];
  if (quantities.length === 1) return [totalLabelCount];

  const totalQuantity = quantities.reduce((sum, quantity) => sum + quantity, 0);
  const baseCounts = quantities.map(() => 1);
  let remainingLabels = totalLabelCount - quantities.length;

  if (remainingLabels <= 0 || totalQuantity <= 0) return baseCounts;

  const weighted = quantities.map((quantity, index) => {
    const exact = (quantity / totalQuantity) * remainingLabels;
    return {
      index,
      whole: Math.floor(exact),
      remainder: exact - Math.floor(exact),
    };
  });

  for (const item of weighted) {
    baseCounts[item.index] += item.whole;
    remainingLabels -= item.whole;
  }

  weighted
    .sort((a, b) => b.remainder - a.remainder)
    .slice(0, remainingLabels)
    .forEach((item) => {
      baseCounts[item.index] += 1;
    });

  return baseCounts;
};

const buildPutawayBarcodeLabels = (
  taskId: string,
  sources: PutawayTaskLabel[],
  totalLabelCount: number
): BarcodeData[] => {
  const labelCounts = allocateLabelCounts(
    sources.map((source) => source.quantity),
    totalLabelCount
  );
  let nextBoxNumber = 1;

  return sources.flatMap((source, sourceIndex) => {
    const sourceLabelCount = labelCounts[sourceIndex] || 0;
    const qtyPerLabel = source.quantity / sourceLabelCount;

    return Array.from({ length: sourceLabelCount }, () => {
      const boxNumber = nextBoxNumber;
      nextBoxNumber += 1;

      return {
        boxId: createPutawayLabelId(taskId, boxNumber),
        itemId: source.itemId,
        batchLocationSku: source.batchLocationSku,
        batchNumber: source.batchNumber,
        grnNumber: source.referenceNumber,
        itemCode: source.itemCode,
        itemName: source.itemName,
        boxNumber,
        qtyPerBox: qtyPerLabel,
        deliveryDate: source.postedDate,
        warehouseCode: source.warehouseCode || undefined,
        locationId: source.locationId,
        locationCode: source.locationCode || undefined,
      };
    });
  });
};

export default function PutawayStationPage() {
  const t = useTranslations("putawayStationPage");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PutawayTaskStatus | "open" | "all">("open");
  const [page, setPage] = useState(1);
  const [selectedTask, setSelectedTask] = useState<PutawayTask | null>(null);
  const [locationId, setLocationId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [batchCode, setBatchCode] = useState("");
  const [shouldPrintLabels, setShouldPrintLabels] = useState(true);
  const [labelCount, setLabelCount] = useState("1");
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [isPrintingLabels, setIsPrintingLabels] = useState(false);
  const [printingTaskId, setPrintingTaskId] = useState<string | null>(null);

  const { data, isLoading, isFetching } = usePutawayTasks({
    status: statusFilter,
    search: appliedSearch || undefined,
    page,
    limit: 50,
  });
  const postPutaway = usePostPutawayTask();

  const tasks = data?.data ?? [];
  const pagination = data?.pagination;
  const putawayStatusLabel: Record<PutawayTaskStatus, string> = {
    pending: t("statusPending"),
    partial: t("statusPartial"),
    completed: t("statusCompleted"),
    cancelled: t("statusCancelled"),
  };

  useEffect(() => {
    if (!selectedTask) {
      setLocations([]);
      return;
    }
    if (selectedTask.status === "completed") {
      setLocations([]);
      return;
    }

    let cancelled = false;

    const loadLocations = async () => {
      setIsLoadingLocations(true);
      try {
        const response = await fetch(`/api/warehouses/${selectedTask.warehouseId}/locations`);
        if (!response.ok) throw new Error("Failed to load locations");
        const json = await response.json();
        if (!cancelled) {
          setLocations(json.data ?? []);
        }
      } catch {
        if (!cancelled) {
          setLocations([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingLocations(false);
        }
      }
    };

    loadLocations();

    return () => {
      cancelled = true;
    };
  }, [selectedTask]);

  useEffect(() => {
    setSelectedTask(null);
    setPage(1);
  }, [statusFilter]);

  const storableLocations = useMemo(
    () => locations.filter((location) => location.isActive && location.isStorable),
    [locations]
  );

  const selectTask = (task: PutawayTask) => {
    setSelectedTask(task);
    setLocationId(task.suggestedLocationId ?? "");
    setQuantity(String(task.status === "completed" ? task.postedQuantity : task.pendingQuantity));
    setBatchCode(task.sourceBatchCode ?? "");
    setShouldPrintLabels(true);
    setLabelCount("1");
  };

  const handleApplySearch = () => {
    setAppliedSearch(searchInput.trim());
    setPage(1);
  };

  const handlePrintCompletedLabels = async (task: PutawayTask) => {
    const parsedLabelCount = Number.parseInt(labelCount, 10);
    if (!Number.isFinite(parsedLabelCount) || parsedLabelCount <= 0) return;

    try {
      setPrintingTaskId(task.id);
      const response = await putawayTasksApi.labels(task.id);
      if (response.data.length === 0) {
        toast.error(t("noLabelsToPrint"));
        return;
      }
      if (parsedLabelCount < response.data.length) {
        toast.error(t("labelCountTooSmall", { count: response.data.length }));
        return;
      }

      const { printBarcodeLabels } = await import("@/lib/barcode");
      const labels = buildPutawayBarcodeLabels(task.id, response.data, parsedLabelCount);

      await printBarcodeLabels(labels);
      toast.success(t("reprintLabelsSuccess"));
    } catch (error) {
      console.error("Error reprinting putaway labels:", error);
      toast.error(t("reprintLabelsError"));
    } finally {
      setPrintingTaskId(null);
    }
  };

  const handlePost = async () => {
    if (!selectedTask) return;

    const parsedQuantity = Number(quantity);
    const parsedLabelCount = Number.parseInt(labelCount, 10);
    const selectedLocation = storableLocations.find((location) => location.id === locationId);

    if (
      !locationId ||
      !batchCode.trim() ||
      !Number.isFinite(parsedQuantity) ||
      !selectedLocation ||
      (shouldPrintLabels && (!Number.isFinite(parsedLabelCount) || parsedLabelCount <= 0))
    ) {
      return;
    }

    let postResult: PostPutawayTaskResponse;
    try {
      postResult = await postPutaway.mutateAsync({
        id: selectedTask.id,
        data: {
          locationId,
          quantity: parsedQuantity,
          batchCode: batchCode.trim(),
        },
      });
    } catch (error) {
      console.error("Error posting putaway:", error);
      toast.error(t("postPutawayError"));
      return;
    }

    if (shouldPrintLabels) {
      try {
        setIsPrintingLabels(true);
        const { printBarcodeLabels } = await import("@/lib/barcode");
        const qtyPerLabel = parsedQuantity / parsedLabelCount;
        const labels: BarcodeData[] = Array.from({ length: parsedLabelCount }, (_, index) => ({
          boxId: createPutawayLabelId(selectedTask.id, index + 1),
          itemId: selectedTask.itemId,
          batchLocationSku: postResult.batchLocationSku,
          batchNumber: postResult.batchCode,
          grnNumber: selectedTask.sourceReference || t("putawayLabelReference"),
          itemCode: selectedTask.itemCode || "",
          itemName: selectedTask.itemName || "",
          boxNumber: index + 1,
          qtyPerBox: qtyPerLabel,
          deliveryDate: postResult.postedDate,
          warehouseCode: selectedTask.warehouseCode || undefined,
          locationId: postResult.locationId,
          locationCode: selectedLocation.code,
        }));

        await printBarcodeLabels(labels);
        toast.success(t("printLabelsSuccess"));
      } catch (error) {
        console.error("Error printing putaway labels:", error);
        toast.error(t("printLabelsError"));
      } finally {
        setIsPrintingLabels(false);
      }
    } else {
      toast.success(t("postPutawaySuccess"));
    }

    setSelectedTask(null);
    setLocationId("");
    setQuantity("");
    setBatchCode("");
    setShouldPrintLabels(true);
    setLabelCount("1");
  };

  const quantityNumber = Number(quantity);
  const labelCountNumber = Number.parseInt(labelCount, 10);
  const canPost =
    !!selectedTask &&
    !!locationId &&
    !!batchCode.trim() &&
    Number.isFinite(quantityNumber) &&
    quantityNumber > 0 &&
    quantityNumber <= selectedTask.pendingQuantity &&
    (!shouldPrintLabels || (Number.isFinite(labelCountNumber) && labelCountNumber > 0)) &&
    !postPutaway.isPending &&
    !isPrintingLabels;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Badge variant="outline" className="w-fit">
          {t("taskCount", { count: data?.pagination.total ?? 0 })}
        </Badge>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleApplySearch();
          }}
          placeholder={t("searchPlaceholder")}
          className="sm:max-w-sm"
        />
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as PutawayTaskStatus | "open" | "all")}
        >
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder={t("statusFilter")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">{t("openTasksFilter")}</SelectItem>
            <SelectItem value="completed">{t("completedTasksFilter")}</SelectItem>
            <SelectItem value="all">{t("allTasksFilter")}</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleApplySearch}>{t("apply")}</Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("source")}</TableHead>
                <TableHead>{t("item")}</TableHead>
                <TableHead>{t("warehouse")}</TableHead>
                <TableHead className="text-right">{t("pendingQty")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="text-right">{t("action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    {t("loading")}
                  </TableCell>
                </TableRow>
              ) : tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    {t("empty")}
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((task) => {
                  const displayQuantity =
                    task.status === "completed" ? task.postedQuantity : task.pendingQuantity;
                  const isPrintingThisTask = printingTaskId === task.id;

                  return (
                    <TableRow key={task.id} data-state={selectedTask?.id === task.id && "selected"}>
                      <TableCell>
                        <div className="font-medium">{sourceLabel(task.sourceType)}</div>
                        <div className="text-sm text-muted-foreground">
                          {task.sourceReference || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{task.itemName || "-"}</div>
                        <div className="text-sm text-muted-foreground">{task.itemCode || "-"}</div>
                      </TableCell>
                      <TableCell>
                        <div>{task.warehouseName || "-"}</div>
                        <div className="text-sm text-muted-foreground">
                          {task.warehouseCode || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium">{formatQty(displayQuantity)}</span>
                        {task.uomCode ? (
                          <span className="ml-1 text-sm text-muted-foreground">{task.uomCode}</span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "text-sm font-medium",
                            putawayStatusClassName[task.status]
                          )}
                        >
                          {putawayStatusLabel[task.status]}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {task.status === "completed" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => selectTask(task)}
                            disabled={isPrintingThisTask}
                          >
                            {isPrintingThisTask ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Printer className="mr-2 h-4 w-4" />
                            )}
                            {t("select")}
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => selectTask(task)}>
                            <PackageCheck className="mr-2 h-4 w-4" />
                            {t("select")}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {isFetching && !isLoading ? (
            <div className="border-t px-4 py-2 text-sm text-muted-foreground">{t("refreshing")}</div>
          ) : null}
          {pagination ? (
            <div className="flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                {t("pagination", {
                  page: pagination.page,
                  totalPages: Math.max(1, pagination.totalPages),
                  total: pagination.total,
                })}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1 || isFetching}
                  onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                >
                  {t("previous")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages || isFetching}
                  onClick={() => setPage((currentPage) => currentPage + 1)}
                >
                  {t("next")}
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedTask?.status === "completed" ? t("reprintTitle") : t("postTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedTask?.status === "completed" ? (
              <>
                <div className="rounded-md border p-3">
                  <div className="font-medium">{selectedTask.itemName}</div>
                  <div className="text-sm text-muted-foreground">
                    {selectedTask.sourceReference || selectedTask.sourceType}
                  </div>
                  <div className="mt-2 text-sm">
                    {t("pendingQty")}:{" "}
                    <span className="font-medium">{formatQty(selectedTask.postedQuantity)}</span>
                    {selectedTask.uomCode ? (
                      <span className="ml-1 text-muted-foreground">{selectedTask.uomCode}</span>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t("labelCount")}</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={labelCount}
                    onChange={(event) => setLabelCount(event.target.value)}
                  />
                  {Number.isFinite(labelCountNumber) && labelCountNumber > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t("qtyPerLabel", {
                        count: formatQty(selectedTask.postedQuantity / labelCountNumber || 0),
                      })}
                    </p>
                  ) : null}
                </div>

                <Button
                  className="w-full"
                  disabled={
                    printingTaskId === selectedTask.id ||
                    !Number.isFinite(labelCountNumber) ||
                    labelCountNumber <= 0
                  }
                  onClick={() => handlePrintCompletedLabels(selectedTask)}
                >
                  {printingTaskId === selectedTask.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="mr-2 h-4 w-4" />
                  )}
                  {t("reprintLabels")}
                </Button>
              </>
            ) : selectedTask ? (
              <>
                <div className="rounded-md border p-3">
                  <div className="font-medium">{selectedTask.itemName}</div>
                  <div className="text-sm text-muted-foreground">
                    {selectedTask.sourceReference || selectedTask.sourceType}
                  </div>
                  <div className="mt-2 text-sm">
                    {t("pendingQty")}:{" "}
                    <span className="font-medium">{formatQty(selectedTask.pendingQuantity)}</span>
                    {selectedTask.uomCode ? (
                      <span className="ml-1 text-muted-foreground">{selectedTask.uomCode}</span>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t("location")}</Label>
                  <Select value={locationId} onValueChange={setLocationId}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={isLoadingLocations ? t("loadingLocations") : t("selectLocation")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {storableLocations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.code}
                          {location.name ? ` - ${location.name}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t("batchCode")}</Label>
                  <Input value={batchCode} onChange={(event) => setBatchCode(event.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>{t("quantity")}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    max={selectedTask.pendingQuantity}
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                  />
                </div>

                <div className="space-y-3 rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="print-putaway-labels"
                      checked={shouldPrintLabels}
                      onCheckedChange={(checked) => setShouldPrintLabels(checked === true)}
                    />
                    <Label htmlFor="print-putaway-labels" className="text-sm font-medium">
                      {t("printBoxLabels")}
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">{t("printBoxLabelsDescription")}</p>
                  {shouldPrintLabels ? (
                    <div className="space-y-2">
                      <Label>{t("labelCount")}</Label>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={labelCount}
                        onChange={(event) => setLabelCount(event.target.value)}
                      />
                      {Number.isFinite(labelCountNumber) && labelCountNumber > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {t("qtyPerLabel", {
                            count: formatQty(quantityNumber / labelCountNumber || 0),
                          })}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <Button className="w-full" disabled={!canPost} onClick={handlePost}>
                  {postPutaway.isPending || isPrintingLabels ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {shouldPrintLabels ? (
                        <Printer className="mr-2 h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}
                    </>
                  )}
                  {shouldPrintLabels ? t("postAndPrint") : t("post")}
                </Button>
              </>
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {t("selectTask")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
