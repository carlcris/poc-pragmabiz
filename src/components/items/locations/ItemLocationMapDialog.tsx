"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, MapPinned, Package, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Skeleton } from "@/components/ui/skeleton";
import { WarehouseFloorSelect } from "@/components/warehouses/WarehouseFloorSelect";
import { useWarehouseFloorMap, useWarehouseFloors } from "@/hooks/useWarehouseFloorMap";
import { cn } from "@/lib/utils";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import type { ItemLocation } from "@/types/inventory-location";
import type { WarehouseFloorMapRack, WarehouseFloorSummary } from "@/types/warehouse-floor-map";

type ItemLocationMapWarehouse = {
  id: string;
  code: string;
  name: string;
  locations: ItemLocation[];
};

type ItemLocationMapDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouses: ItemLocationMapWarehouse[];
  itemCode: string;
  itemName: string;
};

const getRackLabel = (rack: WarehouseFloorMapRack) =>
  rack.locationName?.trim() || rack.locationCode;

export const ItemLocationMapDialog = ({
  open,
  onOpenChange,
  warehouses,
  itemCode,
  itemName,
}: ItemLocationMapDialogProps) => {
  const t = useTranslations("itemLocationsTab");
  const businessUnitId = useBusinessUnitStore((state) => state.currentBusinessUnit?.id ?? "");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [selectedFloor, setSelectedFloor] = useState<{
    scope: string;
    floor: WarehouseFloorSummary;
  } | null>(null);
  const [loadedImageUrl, setLoadedImageUrl] = useState("");
  const [failedImageUrl, setFailedImageUrl] = useState("");

  const selectedWarehouse =
    warehouses.find((warehouse) => warehouse.id === selectedWarehouseId) ?? warehouses[0] ?? null;
  const activeWarehouseId = selectedWarehouse?.id ?? "";
  const floorScope = `${businessUnitId}:${activeWarehouseId}`;
  const floorsQuery = useWarehouseFloors(
    open ? businessUnitId : "",
    open ? activeWarehouseId : "",
    ""
  );
  const activeFloor =
    selectedFloor?.scope === floorScope ? selectedFloor.floor : (floorsQuery.data?.data[0] ?? null);
  const mapQuery = useWarehouseFloorMap(
    open ? businessUnitId : "",
    open ? activeWarehouseId : "",
    activeFloor?.floorNumber ?? 0
  );
  const floorMap = mapQuery.data?.data ?? null;
  const stockedLocations = useMemo(
    () => (selectedWarehouse?.locations ?? []).filter((location) => location.qtyOnHand > 0),
    [selectedWarehouse]
  );
  const itemLocationIds = useMemo(
    () => new Set(stockedLocations.map((location) => location.locationId)),
    [stockedLocations]
  );
  const mappedLocationIds = useMemo(
    () => new Set((floorMap?.racks ?? []).map((rack) => rack.warehouseLocationId)),
    [floorMap?.racks]
  );
  const offFloorStockedLocations = useMemo(
    () => stockedLocations.filter((location) => !mappedLocationIds.has(location.locationId)),
    [mappedLocationIds, stockedLocations]
  );
  const imageReady = floorMap !== null && loadedImageUrl === floorMap.imageUrl;
  const imageFailed = floorMap !== null && failedImageUrl === floorMap.imageUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-screen overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t("locationMapTitle")}</DialogTitle>
          <DialogDescription>{t("locationMapDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-md border bg-muted/30 px-4 py-3">
            <div className="rounded-md bg-background p-2 text-primary shadow-sm">
              <Package className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("locationMapItem")}
              </p>
              <p className="truncate font-semibold">{itemCode}</p>
              <p className="text-sm text-muted-foreground">{itemName}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:max-w-3xl sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <label className="block text-sm font-medium">{t("locationMapWarehouse")}</label>
              <Select value={activeWarehouseId} onValueChange={setSelectedWarehouseId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectWarehouse")} />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0">
              <WarehouseFloorSelect
                key={floorScope}
                businessUnitId={open ? businessUnitId : ""}
                warehouseId={open ? activeWarehouseId : ""}
                value={activeFloor}
                onChange={(floor) => setSelectedFloor({ scope: floorScope, floor })}
              />
            </div>
          </div>

          {floorsQuery.isPending || (activeFloor !== null && mapQuery.isPending) ? (
            <div className="space-y-3" aria-label={t("locationMapLoading")}>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-96 w-full" />
            </div>
          ) : floorsQuery.isError || mapQuery.isError ? (
            <div className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-md border px-6 py-10 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <div>
                <p className="font-medium">{t("locationMapLoadError")}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("locationMapLoadErrorDescription")}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  void floorsQuery.refetch();
                  if (activeFloor) void mapQuery.refetch();
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {t("locationMapRetry")}
              </Button>
            </div>
          ) : floorMap === null ? (
            <div className="flex min-h-80 flex-col items-center justify-center rounded-md border px-6 py-10 text-center">
              <MapPinned className="mb-3 h-10 w-10 text-muted-foreground/55" />
              <p className="font-medium text-muted-foreground">{t("locationMapNotConfigured")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("locationMapNotConfiguredDescription")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{floorMap.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedWarehouse?.name ?? ""}</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="h-3 w-3 rounded-sm border-2 border-destructive bg-destructive/30" />
                  {t("locationMapItemRack")}
                </div>
              </div>

              {offFloorStockedLocations.length > 0 ? (
                <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 [&>svg]:text-amber-700 dark:[&>svg]:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="font-medium text-inherit">
                    {t("locationMapNoMappedLocations", {
                      locations: offFloorStockedLocations
                        .map((location) => location.locationCode)
                        .join(", "),
                    })}
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="relative overflow-hidden rounded-md border bg-muted/20">
                <Image
                  unoptimized
                  src={floorMap.imageUrl}
                  alt={floorMap.name}
                  width={floorMap.imageWidth}
                  height={floorMap.imageHeight}
                  className={cn("h-auto w-full", imageReady ? "opacity-100" : "opacity-0")}
                  onLoad={() => {
                    setLoadedImageUrl(floorMap.imageUrl);
                    setFailedImageUrl("");
                  }}
                  onError={() => setFailedImageUrl(floorMap.imageUrl)}
                />

                {!imageReady && !imageFailed ? (
                  <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
                ) : null}

                {imageFailed ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background px-6 text-center">
                    <AlertCircle className="h-10 w-10 text-destructive" />
                    <p className="font-medium">{t("locationMapImageError")}</p>
                  </div>
                ) : null}

                {imageReady
                  ? floorMap.racks.map((rack) => {
                      const isItemRack = itemLocationIds.has(rack.warehouseLocationId);
                      const isVerticalRack = rack.heightBasisPoints > rack.widthBasisPoints;
                      const labelWidthPercent = isVerticalRack
                        ? (rack.heightBasisPoints / rack.widthBasisPoints) * 100
                        : 100;
                      const labelHeightPercent = isVerticalRack
                        ? (rack.widthBasisPoints / rack.heightBasisPoints) * 100
                        : 100;

                      return (
                        <div
                          key={rack.id}
                          className={cn(
                            "pointer-events-none absolute overflow-hidden border-2",
                            isItemRack
                              ? "border-destructive bg-destructive/30 text-destructive"
                              : "border-primary/35 bg-primary/10 text-muted-foreground"
                          )}
                          style={{
                            left: `${rack.xBasisPoints / 100}%`,
                            top: `${rack.yBasisPoints / 100}%`,
                            width: `${rack.widthBasisPoints / 100}%`,
                            height: `${rack.heightBasisPoints / 100}%`,
                          }}
                        >
                          <span
                            className="absolute left-1/2 top-1/2 flex items-center justify-center truncate px-1 text-xs font-semibold"
                            style={{
                              width: `${labelWidthPercent}%`,
                              height: `${labelHeightPercent}%`,
                              transform: isVerticalRack
                                ? "translate(-50%, -50%) rotate(-90deg)"
                                : "translate(-50%, -50%)",
                            }}
                          >
                            {getRackLabel(rack)}
                          </span>
                        </div>
                      );
                    })
                  : null}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
