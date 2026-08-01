"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImageUp, Loader2, Map as MapIcon, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AsyncSearchCombobox } from "@/components/shared/AsyncSearchCombobox";
import { EmptyStatePanel } from "@/components/shared/EmptyStatePanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useLookupWarehouseLocations } from "@/hooks/useLookups";
import { useSaveWarehouseFloorMap, useWarehouseFloorMap } from "@/hooks/useWarehouseFloorMap";
import { isCompleteRackRectangle } from "@/lib/warehouse-floor-map-geometry";
import type { WarehouseFloorMapRackInput } from "@/types/warehouse-floor-map";

type DrawPoint = {
  xBasisPoints: number;
  yBasisPoints: number;
};

type Props = {
  warehouseId: string;
  canEdit: boolean;
};

type RackOption = {
  id: string;
  code: string;
  name: string | null;
};

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

export const WarehouseFloorMapEditor = ({ warehouseId, canEdit }: Props) => {
  const t = useTranslations("warehouseFloorMap");
  const mapQuery = useWarehouseFloorMap(warehouseId);
  const saveMap = useSaveWarehouseFloorMap();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const drawStartRef = useRef<DrawPoint | null>(null);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [imageWidth, setImageWidth] = useState(0);
  const [imageHeight, setImageHeight] = useState(0);
  const [imageDecodeFailed, setImageDecodeFailed] = useState(false);
  const [selectedRackId, setSelectedRackId] = useState("");
  const [selectedRackOption, setSelectedRackOption] = useState<RackOption | null>(null);
  const [rackSearch, setRackSearch] = useState("");
  const [racks, setRacks] = useState<WarehouseFloorMapRackInput[]>([]);
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
          ...rackOptions,
          ...(selectedRackOption ? [selectedRackOption] : []),
        ].map((location) => [location.id, location])
      ),
    [mappedRackOptions, rackOptions, selectedRackOption]
  );

  useEffect(() => {
    const floorMap = mapQuery.data?.data;
    if (!floorMap || file) return;
    setName(floorMap.name);
    setPreviewUrl(floorMap.imageUrl);
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
  }, [file, mapQuery.data?.data]);

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
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
    }
    const objectUrl = URL.createObjectURL(nextFile);
    previewObjectUrlRef.current = objectUrl;
    setFile(nextFile);
    setPreviewUrl(objectUrl);
    setImageWidth(0);
    setImageHeight(0);
    setImageDecodeFailed(false);
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
    if (!canEdit) return;
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

    setRacks((current) => [
      ...current.filter((rack) => rack.warehouseLocationId !== selectedRackId),
      mapping,
    ]);
  };

  const handleDrawCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    drawStartRef.current = null;
    setDraftRack(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleSave = async () => {
    if (!canEdit) return;
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

    try {
      await saveMap.mutateAsync({
        warehouseId,
        name: name.trim() || t("mapNamePlaceholder"),
        imageWidth,
        imageHeight,
        racks,
        file,
      });
      setFile(null);
      toast.success(t("saveSuccess"));
    } catch {
      toast.error(t("saveError"));
    }
  };

  if (mapQuery.isLoading) {
    return <Skeleton className="h-96 w-full" />;
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
    <div className={canEdit ? "grid gap-6 xl:grid-cols-3" : "space-y-4"}>
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
                    placeholder={t("mapNamePlaceholder")}
                    onChange={(event) => setName(event.target.value)}
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
                canEdit ? "cursor-crosshair touch-none" : ""
              }`}
              onPointerDown={canEdit ? handleDrawStart : undefined}
              onPointerMove={canEdit ? handleDrawMove : undefined}
              onPointerUp={canEdit ? handleDrawEnd : undefined}
              onPointerCancel={canEdit ? handleDrawCancel : undefined}
            >
              <Image
                src={previewUrl}
                alt={name || t("title")}
                width={imageWidth || 1200}
                height={imageHeight || 800}
                className="h-auto w-full select-none"
                draggable={false}
                unoptimized
              />
              {[
                ...racks.filter(
                  (rack) => rack.warehouseLocationId !== draftRack?.warehouseLocationId
                ),
                ...(draftRack ? [draftRack] : []),
              ].map((rack) => {
                const location = locationById.get(rack.warehouseLocationId);
                const isDraft = rack === draftRack;
                return (
                  <div
                    key={`${isDraft ? "draft" : "saved"}-${rack.warehouseLocationId}`}
                    className={`pointer-events-none absolute flex items-center justify-center border-2 border-primary bg-primary/25 text-xs font-semibold text-primary-foreground shadow-sm ${
                      isDraft ? "border-dashed" : ""
                    }`}
                    style={{
                      left: `${rack.xBasisPoints / 100}%`,
                      top: `${rack.yBasisPoints / 100}%`,
                      width: `${rack.widthBasisPoints / 100}%`,
                      height: `${rack.heightBasisPoints / 100}%`,
                    }}
                  >
                    <span className="rounded bg-primary px-1 text-primary-foreground">
                      {location?.code || ""}
                    </span>
                  </div>
                );
              })}
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
                        onClick={() =>
                          setRacks((current) =>
                            current.filter(
                              (candidate) =>
                                candidate.warehouseLocationId !== rack.warehouseLocationId
                            )
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Button
            className="w-full"
            disabled={
              saveMap.isPending || !previewUrl || !imageWidth || !imageHeight || imageDecodeFailed
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
    </div>
  );
};
