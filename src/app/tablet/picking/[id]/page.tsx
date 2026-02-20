"use client";

import { useMemo, useState } from "react";
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
  MapPin,
  Scan,
  Play,
  Pause,
  ChevronRight,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePickList, useUpdatePickListItems, useUpdatePickListStatus } from "@/hooks/usePickLists";

const SHORT_REASON_OPTIONS = [
  { value: "missing", label: "Missing" },
  { value: "damaged", label: "Damaged" },
  { value: "expired", label: "Expired" },
  { value: "blocked", label: "Blocked" },
];

const normalizeScanValue = (value: string) => value.trim().toLowerCase();

const extractScanCandidates = (rawScan: string) => {
  const cleaned = rawScan.trim();
  const values = new Set<string>();
  if (!cleaned) return values;

  values.add(cleaned);

  try {
    values.add(decodeURIComponent(cleaned));
  } catch {}

  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const keys = ["id", "itemId", "item", "itemCode", "sku", "skuCode", "code", "barcode"];
    for (const key of keys) {
      const candidate = parsed[key];
      if (typeof candidate === "string" && candidate.trim()) {
        values.add(candidate.trim());
      }
    }
  } catch {}

  for (const token of cleaned.split(/[\s|,;]+/g)) {
    if (token.trim()) values.add(token.trim());
  }

  return values;
};

const toNumber = (value: number | string | null | undefined) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

type LineView = {
  id: string;
  itemId: string;
  skuCode: string;
  displayName: string;
  requiredQty: number;
  pickedQty: number;
  status: string;
};

type ScannedItem = {
  lineId: string;
  stopId: string;
  locationCode: string;
  skuCode: string;
  matchedScanCode: string;
  requiredQty: number;
  pickedQty: number;
  shortReasonCode?: string;
  status: string;
};

const isLinePicked = (status: string) =>
  status === "picked_partial" || status === "picked_full" || status === "done";

export default function TabletPickingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pickListId = params.id as string;

  const { data: pickList, isLoading, error } = usePickList(pickListId);
  const updateItemsMutation = useUpdatePickListItems();
  const updateStatusMutation = useUpdatePickListStatus();

  const [scannedCode, setScannedCode] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [currentItem, setCurrentItem] = useState<ScannedItem | null>(null);
  const [pickedQty, setPickedQty] = useState<number>(0);
  const [shortReason, setShortReason] = useState("");

  const lines = useMemo<LineView[]>(() => {
    return (pickList?.pick_list_items || []).map((item) => {
      const allocatedQty = toNumber(item.allocated_qty);
      const pickedValue = toNumber(item.picked_qty);
      let status = "open";
      if (pickedValue > 0 && pickedValue >= allocatedQty) status = "picked_full";
      else if (pickedValue > 0) status = "picked_partial";

      return {
        id: item.id,
        itemId: item.item_id,
        skuCode: item.items?.sku || "",
        displayName: item.items?.item_name || item.items?.item_code || item.item_id,
        requiredQty: allocatedQty,
        pickedQty: pickedValue,
        status,
      };
    });
  }, [pickList?.pick_list_items]);

  const run = useMemo(() => {
    return {
      id: pickList?.id || pickListId,
      runCode: pickList?.pick_list_no || "Pick List",
      status: pickList?.status || "pending",
      stockRequest: {
        requestCode: pickList?.delivery_notes?.dn_no || "--",
        priority: "normal",
      },
      stops: [
        {
          id: "pick-stop-1",
          locationCode: "Pick Zone",
          sequenceNo: 1,
          lines,
        },
      ],
    };
  }, [pickList?.id, pickList?.pick_list_no, pickList?.status, pickList?.delivery_notes?.dn_no, pickListId, lines]);

  const processScan = async (code: string) => {
    if (pickList?.status !== "in_progress") {
      toast.error("Picking has not started. Start picking first.");
      return;
    }

    if (!code.trim()) {
      toast.error("Please enter or scan a SKU code");
      return;
    }

    const scanCandidates = extractScanCandidates(code);
    const normalizedCandidates = new Set(Array.from(scanCandidates).map(normalizeScanValue));

    let foundItem: ScannedItem | null = null;
    let alreadyPicked = false;

    for (const stop of run.stops) {
      const line = stop.lines.find((l) => {
        if (!l.skuCode) return false;
        const skuMatch = normalizedCandidates.has(normalizeScanValue(l.skuCode));
        return skuMatch && !isLinePicked(l.status);
      });

      if (line) {
        const matchedScanCode =
          Array.from(scanCandidates).find((candidate) => {
            const normalized = normalizeScanValue(candidate);
            return normalized === normalizeScanValue(line.skuCode);
          }) || line.skuCode;

        foundItem = {
          lineId: line.id,
          stopId: stop.id,
          locationCode: stop.locationCode,
          skuCode: line.skuCode,
          matchedScanCode,
          requiredQty: line.requiredQty,
          pickedQty: line.pickedQty,
          shortReasonCode: undefined,
          status: line.status,
        };
        break;
      }

      const alreadyPickedLine = stop.lines.find((l) => {
        if (!l.skuCode) return false;
        const skuMatch = normalizedCandidates.has(normalizeScanValue(l.skuCode));
        return skuMatch && isLinePicked(l.status);
      });
      if (alreadyPickedLine) {
        alreadyPicked = true;
      }
    }

    if (!foundItem) {
      if (alreadyPicked) {
        toast.error("Item is already picked in this pick list.");
      } else {
        toast.error("Item not found in current pick list.");
      }
      setScannedCode("");
      return;
    }

    setCurrentItem(foundItem);
    setPickedQty(foundItem.requiredQty);
    setShortReason("");
    setScannedCode("");
    toast.success("Item verified successfully");
  };

  const handleScan = async () => {
    await processScan(scannedCode);
  };

  const handleCameraScan = async (code: string) => {
    setShowCamera(false);
    await processScan(code);
  };

  const handleConfirmPick = async () => {
    if (!currentItem || !pickList) return;
    if (pickList.status !== "in_progress") {
      toast.error("Picking has not started. Start picking first.");
      return;
    }

    const requiredQty = currentItem.requiredQty;
    if (pickedQty < 0 || pickedQty > requiredQty) {
      toast.error(`Picked quantity must be between 0 and ${requiredQty}`);
      return;
    }

    if (pickedQty < requiredQty && !shortReason) {
      toast.error("Partial pick requires a reason");
      return;
    }

    try {
      await updateItemsMutation.mutateAsync({
        id: pickList.id,
        data: {
          items: [
            {
              pickListItemId: currentItem.lineId,
              pickedQty,
            },
          ],
        },
      });

      toast.success("Item picked successfully");
      setCurrentItem(null);
      setPickedQty(0);
      setShortReason("");
    } catch {
      toast.error("Failed to record pick");
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

  const totalLines = run.stops.reduce((sum, stop) => sum + stop.lines.length, 0);
  const pickedLinesCount = run.stops.reduce(
    (sum, stop) => sum + stop.lines.filter((l) => isLinePicked(l.status)).length,
    0
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <CameraScannerDialog
        open={showCamera}
        onOpenChange={setShowCamera}
        title="Scan SKU Barcode"
        onDetected={handleCameraScan}
      />

      <TabletHeader
        title="Picking"
        subtitle={run.runCode || "Pick List"}
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
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100">
                      <PackageCheck className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Pick Progress</div>
                      <div className="text-xs text-gray-500">{run.stockRequest.requestCode}</div>
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
                    style={{ width: `${totalLines > 0 ? (pickedLinesCount / totalLines) * 100 : 0}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            {pickList.status === "pending" && (
              <Button
                className="w-full h-12 bg-blue-600 hover:bg-blue-700"
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
                  className="flex-1 h-12"
                  onClick={pausePicking}
                  disabled={updateStatusMutation.isPending}
                >
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </Button>
                <Button
                  className="flex-1 h-12 bg-green-600 hover:bg-green-700"
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
                className="w-full h-12 bg-blue-600 hover:bg-blue-700"
                onClick={resumePicking}
                disabled={updateStatusMutation.isPending}
              >
                <Play className="mr-2 h-4 w-4" />
                Resume Picking
              </Button>
            )}

            {pickList.status === "done" && (
              <Button
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700"
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
                        {pickList.status === "paused" && "Picking is paused. Tap Resume to continue."}
                        {pickList.status === "done" && "Picking is completed."}
                        {pickList.status === "cancelled" && "This pick list is cancelled."}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="sku-scan" className="text-sm">SKU / Barcode</Label>
                    <div className="flex gap-2">
                      <Input
                        id="sku-scan"
                        placeholder="Scan or enter SKU..."
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
                  <div className="rounded-lg bg-blue-50 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-medium text-blue-900">Pick Location</span>
                    </div>
                    <div className="text-sm font-semibold text-blue-900">{currentItem.locationCode}</div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">SKU Code</span>
                      <span className="font-mono font-medium">{currentItem.skuCode}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Required</span>
                      <span className="font-semibold text-blue-600">{currentItem.requiredQty} units</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="picked-qty">Picked Quantity</Label>
                    <Input
                      id="picked-qty"
                      type="number"
                      min={0}
                      max={currentItem.requiredQty}
                      step="0.01"
                      value={pickedQty}
                      onChange={(e) => setPickedQty(Number(e.target.value))}
                      className="h-12 text-lg font-semibold text-center"
                    />
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
                    className="w-full h-12 bg-green-600 hover:bg-green-700"
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
            {run.stops.map((stop) => {
              const remainingLines = stop.lines.filter((l) => !isLinePicked(l.status));
              if (remainingLines.length === 0) return null;

              return (
                <Card key={stop.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>Remaining Items</span>
                      <Badge variant="secondary">{remainingLines.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {remainingLines.map((line) => (
                      <div
                        key={line.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-white hover:bg-gray-50"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{line.displayName}</div>
                          <div className="text-xs text-gray-500">Qty: {line.requiredQty}</div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}

            {/* Picked Items */}
            {run.stops.map((stop) => {
              const pickedLines = stop.lines.filter((l) => isLinePicked(l.status));
              if (pickedLines.length === 0) return null;

              return (
                <Card key={`picked-${stop.id}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        Picked Items
                      </span>
                      <Badge className="bg-green-100 text-green-800">{pickedLines.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {pickedLines.map((line) => (
                      <div
                        key={line.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-green-200 bg-green-50"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{line.displayName}</div>
                          <div className="text-xs text-green-700">
                            Picked: {line.pickedQty} / {line.requiredQty}
                          </div>
                        </div>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}

            {pickedLinesCount === totalLines && (
              <div className="rounded-lg bg-green-50 border border-green-200 py-8 text-center">
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
