"use client";

import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { useItem } from "@/hooks/useItems";
import { ITEM_LOCATIONS_QUERY_KEY } from "@/hooks/queryKeys";
import { useCanView } from "@/hooks/usePermissions";
import { useGranularCapabilities } from "@/hooks/useGranularCapabilities";
import { GRANULAR_CAPABILITIES } from "@/constants/granular-permissions";
import { RESOURCES } from "@/constants/resources";
import type { BarcodeData } from "@/lib/barcode";
import type { ItemLocation, ItemLocationBatch } from "@/types/inventory-location";
import type { WarehouseLocation } from "@/types/inventory-location";

type ItemLocationsResponse = {
  data: ItemLocation[];
};

type BatchPrintLabelResponse = {
  data: {
    batchLocationId: string;
    itemId: string;
    batchLocationSku: string;
    batchCode: string;
    receivedAt: string;
    qtyOnHand: number;
    itemCode: string;
    itemName: string;
    warehouseCode: string;
    locationId: string;
    locationCode: string;
  };
};

type LocationsTabProps = {
  itemId: string;
};

const MAX_BATCH_LABEL_COUNT = 100;

const formatQty = (value: number, locale: string) =>
  value.toLocaleString(locale, { maximumFractionDigits: 4 });

const createBatchLabelId = (batchLocationId: string, labelNumber: number) => {
  const uniquePart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${labelNumber}`;

  return `batch-${batchLocationId}-${uniquePart}`;
};

export const LocationsTab = ({ itemId }: LocationsTabProps) => {
  const t = useTranslations("itemLocationsTab");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [fromLocationId, setFromLocationId] = useState<string>("");
  const [toLocationId, setToLocationId] = useState<string>("");
  const [moveQty, setMoveQty] = useState<string>("");
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [maxStockDialogOpen, setMaxStockDialogOpen] = useState(false);
  const [selectedMaxStockLocation, setSelectedMaxStockLocation] = useState<ItemLocation | null>(
    null
  );
  const [maxStockInput, setMaxStockInput] = useState("");
  const [printingBatchLocationId, setPrintingBatchLocationId] = useState<string | null>(null);
  const [batchToPrint, setBatchToPrint] = useState<ItemLocationBatch | null>(null);
  const [batchLabelCount, setBatchLabelCount] = useState("1");
  const [batchPrintUnitId, setBatchPrintUnitId] = useState("");
  const canViewItems = useCanView(RESOURCES.ITEMS);
  const { data: granularCapabilities = {} } = useGranularCapabilities([
    GRANULAR_CAPABILITIES.ITEM_BATCH_QR_PRINT,
  ]);
  const canPrintBatchQr =
    canViewItems && granularCapabilities[GRANULAR_CAPABILITIES.ITEM_BATCH_QR_PRINT] === true;
  const { data, isLoading, error } = useQuery<ItemLocationsResponse>({
    queryKey: [ITEM_LOCATIONS_QUERY_KEY, itemId],
    queryFn: async () => apiClient.get<ItemLocationsResponse>(`/api/items/${itemId}/locations`),
  });
  const { data: itemResponse } = useItem(itemId);
  const item = itemResponse?.data;
  const batchPrintUnitOptions = useMemo(
    () =>
      (item?.unitOptions || []).filter(
        (option) => option.isActive && Number.isFinite(option.qtyPerUnit) && option.qtyPerUnit > 0
      ),
    [item?.unitOptions]
  );
  const defaultBatchPrintUnit = useMemo(
    () =>
      batchPrintUnitOptions.find((option) => option.isDefault) ||
      batchPrintUnitOptions.find((option) => option.isBase) ||
      batchPrintUnitOptions[0] ||
      null,
    [batchPrintUnitOptions]
  );
  const selectedBatchPrintUnit =
    batchPrintUnitOptions.find((option) => option.id === batchPrintUnitId) || null;

  const toggleLocation = (locationId: string) => {
    setExpandedLocations((prev) => {
      const next = new Set(prev);
      if (next.has(locationId)) {
        next.delete(locationId);
      } else {
        next.add(locationId);
      }
      return next;
    });
  };

  const locations = useMemo(() => data?.data || [], [data]);
  const warehouses = useMemo(() => {
    const map = new Map<string, { id: string; code: string; name: string }>();
    locations.forEach((loc) => {
      if (!map.has(loc.warehouseId)) {
        map.set(loc.warehouseId, {
          id: loc.warehouseId,
          code: loc.warehouseCode,
          name: loc.warehouseName,
        });
      }
    });
    return Array.from(map.values());
  }, [locations]);

  const fromLocations = useMemo(
    () => locations.filter((loc) => loc.warehouseId === selectedWarehouseId),
    [locations, selectedWarehouseId]
  );

  const { data: warehouseLocations } = useQuery<{ data: WarehouseLocation[] }>({
    queryKey: ["warehouse-locations", selectedWarehouseId],
    queryFn: () => apiClient.get(`/api/warehouses/${selectedWarehouseId}/locations`),
    enabled: !!selectedWarehouseId,
  });

  const toLocations = useMemo(
    () => (warehouseLocations?.data || []).filter((loc) => loc.isActive),
    [warehouseLocations]
  );

  const setDefaultLocation = useMutation({
    mutationFn: async (location: ItemLocation) =>
      apiClient.patch(`/api/items/${itemId}/default-location`, {
        warehouseId: location.warehouseId,
        locationId: location.locationId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ITEM_LOCATIONS_QUERY_KEY, itemId] });
      toast.success(t("defaultUpdated"));
    },
    onError: (mutationError) => {
      const message =
        mutationError instanceof Error ? mutationError.message : t("updateDefaultError");
      toast.error(message);
    },
  });

  const moveStock = useMutation({
    mutationFn: async () => {
      const quantity = Number(moveQty);
      if (!selectedWarehouseId || !fromLocationId || !toLocationId) {
        throw new Error(t("selectWarehouseAndLocations"));
      }
      if (fromLocationId === toLocationId) {
        throw new Error(t("selectDifferentLocations"));
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error(t("enterValidQuantity"));
      }

      return apiClient.post("/api/stock-transactions", {
        transactionType: "transfer",
        warehouseId: selectedWarehouseId,
        toWarehouseId: selectedWarehouseId,
        fromLocationId,
        toLocationId,
        transactionDate: new Date().toISOString().split("T")[0],
        items: [
          {
            itemId,
            quantity,
            unitCost: item?.purchasePrice ?? 0,
          },
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ITEM_LOCATIONS_QUERY_KEY, itemId] });
      toast.success(t("stockMoved"));
      setMoveDialogOpen(false);
      setSelectedWarehouseId("");
      setFromLocationId("");
      setToLocationId("");
      setMoveQty("");
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : t("moveStockError");
      toast.error(message);
    },
  });

  const updateMaxStock = useMutation({
    mutationFn: async () => {
      if (!selectedMaxStockLocation) {
        throw new Error(t("selectWarehouseForMaxStock"));
      }

      const trimmedValue = maxStockInput.trim();
      const maxQuantity = trimmedValue === "" ? null : Number(trimmedValue);
      if (maxQuantity !== null && (!Number.isFinite(maxQuantity) || maxQuantity < 0)) {
        throw new Error(t("enterValidMaxStock"));
      }

      return apiClient.patch(`/api/items/${itemId}/warehouse-settings`, {
        warehouseId: selectedMaxStockLocation.warehouseId,
        maxQuantity,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ITEM_LOCATIONS_QUERY_KEY, itemId] });
      queryClient.invalidateQueries({ queryKey: ["items", itemId] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      toast.success(t("maxStockUpdated"));
      setMaxStockDialogOpen(false);
      setSelectedMaxStockLocation(null);
      setMaxStockInput("");
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : t("maxStockError");
      toast.error(message);
    },
  });

  const openMaxStockDialog = (location: ItemLocation) => {
    setSelectedMaxStockLocation(location);
    setMaxStockInput(location.maxQuantity == null ? "" : String(location.maxQuantity));
    setMaxStockDialogOpen(true);
  };

  const openBatchPrintDialog = (batch: ItemLocationBatch) => {
    setBatchToPrint(batch);
    setBatchLabelCount("1");
    setBatchPrintUnitId(defaultBatchPrintUnit?.id || "");
  };

  const closeBatchPrintDialog = () => {
    if (printingBatchLocationId) return;
    setBatchToPrint(null);
    setBatchLabelCount("1");
    setBatchPrintUnitId("");
  };

  const parsedBatchLabelCount = Number(batchLabelCount);
  const isBatchLabelCountValid =
    Number.isInteger(parsedBatchLabelCount) &&
    parsedBatchLabelCount >= 1 &&
    parsedBatchLabelCount <= MAX_BATCH_LABEL_COUNT;

  const handlePrintBatchQr = async () => {
    if (!batchToPrint || !isBatchLabelCountValid) {
      toast.error(t("invalidBatchLabelCount", { max: MAX_BATCH_LABEL_COUNT }));
      return;
    }
    if (!selectedBatchPrintUnit) {
      toast.error(t("selectBatchPrintUnit"));
      return;
    }

    try {
      setPrintingBatchLocationId(batchToPrint.id);
      const response = await apiClient.get<BatchPrintLabelResponse>(
        `/api/item-batch-locations/${batchToPrint.id}/print-label`
      );
      const label = response.data;
      const barcodeData: BarcodeData[] = Array.from(
        { length: parsedBatchLabelCount },
        (_, index) => ({
          boxId: createBatchLabelId(label.batchLocationId, index + 1),
          itemId: label.itemId,
          batchLocationSku: label.batchLocationSku,
          batchNumber: label.batchCode,
          grnNumber: t("batchLabelReference"),
          itemCode: label.itemCode,
          itemName: label.itemName,
          boxNumber: index + 1,
          qtyPerBox: selectedBatchPrintUnit.qtyPerUnit,
          deliveryDate: label.receivedAt,
          warehouseCode: label.warehouseCode,
          locationId: label.locationId,
          locationCode: label.locationCode,
        })
      );
      const { printBarcodeLabels } = await import("@/lib/barcode");
      await printBarcodeLabels(barcodeData);
      toast.success(t("printBatchQrSuccess", { count: parsedBatchLabelCount }));
      setBatchToPrint(null);
      setBatchLabelCount("1");
      setBatchPrintUnitId("");
    } catch (printError) {
      console.error("Failed to print item batch QR label", printError);
      toast.error(t("printBatchQrError"));
    } finally {
      setPrintingBatchLocationId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </div>
          <Button onClick={() => setMoveDialogOpen(true)} disabled={locations.length === 0}>
            {t("moveStock")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-sm text-destructive">{t("loadError")}</div>
        ) : locations.length === 0 ? (
          <div className="text-sm text-muted-foreground">{t("empty")}</div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>{t("warehouse")}</TableHead>
                  <TableHead>{t("location")}</TableHead>
                  <TableHead>{t("type")}</TableHead>
                  <TableHead className="text-right">{t("onHand")}</TableHead>
                  <TableHead className="text-right">{t("reserved")}</TableHead>
                  <TableHead className="text-right">{t("available")}</TableHead>
                  <TableHead className="text-right">{t("maxStock")}</TableHead>
                  <TableHead className="text-right">{t("inTransit")}</TableHead>
                  <TableHead>{t("estArrival")}</TableHead>
                  <TableHead className="text-right">{tCommon("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((location) => {
                  const isExpanded = expandedLocations.has(location.locationId);
                  const hasBatches = (location.batches?.length || 0) > 0;

                  return (
                    <Fragment key={location.id}>
                      <TableRow>
                        <TableCell>
                          {hasBatches && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => toggleLocation(location.locationId)}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{location.warehouseCode}</div>
                          <div className="text-xs text-muted-foreground">
                            {location.warehouseName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm font-medium">
                            {location.locationCode}
                            {location.isDefault && (
                              <Badge variant="secondary" className="text-xs">
                                {t("defaultBadge")}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {location.locationName}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm capitalize">
                          {location.locationType}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatQty(location.qtyOnHand, locale)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatQty(location.qtyReserved, locale)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatQty(location.qtyAvailable, locale)}
                        </TableCell>
                        <TableCell className="text-right">
                          {location.maxQuantity == null
                            ? "--"
                            : formatQty(location.maxQuantity, locale)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatQty(location.inTransit || 0, locale)}
                        </TableCell>
                        <TableCell>
                          {location.estimatedArrivalDate
                            ? new Date(location.estimatedArrivalDate).toLocaleDateString(locale)
                            : "--"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={location.isDefault || setDefaultLocation.isPending}
                            onClick={() => setDefaultLocation.mutate(location)}
                          >
                            {t("setDefault")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openMaxStockDialog(location)}
                          >
                            {t("editMaxStock")}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {hasBatches && isExpanded && (
                        <TableRow>
                          <TableCell colSpan={11} className="bg-muted/50 p-0">
                            <div className="px-4 py-2">
                              <Table>
                                <TableHeader>
                                  <TableRow className="hover:bg-transparent">
                                    <TableHead className="h-8 text-xs">{t("batchCode")}</TableHead>
                                    <TableHead className="h-8 text-xs">
                                      {t("receivedDate")}
                                    </TableHead>
                                    <TableHead className="h-8 text-right text-xs">
                                      {t("onHand")}
                                    </TableHead>
                                    <TableHead className="h-8 text-right text-xs">
                                      {t("reserved")}
                                    </TableHead>
                                    <TableHead className="h-8 text-right text-xs">
                                      {t("available")}
                                    </TableHead>
                                    {canPrintBatchQr ? (
                                      <TableHead className="h-8 text-right text-xs">
                                        {tCommon("actions")}
                                      </TableHead>
                                    ) : null}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {location.batches?.map((batch) => (
                                    <TableRow key={batch.id} className="hover:bg-transparent">
                                      <TableCell className="py-2 text-xs font-medium">
                                        {batch.batchCode}
                                      </TableCell>
                                      <TableCell className="py-2 text-xs">
                                        {new Date(batch.receivedAt).toLocaleDateString(locale)}
                                      </TableCell>
                                      <TableCell className="py-2 text-right text-xs">
                                        {formatQty(batch.qtyOnHand, locale)}
                                      </TableCell>
                                      <TableCell className="py-2 text-right text-xs">
                                        {formatQty(batch.qtyReserved, locale)}
                                      </TableCell>
                                      <TableCell className="py-2 text-right text-xs">
                                        {formatQty(batch.qtyAvailable, locale)}
                                      </TableCell>
                                      {canPrintBatchQr ? (
                                        <TableCell className="py-2 text-right">
                                          <div className="flex justify-end gap-2">
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="h-8 px-2"
                                              aria-label={t("printBatchQr")}
                                              disabled={
                                                batchPrintUnitOptions.length === 0 ||
                                                printingBatchLocationId !== null
                                              }
                                              onClick={() => openBatchPrintDialog(batch)}
                                            >
                                              {printingBatchLocationId === batch.id ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                              ) : (
                                                <Printer className="mr-2 h-4 w-4" />
                                              )}
                                              <span>
                                                {printingBatchLocationId === batch.id
                                                  ? t("printingBatchQr")
                                                  : t("printBatchQr")}
                                              </span>
                                            </Button>
                                          </div>
                                        </TableCell>
                                      ) : null}
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <Dialog
        open={batchToPrint !== null}
        onOpenChange={(open) => {
          if (!open) closeBatchPrintDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("batchPrintDialogTitle")}</DialogTitle>
            <DialogDescription>
              {batchToPrint
                ? t("batchPrintDialogDescription", {
                    batch: batchToPrint.batchCode,
                    quantity: formatQty(batchToPrint.qtyOnHand, locale),
                  })
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="batch-label-count" className="text-sm font-medium">
              {t("batchLabelCount")}
            </label>
            <Input
              id="batch-label-count"
              type="number"
              min="1"
              max={MAX_BATCH_LABEL_COUNT}
              step="1"
              value={batchLabelCount}
              disabled={printingBatchLocationId !== null}
              onChange={(event) => setBatchLabelCount(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("batchLabelCountHelp", { max: MAX_BATCH_LABEL_COUNT })}
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("batchPrintUnit")}</label>
            <Select
              value={batchPrintUnitId}
              disabled={printingBatchLocationId !== null}
              onValueChange={setBatchPrintUnitId}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("selectBatchPrintUnit")} />
              </SelectTrigger>
              <SelectContent>
                {batchPrintUnitOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.displayLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("batchPrintUnitHelp")}</p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={printingBatchLocationId !== null}
              onClick={closeBatchPrintDialog}
            >
              {t("cancel")}
            </Button>
            <Button
              disabled={
                !isBatchLabelCountValid ||
                !selectedBatchPrintUnit ||
                printingBatchLocationId !== null
              }
              onClick={handlePrintBatchQr}
            >
              {printingBatchLocationId ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Printer className="mr-2 h-4 w-4" />
              )}
              {printingBatchLocationId ? t("printingBatchQr") : t("printBatchLabels")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={moveDialogOpen}
        onOpenChange={(open) => {
          setMoveDialogOpen(open);
          if (!open) {
            setSelectedWarehouseId("");
            setFromLocationId("");
            setToLocationId("");
            setMoveQty("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("moveDialogTitle")}</DialogTitle>
            <DialogDescription>{t("moveDialogDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t("warehouseLabel")}</label>
              <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectWarehouse")} />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.code} - {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">{t("fromLocationLabel")}</label>
              <Select
                value={fromLocationId}
                onValueChange={setFromLocationId}
                disabled={!selectedWarehouseId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectSourceLocation")} />
                </SelectTrigger>
                <SelectContent>
                  {fromLocations.map((loc) => (
                    <SelectItem key={loc.locationId} value={loc.locationId}>
                      {loc.locationCode} - {loc.locationName} ({t("availableShort")}{" "}
                      {formatQty(loc.qtyAvailable, locale)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">{t("toLocationLabel")}</label>
              <Select
                value={toLocationId}
                onValueChange={setToLocationId}
                disabled={!selectedWarehouseId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectDestinationLocation")} />
                </SelectTrigger>
                <SelectContent>
                  {toLocations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.code} - {loc.name || t("unnamed")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">{t("quantityLabel")}</label>
              <Input
                type="number"
                min="0"
                step="0.0001"
                value={moveQty}
                onChange={(event) => setMoveQty(event.target.value)}
                placeholder={t("quantityPlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={() => moveStock.mutate()} disabled={moveStock.isPending}>
              {moveStock.isPending ? t("moving") : t("moveStock")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={maxStockDialogOpen}
        onOpenChange={(open) => {
          setMaxStockDialogOpen(open);
          if (!open) {
            setSelectedMaxStockLocation(null);
            setMaxStockInput("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("maxStockDialogTitle")}</DialogTitle>
            <DialogDescription>
              {selectedMaxStockLocation
                ? t("maxStockDialogDescription", {
                    warehouse: `${selectedMaxStockLocation.warehouseCode} - ${selectedMaxStockLocation.warehouseName}`,
                  })
                : t("maxStockDialogDescriptionFallback")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("maxStock")}</label>
            <Input
              type="number"
              min="0"
              step="0.0001"
              value={maxStockInput}
              onChange={(event) => setMaxStockInput(event.target.value)}
              placeholder={t("maxStockPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">{t("maxStockHelp")}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaxStockDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={() => updateMaxStock.mutate()} disabled={updateMaxStock.isPending}>
              {updateMaxStock.isPending ? t("saving") : t("saveMaxStock")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
