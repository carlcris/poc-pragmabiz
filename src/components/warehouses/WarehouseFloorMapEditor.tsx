"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImageUp, Loader2, Map as MapIcon, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AsyncSearchCombobox } from "@/components/shared/AsyncSearchCombobox";
import { EmptyStatePanel } from "@/components/shared/EmptyStatePanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WarehouseFloorSelect } from "@/components/warehouses/WarehouseFloorSelect";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { parseFloorNumber } from "@/lib/validations/warehouse-floor-map";
import {
  WAREHOUSE_FLOOR_MAP_ERROR_CODES,
  type WarehouseFloorSummary,
} from "@/types/warehouse-floor-map";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useLookupWarehouseLocations } from "@/hooks/useLookups";
import { useSaveWarehouseFloorMap, useWarehouseFloorMap } from "@/hooks/useWarehouseFloorMap";
import { getApiErrorCode } from "@/lib/api";
import { isCompleteRackRectangle } from "@/lib/warehouse-floor-map-geometry";
import type { WarehouseFloorMapRackInput } from "@/types/warehouse-floor-map";

type DrawPoint = {
  xBasisPoints: number;
  yBasisPoints: number;
};

type Props = {
  businessUnitId: string;
  warehouseId: string;
  canEdit: boolean;
};

type RackOption = {
  id: string;
  code: string;
  name: string | null;
};

export const WarehouseFloorMapEditorSkeleton = ({ canEdit = true }: { canEdit?: boolean }) => (
  <div className={canEdit ? "grid gap-6 xl:grid-cols-3" : "space-y-4"}>
    <Card className={canEdit ? "xl:col-span-2" : undefined}>
      <CardHeader>
        <Skeleton className="h-6 w-40" />
      </CardHeader>
      <CardContent className="space-y-4">
        {canEdit ? (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="h-10 w-36" />
            </div>
            <Skeleton className="h-4 w-72 max-w-full" />
          </>
        ) : null}
        <Skeleton className="aspect-video w-full" />
      </CardContent>
    </Card>

    {canEdit ? (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-28" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-24" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
        <Skeleton className="h-10 w-full" />
      </div>
    ) : null}
  </div>
);

const toPoint = (event: React.PointerEvent<HTMLDivElement>): DrawPoint => {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    xBasisPoints: Math.max(
      0,
      Math.min(10_000, Math.round(((event.clientX - bounds.left) / bounds.width) * 10_000))
    ),
    yBasisPoints: Math.max(
      0,
      Math.min(10_000, Math.round(((event.clientY - bounds.top) / bounds.height) * 10_000))
    ),
  };
};

const toRackRectangle = (
  warehouseLocationId: string,
  start: DrawPoint,
  end: DrawPoint
): WarehouseFloorMapRackInput => {
  const xBasisPoints = Math.min(start.xBasisPoints, end.xBasisPoints);
  const yBasisPoints = Math.min(start.yBasisPoints, end.yBasisPoints);

  return {
    warehouseLocationId,
    xBasisPoints,
    yBasisPoints,
    widthBasisPoints: Math.abs(end.xBasisPoints - start.xBasisPoints),
    heightBasisPoints: Math.abs(end.yBasisPoints - start.yBasisPoints),
  };
};

export const WarehouseFloorMapEditor = (props: Props) => {
  const t = useTranslations("warehouseFloorMap");
  const [floor, setFloor] = useState<WarehouseFloorSummary | null>(null);
  const [pendingFloor, setPendingFloor] = useState<WarehouseFloorSummary | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newFloorNumber, setNewFloorNumber] = useState("");
  const [floorError, setFloorError] = useState(false);
  const changeFloor = (next: WarehouseFloorSummary) => {
    if (next.floorNumber === (floor?.floorNumber ?? 1)) {
      setFloor(next);
    } else if (isDirty) {
      setPendingFloor(next);
    } else {
      setFloor(next);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:max-w-sm">
          <WarehouseFloorSelect
            businessUnitId={props.businessUnitId}
            warehouseId={props.warehouseId}
            value={floor}
            onChange={changeFloor}
            disabled={isSaving}
          />
        </div>
        {props.canEdit ? (
          <Button
            variant="outline"
            disabled={isSaving}
            onClick={() => {
              setNewFloorNumber("");
              setFloorError(false);
              setAddOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("addFloor")}
          </Button>
        ) : null}
      </div>
      <FloorMapEditorContent
        key={`${props.businessUnitId}:${props.warehouseId}:${floor?.floorNumber ?? 1}`}
        {...props}
        floorNumber={floor?.floorNumber ?? 1}
        onDirtyChange={setIsDirty}
        onSavingChange={setIsSaving}
      />
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("addFloor")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="warehouse-new-floor">{t("floorNumber")}</Label>
            <Input
              id="warehouse-new-floor"
              type="number"
              min={1}
              max={2147483647}
              step={1}
              value={newFloorNumber}
              onChange={(event) => {
                setNewFloorNumber(event.target.value);
                setFloorError(false);
              }}
            />
            {floorError ? (
              <p className="text-sm text-destructive">{t("invalidFloorNumber")}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                const number = parseFloorNumber(newFloorNumber);
                if (number === null) {
                  setFloorError(true);
                  return;
                }
                changeFloor({ id: "", floorNumber: number, name: "" });
                setAddOpen(false);
              }}
            >
              {t("openFloor")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={pendingFloor !== null}
        onOpenChange={(open) => {
          if (!open) setPendingFloor(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("discardTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("discardDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("keepEditing")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setFloor(pendingFloor);
                setIsDirty(false);
                setPendingFloor(null);
              }}
            >
              {t("discardChanges")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const FloorMapEditorContent = ({
  businessUnitId,
  warehouseId,
  canEdit,
  floorNumber,
  onDirtyChange,
  onSavingChange,
}: Props & {
  floorNumber: number;
  onDirtyChange: (dirty: boolean) => void;
  onSavingChange: (saving: boolean) => void;
}) => {
  const t = useTranslations("warehouseFloorMap");
  const mapQuery = useWarehouseFloorMap(businessUnitId, warehouseId, floorNumber);
  const saveMap = useSaveWarehouseFloorMap(businessUnitId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const previewUrlRef = useRef("");
  const drawStartRef = useRef<DrawPoint | null>(null);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [imageWidth, setImageWidth] = useState(0);
  const [imageHeight, setImageHeight] = useState(0);
  const [imageDecodeFailed, setImageDecodeFailed] = useState(false);
  const [isRenderedImageReady, setIsRenderedImageReady] = useState(false);
  const [renderedImageFailed, setRenderedImageFailed] = useState(false);
  const [selectedRackId, setSelectedRackId] = useState("");
  const [selectedRackOption, setSelectedRackOption] = useState<RackOption | null>(null);
  const [rackSearch, setRackSearch] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [expectedVersion, setExpectedVersion] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isDirtyRef = useRef(false);
  const markDirty = () => {
    isDirtyRef.current = true;
    setIsDirty(true);
    setSaveError(null);
  };
  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);
  useEffect(() => {
    onSavingChange(saveMap.isPending);
  }, [saveMap.isPending, onSavingChange]);
  const [racks, setRacks] = useState<WarehouseFloorMapRackInput[]>([]);
  const [mappedRackMetadata, setMappedRackMetadata] = useState<Record<string, RackOption>>({});
  const [draftRack, setDraftRack] = useState<WarehouseFloorMapRackInput | null>(null);
  const debouncedRackSearch = useDebouncedValue(rackSearch.trim(), 300);
  const rackLookup = useLookupWarehouseLocations(canEdit ? warehouseId : null, {
    search: debouncedRackSearch || undefined,
    limit: 5,
    locationType: "rack",
  });
  const rackOptions = useMemo<RackOption[]>(
    () =>
      (rackLookup.data?.data || []).map((location) => ({
        id: location.id,
        code: location.code,
        name: location.name ?? null,
      })),
    [rackLookup.data?.data]
  );
  const mappedRackOptions = useMemo<RackOption[]>(
    () =>
      (mapQuery.data?.data?.racks || []).map((rack) => ({
        id: rack.warehouseLocationId,
        code: rack.locationCode,
        name: rack.locationName,
      })),
    [mapQuery.data?.data?.racks]
  );
  const locationById = useMemo(
    () =>
      new Map(
        [
          ...mappedRackOptions,
          ...Object.values(mappedRackMetadata),
          ...rackOptions,
          ...(selectedRackOption ? [selectedRackOption] : []),
        ].map((location) => [location.id, location])
      ),
    [mappedRackMetadata, mappedRackOptions, rackOptions, selectedRackOption]
  );

  useEffect(() => {
    const floorMap = mapQuery.data?.data;
    if (isDirtyRef.current || file || !mapQuery.isSuccess) return;
    setExpectedVersion(floorMap?.version ?? 0);
    if (!floorMap) {
      setName("");
      setPreviewUrl("");
      previewUrlRef.current = "";
      setImageWidth(0);
      setImageHeight(0);
      setImageDecodeFailed(false);
      setIsRenderedImageReady(false);
      setRenderedImageFailed(false);
      setRacks([]);
      setMappedRackMetadata({});
      setDraftRack(null);
      return;
    }
    setName(floorMap.name);
    setPreviewUrl(floorMap.imageUrl);
    setImageDecodeFailed(false);
    if (previewUrlRef.current !== floorMap.imageUrl) {
      setIsRenderedImageReady(false);
      setRenderedImageFailed(false);
    }
    previewUrlRef.current = floorMap.imageUrl;
    setImageWidth(floorMap.imageWidth);
    setImageHeight(floorMap.imageHeight);
    setRacks(
      floorMap.racks.map((rack) => ({
        warehouseLocationId: rack.warehouseLocationId,
        xBasisPoints: rack.xBasisPoints,
        yBasisPoints: rack.yBasisPoints,
        widthBasisPoints: rack.widthBasisPoints,
        heightBasisPoints: rack.heightBasisPoints,
      }))
    );
    setMappedRackMetadata(
      Object.fromEntries(
        floorMap.racks.map((rack) => [
          rack.warehouseLocationId,
          {
            id: rack.warehouseLocationId,
            code: rack.locationCode,
            name: rack.locationName,
          },
        ])
      )
    );
  }, [file, isDirty, mapQuery.data?.data, mapQuery.isSuccess]);

  useEffect(
    () => () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
    },
    []
  );

  const handleFile = (nextFile: File | null) => {
    if (!nextFile) return;
    markDirty();
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
    }
    const objectUrl = URL.createObjectURL(nextFile);
    previewObjectUrlRef.current = objectUrl;
    setFile(nextFile);
    setPreviewUrl(objectUrl);
    previewUrlRef.current = objectUrl;
    setImageWidth(0);
    setImageHeight(0);
    setImageDecodeFailed(false);
    setIsRenderedImageReady(false);
    setRenderedImageFailed(false);
    setRacks([]);
    setDraftRack(null);

    const image = new window.Image();
    image.onload = () => {
      if (previewObjectUrlRef.current !== objectUrl) return;
      setImageWidth(image.naturalWidth);
      setImageHeight(image.naturalHeight);
    };
    image.onerror = () => {
      if (previewObjectUrlRef.current !== objectUrl) return;
      setImageDecodeFailed(true);
      toast.error(t("imageDecodeError"));
    };
    image.src = objectUrl;
  };

  const handleDrawStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canEdit || saveMap.isPending) return;
    if (!selectedRackId) {
      toast.error(t("rackRequired"));
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = toPoint(event);
    drawStartRef.current = start;
    setDraftRack(toRackRectangle(selectedRackId, start, start));
  };

  const handleDrawMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = drawStartRef.current;
    if (!start || !selectedRackId) return;
    setDraftRack(toRackRectangle(selectedRackId, start, toPoint(event)));
  };

  const handleDrawEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = drawStartRef.current;
    drawStartRef.current = null;
    setDraftRack(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!start || !selectedRackId) return;

    const mapping = toRackRectangle(selectedRackId, start, toPoint(event));
    if (!isCompleteRackRectangle(mapping)) {
      toast.error(t("mappingTooSmall"));
      return;
    }

    markDirty();
    setRacks((current) => [
      ...current.filter((rack) => rack.warehouseLocationId !== selectedRackId),
      mapping,
    ]);
    const selectedLocation =
      selectedRackOption ||
      rackOptions.find((rack) => rack.id === selectedRackId) ||
      mappedRackOptions.find((rack) => rack.id === selectedRackId);
    if (selectedLocation) {
      setMappedRackMetadata((current) => ({
        ...current,
        [selectedRackId]: selectedLocation,
      }));
    }
  };

  const handleDrawCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    drawStartRef.current = null;
    setDraftRack(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleSave = async () => {
    if (!canEdit || saveMap.isPending) return;
    if (imageDecodeFailed) {
      toast.error(t("imageDecodeError"));
      return;
    }
    if (!previewUrl || !imageWidth || !imageHeight) {
      toast.error(t("imageRequired"));
      return;
    }
    if (racks.some((rack) => !isCompleteRackRectangle(rack))) {
      toast.error(t("mappingTooSmall"));
      return;
    }

    setSaveError(null);
    try {
      await saveMap.mutateAsync({
        warehouseId,
        floorNumber,
        expectedVersion,
        name: name.trim() || t("floorLabel", { number: floorNumber }),
        imageWidth,
        imageHeight,
        racks,
        file,
      });
      isDirtyRef.current = false;
      setIsDirty(false);
      setFile(null);
      toast.success(t("saveSuccess"));
    } catch (error: unknown) {
      const code = getApiErrorCode(error, WAREHOUSE_FLOOR_MAP_ERROR_CODES);
      let message = t("saveError");
      switch (code) {
        case "FLOOR_MAP_PERMISSION_DENIED":
          message = t("savePermissionError");
          break;
        case "FLOOR_MAP_VERSION_CONFLICT":
          message = t("versionConflict");
          break;
        case "RACK_ALREADY_MAPPED_ON_ANOTHER_FLOOR":
          message = t("rackFloorConflict");
          break;
        case "RACK_MAPPING_TOO_SMALL":
          message = t("mappingTooSmall");
          break;
        case "FLOOR_MAP_IMAGE_REQUIRED":
          message = t("imageRequired");
          break;
        case "INVALID_FLOOR_MAP_IMAGE":
          message = t("imageHelp");
          break;
        case "INVALID_FLOOR_NUMBER":
          message = t("invalidFloorNumber");
          break;
        case "INVALID_FLOOR_MAP":
          message = t("invalidMap");
          break;
        case "FLOOR_MAP_RELOAD_FAILED":
          message = t("reloadError");
          break;
        case "WAREHOUSE_NOT_FOUND":
          message = t("warehouseUnavailable");
          break;
        case "UNAUTHORIZED":
          message = t("signInAgain");
          break;
      }
      setSaveError(message);
    }
  };

  const isMapStateHydrating = Boolean(
    mapQuery.data?.data && !isDirty && !file && previewUrl !== mapQuery.data.data.imageUrl
  );

  if (mapQuery.isLoading || isMapStateHydrating) {
    return <WarehouseFloorMapEditorSkeleton canEdit={canEdit} />;
  }

  if (mapQuery.error) {
    return (
      <EmptyStatePanel
        icon={MapIcon}
        title={t("loadError")}
        description={t("subtitle")}
        className="min-h-80"
      />
    );
  }

  return (
    <fieldset
      disabled={saveMap.isPending}
      className={canEdit ? "grid gap-6 xl:grid-cols-3" : "space-y-4"}
    >
      {!canEdit ? (
        <div className="rounded-md border bg-muted/30 p-4">
          <p className="font-medium">{t("readOnlyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("readOnlyDescription")}</p>
        </div>
      ) : null}
      <Card className={canEdit ? "xl:col-span-2" : undefined}>
        <CardHeader>
          <CardTitle>{t("image")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canEdit ? (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="floor-map-name">{t("mapName")}</Label>
                  <Input
                    id="floor-map-name"
                    value={name}
                    maxLength={120}
                    placeholder={t("floorLabel", { number: floorNumber })}
                    onChange={(event) => {
                      markDirty();
                      setName(event.target.value);
                    }}
                  />
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(event) => handleFile(event.target.files?.[0] || null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageUp className="mr-2 h-4 w-4" />
                  {previewUrl ? t("replaceImage") : t("uploadImage")}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">{t("imageHelp")}</p>
            </>
          ) : null}

          {previewUrl ? (
            <div
              className={`relative overflow-hidden rounded-md border bg-muted/20 ${
                canEdit && isRenderedImageReady ? "cursor-crosshair touch-none" : ""
              }`}
              onPointerDown={canEdit && isRenderedImageReady ? handleDrawStart : undefined}
              onPointerMove={canEdit && isRenderedImageReady ? handleDrawMove : undefined}
              onPointerUp={canEdit && isRenderedImageReady ? handleDrawEnd : undefined}
              onPointerCancel={canEdit && isRenderedImageReady ? handleDrawCancel : undefined}
            >
              <Image
                key={previewUrl}
                src={previewUrl}
                alt={name || t("title")}
                width={imageWidth || 1200}
                height={imageHeight || 800}
                className={`h-auto w-full select-none transition-opacity ${
                  isRenderedImageReady ? "opacity-100" : "opacity-0"
                }`}
                draggable={false}
                unoptimized
                onLoad={() => {
                  setRenderedImageFailed(false);
                  setIsRenderedImageReady(true);
                }}
                onError={() => {
                  setIsRenderedImageReady(false);
                  setRenderedImageFailed(true);
                }}
              />
              {!isRenderedImageReady && !renderedImageFailed ? (
                <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
              ) : null}
              {renderedImageFailed ? (
                <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-destructive">
                  {file ? t("imageDecodeError") : t("loadError")}
                </div>
              ) : null}
              {isRenderedImageReady
                ? [
                    ...racks.filter(
                      (rack) => rack.warehouseLocationId !== draftRack?.warehouseLocationId
                    ),
                    ...(draftRack ? [draftRack] : []),
                  ].map((rack) => {
                    const location = locationById.get(rack.warehouseLocationId);
                    const isDraft = rack === draftRack;
                    const isVerticalRack =
                      rack.widthBasisPoints > 0 && rack.heightBasisPoints > rack.widthBasisPoints;
                    const labelWidthPercent = isVerticalRack
                      ? (rack.heightBasisPoints / rack.widthBasisPoints) * 100
                      : 100;
                    const labelHeightPercent = isVerticalRack
                      ? (rack.widthBasisPoints / rack.heightBasisPoints) * 100
                      : 100;
                    return (
                      <div
                        key={`${isDraft ? "draft" : "saved"}-${rack.warehouseLocationId}`}
                        className={`pointer-events-none absolute overflow-hidden border-2 border-primary bg-primary/25 text-xs font-semibold text-primary-foreground shadow-sm ${
                          isDraft ? "border-dashed" : ""
                        }`}
                        style={{
                          left: `${rack.xBasisPoints / 100}%`,
                          top: `${rack.yBasisPoints / 100}%`,
                          width: `${rack.widthBasisPoints / 100}%`,
                          height: `${rack.heightBasisPoints / 100}%`,
                        }}
                      >
                        <div
                          className="absolute left-1/2 top-1/2 flex items-center justify-center"
                          style={{
                            width: `${labelWidthPercent}%`,
                            height: `${labelHeightPercent}%`,
                            transform: `translate(-50%, -50%)${
                              isVerticalRack ? " rotate(-90deg)" : ""
                            }`,
                          }}
                        >
                          <span className="max-w-full truncate text-primary">
                            {location?.name || location?.code || ""}
                          </span>
                        </div>
                      </div>
                    );
                  })
                : null}
            </div>
          ) : canEdit ? (
            <button
              type="button"
              className="flex min-h-80 w-full flex-col items-center justify-center gap-3 rounded-md border border-dashed text-muted-foreground hover:bg-muted/30"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageUp className="h-8 w-8" />
              <span>{t("uploadImage")}</span>
            </button>
          ) : (
            <div className="flex min-h-80 items-center justify-center rounded-md border border-dashed p-6 text-center text-muted-foreground">
              {t("noMapConfigured")}
            </div>
          )}
        </CardContent>
      </Card>

      {canEdit ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("rack")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <AsyncSearchCombobox
                value={selectedRackId}
                onValueChange={(nextId) => {
                  setSelectedRackId(nextId);
                  setSelectedRackOption(
                    rackOptions.find((rack) => rack.id === nextId) ||
                      mappedRackOptions.find((rack) => rack.id === nextId) ||
                      null
                  );
                }}
                searchValue={rackSearch}
                onSearchValueChange={setRackSearch}
                options={rackOptions}
                selectedOption={selectedRackOption}
                getOptionValue={(rack) => rack.id}
                getOptionLabel={(rack) => `${rack.code} - ${rack.name || rack.code}`}
                placeholder={t("selectRack")}
                searchPlaceholder={t("searchRack")}
                emptyMessage={t("noRack")}
                loadingMessage={t("loadingRacks")}
                isLoading={rackLookup.isLoading}
              />
              <p className="text-sm text-muted-foreground">{t("drawHelp")}</p>
              <Button variant="link" className="h-auto p-0" asChild>
                <Link href={`/inventory/warehouses/${warehouseId}/locations`}>
                  {t("locationsLink")}
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("mappedRacks")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {racks.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noMappedRacks")}</p>
              ) : (
                racks.map((rack) => {
                  const location = locationById.get(rack.warehouseLocationId);
                  return (
                    <div
                      key={rack.warehouseLocationId}
                      className="flex items-center justify-between gap-2 rounded-md border p-2"
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left text-sm font-medium"
                        onClick={() => {
                          setSelectedRackId(rack.warehouseLocationId);
                          setSelectedRackOption(location || null);
                        }}
                      >
                        {location?.code} - {location?.name || location?.code}
                      </button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={t("removeMapping")}
                        onClick={() => {
                          markDirty();
                          setRacks((current) =>
                            current.filter(
                              (candidate) =>
                                candidate.warehouseLocationId !== rack.warehouseLocationId
                            )
                          );
                          setMappedRackMetadata((current) => {
                            const next = { ...current };
                            delete next[rack.warehouseLocationId];
                            return next;
                          });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {saveError ? (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
              <Button
                variant="outline"
                className="mt-2"
                disabled={saveMap.isPending}
                onClick={() => {
                  isDirtyRef.current = false;
                  setIsDirty(false);
                  setFile(null);
                  setSaveError(null);
                  void mapQuery.refetch();
                }}
              >
                {t("reloadMap")}
              </Button>
            </Alert>
          ) : null}
          <Button
            className="w-full"
            disabled={
              saveMap.isPending ||
              !previewUrl ||
              !imageWidth ||
              !imageHeight ||
              imageDecodeFailed ||
              !isRenderedImageReady ||
              renderedImageFailed
            }
            onClick={handleSave}
          >
            {saveMap.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <MapIcon className="mr-2 h-4 w-4" />
            )}
            {saveMap.isPending ? t("saving") : t("save")}
          </Button>
        </div>
      ) : null}
    </fieldset>
  );
};
