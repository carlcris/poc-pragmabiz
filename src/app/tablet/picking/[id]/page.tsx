"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { TabletHeader } from "@/components/tablet/TabletHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { CameraScannerDialog } from "@/components/tablet/CameraScannerDialog";
import {
  Camera,
  PackageCheck,
  AlertCircle,
  CheckCircle2,
  Scan,
  Play,
  Pause,
  ChevronRight,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePickList, useUpdatePickListStatus } from "@/hooks/usePickLists";
import type { DbItemUnitOptionRow } from "@/lib/items/itemUnitOptions";
import {
  getPickableQtyCap,
  getPickingUnitLabel,
  getWholePickSourceQuantities,
  isPackagedPickLine,
  toPickQuantityScale,
} from "@/lib/picking-quantities";

import { useFormatter, useTranslations } from "next-intl";
import { pickListsApi } from "@/lib/api/pick-lists";
import { apiClient, getApiErrorCode } from "@/lib/api";
import { parseItemBatchQr, type ItemBatchQr } from "@/lib/item-batch-qr";
import type { PickSourceResult } from "@/types/pick-source";
import { useRecordPickListProgress } from "@/hooks/useRecordPickListProgress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const SHORT_REASON_OPTIONS = [
  { value: "missing", label: "Missing" },
  { value: "damaged", label: "Damaged" },
  { value: "expired", label: "Expired" },
  { value: "blocked", label: "Blocked" },
];

const toNumber = (value: number | string | null | undefined) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const one = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

type LineView = {
  id: string;
  barcode: string;
  displayName: string;
  uomLabel: string;
  requiredQty: number;
  pickedQty: number;
  status: string;
};

type ScannedItem = {
  lineId: string;
  locationName: string;
  batchCode: string;
  batchLocationSku: string;
  isMismatch: boolean;
  barcode: string;
  displayName: string;
  uomLabel: string;
  requiredQty: number;
  maxPickQty: number;
  // Packaged lines (qty_per_unit > 1) can only be picked in whole packages.
  isPackaged: boolean;
};

const isLinePicked = (status: string) =>
  status === "picked_partial" || status === "picked_full" || status === "done";

// Partial picks must remain pickable for additional scans until the line is fully picked.
const isLineCompleteForUi = (status: string) => status === "picked_full" || status === "done";

export default function TabletPickingDetailPage() {
  const t = useTranslations("mobilePickDetail");
  const format = useFormatter();
  const params = useParams();
  const router = useRouter();
  const pickListId = params.id as string;

  const { data: pickList, isLoading, error } = usePickList(pickListId);
  const updateItemsMutation = useRecordPickListProgress(pickListId);
  const updateStatusMutation = useUpdatePickListStatus();

  const [scannedCode, setScannedCode] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [currentItem, setCurrentItem] = useState<ScannedItem | null>(null);
  const [pickedQty, setPickedQty] = useState<number>(0);
  const [scanBusy, setScanBusy] = useState(false);
  const [operationId, setOperationId] = useState("");
  const [locationChoice, setLocationChoice] = useState<{
    qr: ItemBatchQr;
    result: Extract<PickSourceResult, { kind: "choose_location" }>;
  } | null>(null);
  const scanRequestRef = useRef(0);
  const confirmationPendingRef = useRef(false);
  confirmationPendingRef.current = updateItemsMutation.isPending;
  const closeLocationChoice = () => {
    scanRequestRef.current += 1;
    setLocationChoice(null);
    setScanBusy(false);
  };
  useEffect(
    () => () => {
      scanRequestRef.current += 1;
    },
    [pickListId]
  );
  useEffect(() => {
    if (!currentItem) return;
    const lineId = currentItem.lineId;
    const claim = () => pickListsApi.claimItem(pickListId, lineId);
    const timer = setInterval(() => {
      if (confirmationPendingRef.current) return;
      void claim().catch(() => {
        setCurrentItem(null);
        toast.error(t("sourceLookupFailed"));
      });
    }, 45000);
    return () => {
      clearInterval(timer);
      if (!confirmationPendingRef.current) {
        void pickListsApi.releaseItem(pickListId, lineId).catch(() => undefined);
      }
    };
  }, [currentItem, pickListId, t]);
  const [shortReason, setShortReason] = useState("");

  const lines = useMemo<LineView[]>(() => {
    return (pickList?.pick_list_items || []).map((item) => {
      const allocatedQty = toNumber(item.allocated_qty);
      const pickedValue = toNumber(item.picked_qty);
      const unitOption = one(
        (item as { item_unit_options?: unknown } | null | undefined)?.item_unit_options as
          | DbItemUnitOptionRow
          | DbItemUnitOptionRow[]
          | null
          | undefined
      );
      const uomRef = one(
        (item as { units_of_measure?: unknown } | null | undefined)?.units_of_measure as
          | { code?: string | null; symbol?: string | null; name?: string | null }
          | { code?: string | null; symbol?: string | null; name?: string | null }[]
          | null
          | undefined
      );
      const uomLabel = getPickingUnitLabel(
        uomRef?.symbol || uomRef?.name || uomRef?.code || t("pickUnit"),
        Number(unitOption?.qty_per_unit ?? 1),
        unitOption?.option_label
      );
      let status = "open";
      if (pickedValue > 0 && pickedValue >= allocatedQty) status = "picked_full";
      else if (pickedValue > 0) status = "picked_partial";

      return {
        id: item.id,
        barcode: unitOption?.barcode || "",
        displayName: item.items?.item_name || item.items?.item_code || item.item_id,
        uomLabel,
        requiredQty: allocatedQty,
        pickedQty: pickedValue,
        status,
      };
    });
  }, [pickList?.pick_list_items, t]);

  const processScan = async (code: string, page = 1, locationId?: string) => {
    if (pickList?.status !== "in_progress") {
      toast.error(t("startBeforeScan"));
      return;
    }
    const qr = parseItemBatchQr(code);
    if (!qr) {
      toast.error(t("itemBatchQrRequired"));
      return;
    }
    const requestId = ++scanRequestRef.current;
    setScanBusy(true);
    try {
      const { data } = await apiClient.get<{ data: PickSourceResult }>(
        `/api/pick-lists/${pickList.id}/scan-source`,
        { params: { itemId: qr.itemId, batchCode: qr.batchNumber, page, locationId } }
      );
      if (requestId !== scanRequestRef.current) return;
      if (data.kind === "choose_location") {
        setLocationChoice({ qr, result: data });
        return;
      }
      const resolved = data.resolution;
      const matchedLine = lines.find((line) => line.id === resolved.line.pickListItemId);
      if (!matchedLine) {
        toast.error(t("qrNotOnList"));
        return;
      }
      await pickListsApi.claimItem(pickList.id, matchedLine.id);
      if (requestId !== scanRequestRef.current) {
        await pickListsApi.releaseItem(pickList.id, matchedLine.id);
        return;
      }
      // Packaged lines pick in whole packages only, so the cap drops to the last full package.
      const pickableQtyCap = getPickableQtyCap(resolved.line);
      setCurrentItem({
        lineId: matchedLine.id,
        locationName: resolved.source.locationName,
        batchCode: resolved.source.batchCode,
        batchLocationSku: resolved.batchLocationSku,
        isMismatch: resolved.isMismatch,
        barcode: matchedLine.barcode,
        displayName: matchedLine.displayName,
        uomLabel: matchedLine.uomLabel,
        // The API subtracts picked from allocated in floating point, so round back to the stored
        // quantity scale before comparing it against the exact server cap for a short pick.
        requiredQty: toPickQuantityScale(resolved.line.remainingQty),
        maxPickQty: pickableQtyCap,
        isPackaged: isPackagedPickLine(resolved.line),
      });
      setOperationId(crypto.randomUUID());
      setPickedQty(pickableQtyCap);
      setShortReason("");
      setScannedCode("");
      setLocationChoice(null);
    } catch (error) {
      if (requestId !== scanRequestRef.current) return;
      const errorCode = getApiErrorCode(error, [
        "PICK_SOURCE_UNAVAILABLE",
        "PICK_SOURCE_FORBIDDEN",
        "PICK_SOURCE_NOT_ACTIVE",
      ] as const);
      toast.error(
        errorCode === "PICK_SOURCE_UNAVAILABLE"
          ? t("noEligibleSource")
          : errorCode === "PICK_SOURCE_FORBIDDEN"
            ? t("sourceForbidden")
            : errorCode === "PICK_SOURCE_NOT_ACTIVE"
              ? t("startBeforeScan")
              : t("sourceLookupFailed")
      );
    } finally {
      if (requestId === scanRequestRef.current) setScanBusy(false);
    }
  };

  const handleScan = async () => {
    await processScan(scannedCode);
  };

  const handleCameraScan = async (code: string) => {
    setShowCamera(false);
    await processScan(code);
  };

  const handleConfirmPick = async () => {
    if (!currentItem || !pickList || updateItemsMutation.isPending) return;
    if (pickList.status !== "in_progress") {
      toast.error(t("startBeforeScan"));
      return;
    }

    const requiredQty = currentItem.requiredQty;
    const maxPickQty = currentItem.maxPickQty;
    // The cap is exact, so anything above it would be rejected by the writer.
    if (!Number.isFinite(pickedQty) || pickedQty <= 0 || pickedQty > maxPickQty) {
      toast.error(t("positivePickQuantity", { quantity: maxPickQty }));
      return;
    }
    // Partial packages cannot leave the warehouse, so a packaged line takes whole packages only.
    if (currentItem.isPackaged && !Number.isInteger(pickedQty)) {
      toast.error(t("wholePackagePickQuantity", { unit: currentItem.uomLabel }));
      return;
    }

    if (pickedQty < requiredQty && !shortReason) {
      toast.error(t("partialPickReason"));
      return;
    }

    try {
      await updateItemsMutation.mutateAsync({
        pickListItemId: currentItem.lineId,
        operationId,
        batchLocationSku: currentItem.batchLocationSku,
        pickedQty,
        isMismatchWarningAcknowledged: currentItem.isMismatch,
        mismatchReason: currentItem.isMismatch
          ? "ALTERNATIVE_BATCH_LOCATION_SKU"
          : shortReason || null,
      });

      toast.success(t("pickSaved"));
      setCurrentItem(null);
      setPickedQty(0);
      setShortReason("");
    } catch (error) {
      const code = getApiErrorCode(error, [
        "PICK_PROGRESS_CLAIM_REQUIRED",
        "PICK_PROGRESS_INSUFFICIENT_QUANTITY",
        "PICK_PROGRESS_RESERVATION_CONFLICT",
        "PICK_PROGRESS_SOURCE_UNAVAILABLE",
        "PICK_PROGRESS_ALTERNATIVE_SOURCE_UNAVAILABLE",
        "PICK_PROGRESS_INVALID_QUANTITY",
      ] as const);
      toast.error(
        code === "PICK_PROGRESS_CLAIM_REQUIRED"
          ? t("pickClaimLost")
          : code === "PICK_PROGRESS_INVALID_QUANTITY"
            ? t("positivePickQuantity", { quantity: maxPickQty })
            : code
              ? t("pickStockChanged")
              : t("pickSaveFailed")
      );
    }
  };

  const onOpenDeliveryNotes = () => {
    if (pickList?.delivery_notes?.id) {
      router.push(`/inventory/delivery-notes/${pickList.delivery_notes.id}`);
      return;
    }
    router.push("/inventory/delivery-notes");
  };

  const startPicking = async () => {
    if (!pickList) return;
    await updateStatusMutation.mutateAsync({ id: pickList.id, data: { status: "in_progress" } });
  };

  const pausePicking = async () => {
    if (!pickList) return;
    await updateStatusMutation.mutateAsync({ id: pickList.id, data: { status: "paused" } });
  };

  const resumePicking = async () => {
    if (!pickList) return;
    await updateStatusMutation.mutateAsync({ id: pickList.id, data: { status: "in_progress" } });
  };

  const completePicking = async () => {
    if (!pickList) return;
    try {
      await updateStatusMutation.mutateAsync({ id: pickList.id, data: { status: "done" } });
    } catch {
      // Error toast is handled in useUpdatePickListStatus onError.
    }
  };

  const totalLines = lines.length;
  const pickedLinesCount = lines.filter((l) => isLineCompleteForUi(l.status)).length;
  const remainingLines = lines.filter((l) => !isLineCompleteForUi(l.status));
  const pickedLines = lines.filter((l) => isLinePicked(l.status));
  const pickSkusByPickListItemId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of pickList?.delivery_note_item_picks || []) {
      if (row.deleted_at) continue;
      if (!row.pick_list_item_id) continue;
      const batchLocationSku =
        typeof row.batch_location_sku === "string" ? row.batch_location_sku.trim() : "";
      if (!batchLocationSku) continue;
      const current = map.get(row.pick_list_item_id) || [];
      if (!current.includes(batchLocationSku)) current.push(batchLocationSku);
      map.set(row.pick_list_item_id, current);
    }
    return map;
  }, [pickList?.delivery_note_item_picks]);
  const getPickedSkuSummary = (pickListItemId: string) => {
    const skus = pickSkusByPickListItemId.get(pickListItemId) || [];
    if (skus.length === 0) return null;
    if (skus.length === 1) return skus[0];
    return `${skus[0]} +${skus.length - 1}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <CameraScannerDialog
        open={showCamera}
        onOpenChange={setShowCamera}
        title={t("qrContents")}
        onDetected={handleCameraScan}
      />

      <Dialog
        open={locationChoice !== null}
        onOpenChange={(open) => {
          if (!open) closeLocationChoice();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("chooseLocation")}</DialogTitle>
            <DialogDescription>{t("chooseLocationHint")}</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {locationChoice?.result.sources.map((source) => {
              const quantities = getWholePickSourceQuantities(source);
              const unit = lines.find((line) => line.id === source.line.pickListItemId)?.uomLabel;
              return (
                <Button
                  key={source.source.locationId}
                  variant="outline"
                  disabled={scanBusy}
                  className="h-auto w-full flex-col items-start whitespace-normal py-3 text-left"
                  onClick={() =>
                    void processScan(JSON.stringify(locationChoice.qr), 1, source.source.locationId)
                  }
                >
                  <span>
                    {source.source.warehouseName} / {source.source.locationName}
                  </span>
                  <span>
                    {quantities.kind === "whole_units"
                      ? t("availableToPickQuantity", {
                          quantity: format.number(quantities.availableQty),
                          unit: unit ?? t("pickUnit"),
                        })
                      : t("remainingQuantityAvailable")}
                  </span>
                  {!source.isMismatch ? <span>{t("suggestedLocation")}</span> : null}
                </Button>
              );
            })}
          </div>
          <div className="flex justify-between gap-2">
            <Button
              variant="outline"
              disabled={scanBusy || !locationChoice || locationChoice.result.page <= 1}
              onClick={() =>
                locationChoice &&
                void processScan(JSON.stringify(locationChoice.qr), locationChoice.result.page - 1)
              }
            >
              {t("previousLocations")}
            </Button>
            <Button
              variant="outline"
              disabled={scanBusy || !locationChoice?.result.hasMore}
              onClick={() =>
                locationChoice &&
                void processScan(JSON.stringify(locationChoice.qr), locationChoice.result.page + 1)
              }
            >
              {t("nextLocations")}
            </Button>
            <Button variant="outline" onClick={closeLocationChoice}>
              {t("cancelLocation")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <TabletHeader
        title="Picking"
        subtitle={pickList?.pick_list_no || "Pick List"}
        showBack={true}
        backHref="/tablet/picking"
        warehouseName="Main Warehouse"
      />

      <div className="space-y-4 p-4 pb-24">
        {isLoading ? (
          <div className="py-20 text-center">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
            <p className="text-sm text-gray-500">Loading pick list...</p>
          </div>
        ) : error || !pickList ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Failed to load pick list. Please try again.</AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Progress Card */}
            <Card>
              <CardContent className="pb-4 pt-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100">
                      <PackageCheck className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Pick Progress</div>
                      <div className="text-xs text-gray-500">
                        {pickList?.delivery_notes?.dn_no || "--"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      {pickedLinesCount}/{totalLines}
                    </div>
                    <div className="text-xs text-gray-500">Items</div>
                  </div>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={`h-full transition-all duration-500 ${
                      pickedLinesCount === totalLines ? "bg-green-500" : "bg-blue-500"
                    }`}
                    style={{
                      width: `${totalLines > 0 ? (pickedLinesCount / totalLines) * 100 : 0}%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            {pickList.status === "pending" && (
              <Button
                className="h-12 w-full bg-blue-600 hover:bg-blue-700"
                onClick={startPicking}
                disabled={updateStatusMutation.isPending}
              >
                <Play className="mr-2 h-4 w-4" />
                Start Picking
              </Button>
            )}

            {pickList.status === "in_progress" && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="h-12 flex-1"
                  onClick={pausePicking}
                  disabled={updateStatusMutation.isPending}
                >
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </Button>
                <Button
                  className="h-12 flex-1 bg-green-600 hover:bg-green-700"
                  onClick={completePicking}
                  disabled={updateStatusMutation.isPending}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Complete
                </Button>
              </div>
            )}

            {pickList.status === "paused" && (
              <Button
                className="h-12 w-full bg-blue-600 hover:bg-blue-700"
                onClick={resumePicking}
                disabled={updateStatusMutation.isPending}
              >
                <Play className="mr-2 h-4 w-4" />
                Resume Picking
              </Button>
            )}

            {pickList.status === "done" && (
              <Button
                className="h-12 w-full bg-indigo-600 hover:bg-indigo-700"
                onClick={onOpenDeliveryNotes}
              >
                <PackageCheck className="mr-2 h-4 w-4" />
                Open Delivery Note
              </Button>
            )}

            {/* Scan Section */}
            {!currentItem ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Scan className="h-5 w-5 text-blue-600" />
                    Scan Item
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pickList.status !== "in_progress" && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        {pickList.status === "pending" && "Tap Start Picking to begin scanning."}
                        {pickList.status === "paused" &&
                          "Picking is paused. Tap Resume to continue."}
                        {pickList.status === "done" && "Picking is completed."}
                        {pickList.status === "cancelled" && "This pick list is cancelled."}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="barcode-scan" className="text-sm">
                      Barcode
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="barcode-scan"
                        placeholder={t("pasteQr")}
                        value={scannedCode}
                        onChange={(e) => setScannedCode(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleScan();
                          }
                        }}
                        className="flex-1"
                        autoFocus
                        disabled={pickList.status !== "in_progress"}
                      />
                      <Button
                        onClick={handleScan}
                        disabled={
                          updateItemsMutation.isPending ||
                          scanBusy ||
                          !scannedCode.trim() ||
                          pickList.status !== "in_progress"
                        }
                      >
                        Verify
                      </Button>
                    </div>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-white px-2 text-gray-500">OR</span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowCamera(true)}
                    disabled={pickList.status !== "in_progress"}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Use Camera
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      Item Verified
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={updateItemsMutation.isPending}
                      onClick={() => {
                        setCurrentItem(null);
                        setPickedQty(0);
                        setShortReason("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="font-medium">{currentItem.displayName}</p>
                  <div className="rounded-lg bg-blue-50 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-xs font-medium text-blue-900">Pick Location</span>
                    </div>
                    <div className="space-y-1 text-xs text-blue-800">
                      {currentItem.locationName ? (
                        <div>
                          Location:{" "}
                          <span className="font-semibold text-blue-900">
                            {currentItem.locationName}
                          </span>
                        </div>
                      ) : null}
                      {currentItem.batchCode ? (
                        <div>
                          Batch: <span className="tabular-nums">{currentItem.batchCode}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {currentItem.isMismatch && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        {t("confirmAlternative")}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Barcode</span>
                      <span className="font-medium tabular-nums">{currentItem.barcode || "—"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Required</span>
                      <span className="font-semibold text-blue-600">
                        {currentItem.requiredQty} {currentItem.uomLabel}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="picked-qty">Picked Quantity</Label>
                    <Input
                      id="picked-qty"
                      disabled={updateItemsMutation.isPending}
                      type="number"
                      inputMode={currentItem.isPackaged ? "numeric" : "decimal"}
                      min={currentItem.isPackaged ? 1 : 0.01}
                      max={currentItem.maxPickQty}
                      step={currentItem.isPackaged ? 1 : 0.01}
                      value={pickedQty}
                      onChange={(e) => setPickedQty(Number(e.target.value))}
                      className="h-12 text-center text-lg font-semibold"
                    />
                    {currentItem.isPackaged ? (
                      <p className="text-xs text-gray-500">
                        {t("wholePackagePickQuantity", { unit: currentItem.uomLabel })}
                      </p>
                    ) : null}
                  </div>

                  {pickedQty < currentItem.requiredQty && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="space-y-2">
                        <p className="text-sm font-medium">Partial pick - reason required</p>
                        <Select value={shortReason} onValueChange={setShortReason}>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Select reason..." />
                          </SelectTrigger>
                          <SelectContent>
                            {SHORT_REASON_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    className="h-12 w-full bg-green-600 hover:bg-green-700"
                    onClick={handleConfirmPick}
                    disabled={updateItemsMutation.isPending || pickList.status !== "in_progress"}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Confirm Pick
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Remaining Items */}
            {remainingLines.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>Remaining Items</span>
                    <Badge variant="secondary">{remainingLines.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {remainingLines.map((line) => (
                    <div
                      key={line.id}
                      className="flex items-center justify-between rounded-lg border bg-white p-3 hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">{line.displayName}</div>
                        <div className="text-xs text-gray-500">
                          Remaining: {Math.max(0, line.requiredQty - line.pickedQty)}{" "}
                          {line.uomLabel}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Picked Items */}
            {pickedLines.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Picked Items
                    </span>
                    <Badge className="bg-green-100 text-green-800">{pickedLines.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {pickedLines.map((line) => {
                    const skuText = getPickedSkuSummary(line.id);
                    return (
                      <div
                        key={line.id}
                        className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-3"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {line.displayName}
                          </div>
                          <div className="text-xs text-green-700">
                            Picked: {line.pickedQty} {line.uomLabel}
                            {skuText ? ` | ${skuText}` : ""}
                          </div>
                        </div>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {pickedLinesCount === totalLines && (
              <div className="rounded-lg border border-green-200 bg-green-50 py-8 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-green-600" />
                <p className="text-base font-semibold text-green-900">All Items Picked!</p>
                <p className="text-sm text-green-700">Ready to complete</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
