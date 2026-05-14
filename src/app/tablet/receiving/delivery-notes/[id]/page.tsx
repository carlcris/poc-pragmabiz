"use client";

import { useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronDown,
  FileText,
  RotateCcw,
  Scan,
  Send,
  XCircle,
} from "lucide-react";
import { TabletHeader } from "@/components/tablet/TabletHeader";
import { CameraScannerDialog } from "@/components/tablet/CameraScannerDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useAcceptDeliveryNoteReceivingException,
  useDeliveryNote,
  useRecordDeliveryNoteReceivingScan,
  useRejectDeliveryNoteReceivingException,
  useStartReceivingDeliveryNote,
  useSubmitDeliveryNoteReceiving,
  useVoidDeliveryNoteReceivingScan,
} from "@/hooks/useDeliveryNotes";
import type {
  DeliveryNoteItem,
  DeliveryNoteReceivingException,
  DeliveryNoteReceivingScan,
} from "@/types/delivery-note";
import type { ItemUnitOption } from "@/types/item";

const toNumber = (value: number | string | null | undefined) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const one = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

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
    const keys = ["id", "itemId", "item", "itemCode", "code", "barcode", "boxId", "box"];
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

type ParsedReceivingScan = {
  qrCode: string;
  boxId: string | null;
  itemId: string | null;
  itemUnitOptionId: string | null;
  qty: number | null;
  batchNumber: string | null;
  locationId: string | null;
};

const parseReceivingScan = (rawScan: string): ParsedReceivingScan => {
  const candidates = [rawScan.trim()];
  try {
    candidates.push(decodeURIComponent(rawScan.trim()));
  } catch {}

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      const boxId =
        typeof parsed.boxId === "string" && parsed.boxId.trim()
          ? parsed.boxId.trim()
          : typeof parsed.box === "string" && parsed.box.trim()
            ? parsed.box.trim()
            : typeof parsed.id === "string" && parsed.id.trim()
              ? parsed.id.trim()
              : null;
      const itemId =
        typeof parsed.itemId === "string" && parsed.itemId.trim() ? parsed.itemId.trim() : null;
      const itemUnitOptionId =
        typeof parsed.itemUnitOptionId === "string" && parsed.itemUnitOptionId.trim()
          ? parsed.itemUnitOptionId.trim()
          : typeof parsed.unitOptionId === "string" && parsed.unitOptionId.trim()
            ? parsed.unitOptionId.trim()
            : null;
      const qtyRaw = parsed.qty ?? parsed.quantity ?? parsed.totalQty ?? parsed.boxQty;
      const qty = toNumber(
        typeof qtyRaw === "string" || typeof qtyRaw === "number" ? qtyRaw : null
      );
      const batchNumber =
        typeof parsed.batchNumber === "string" && parsed.batchNumber.trim()
          ? parsed.batchNumber.trim()
          : null;
      const locationId =
        typeof parsed.locationId === "string" && parsed.locationId.trim()
          ? parsed.locationId.trim()
          : typeof parsed.location === "string" && parsed.location.trim()
            ? parsed.location.trim()
            : null;

      return {
        qrCode: candidate,
        boxId,
        itemId,
        itemUnitOptionId,
        qty: qty > 0 ? qty : null,
        batchNumber,
        locationId,
      };
    } catch {}
  }

  return {
    qrCode: rawScan.trim(),
    boxId: rawScan.trim() || null,
    itemId: null,
    itemUnitOptionId: null,
    qty: null,
    batchNumber: null,
    locationId: null,
  };
};

type ReceivingLine = {
  id: string;
  itemId: string;
  itemUnitOptionId: string | null;
  itemCode: string;
  itemName: string;
  suggestedBatchLocationSku: string;
  barcode: string;
  uomLabel: string;
  dispatchedQty: number;
  receivedQty: number;
  varianceQty: number;
  reviewStatus: "exact" | "short" | "over";
  activeScans: DeliveryNoteReceivingScan[];
};

export default function TabletDeliveryNoteReceivingPage() {
  const params = useParams();
  const router = useRouter();
  const deliveryNoteId = params.id as string;

  const { data: deliveryNote, isLoading, error } = useDeliveryNote(deliveryNoteId);
  const startReceivingMutation = useStartReceivingDeliveryNote();
  const recordScanMutation = useRecordDeliveryNoteReceivingScan();
  const voidScanMutation = useVoidDeliveryNoteReceivingScan();
  const submitReceivingMutation = useSubmitDeliveryNoteReceiving();
  const acceptExceptionMutation = useAcceptDeliveryNoteReceivingException();
  const rejectExceptionMutation = useRejectDeliveryNoteReceivingException();

  const [scanCode, setScanCode] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [discrepancyNotes, setDiscrepancyNotes] = useState("");
  const discrepancyNotesRef = useRef<HTMLTextAreaElement | null>(null);

  const lines = useMemo<ReceivingLine[]>(() => {
    return (deliveryNote?.delivery_note_items || []).map((item: DeliveryNoteItem) => {
      const itemRef = one(item.items);
      const uomRef = one(item.units_of_measure);
      const unitOption =
        one(item.item_unit_options as ItemUnitOption | ItemUnitOption[] | null | undefined) ||
        one(item.stock_request_items)?.item_unit_options;
      const option = one(unitOption as ItemUnitOption | ItemUnitOption[] | null | undefined);
      const activeScans = (item.delivery_note_item_receiving_scans || []).filter(
        (scan) => !scan.voided_at
      );

      const receivedQty = activeScans.length;
      const dispatchedQty = toNumber(item.dispatched_qty);
      const varianceQty = receivedQty - dispatchedQty;
      const reviewStatus = varianceQty === 0 ? "exact" : varianceQty < 0 ? "short" : "over";

      return {
        id: item.id,
        itemId: item.item_id,
        itemUnitOptionId: item.item_unit_option_id || option?.id || null,
        itemCode: itemRef?.item_code || item.item_id,
        itemName: itemRef?.item_name || itemRef?.item_code || item.item_id,
        suggestedBatchLocationSku: item.suggested_batch_location_sku || "",
        barcode: option?.barcode || "",
        uomLabel: option?.optionLabel || uomRef?.symbol || uomRef?.code || uomRef?.name || "Unit",
        dispatchedQty,
        receivedQty,
        varianceQty,
        reviewStatus,
        activeScans,
      };
    });
  }, [deliveryNote?.delivery_note_items]);

  const totals = useMemo(() => {
    const dispatched = lines.reduce((sum, line) => sum + line.dispatchedQty, 0);
    const received = lines.reduce((sum, line) => sum + line.receivedQty, 0);
    const short = lines.reduce((sum, line) => sum + Math.max(0, -line.varianceQty), 0);
    const over = lines.reduce((sum, line) => sum + Math.max(0, line.varianceQty), 0);
    const hasVariance = lines.some((line) => line.varianceQty !== 0);
    return { dispatched, received, short, over, hasVariance };
  }, [lines]);

  const handleStartReceiving = async () => {
    try {
      await startReceivingMutation.mutateAsync(deliveryNoteId);
      toast.success("Receiving started");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start receiving");
    }
  };

  const resolveLineFromScan = (rawScan: string, parsed: ParsedReceivingScan) => {
    if (parsed.itemId) {
      return lines.find((line) => {
        if (line.itemId !== parsed.itemId) return false;
        return !parsed.itemUnitOptionId || line.itemUnitOptionId === parsed.itemUnitOptionId;
      });
    }

    const candidates = Array.from(extractScanCandidates(rawScan)).map(normalizeScanValue);
    return lines.find((line) => {
      const values = [
        line.suggestedBatchLocationSku,
        line.itemId,
        line.itemCode,
        line.barcode,
        line.itemUnitOptionId,
      ]
        .filter(Boolean)
        .map((value) => normalizeScanValue(String(value)));
      return values.some((value) => candidates.includes(value));
    });
  };

  const processScan = async (rawScan: string) => {
    const cleaned = rawScan.trim();
    if (!cleaned) {
      toast.error("Please enter or scan a QR code");
      return;
    }
    if (!deliveryNote) return;
    if (deliveryNote.status !== "dispatched") {
      toast.error("Only dispatched delivery notes can be received");
      return;
    }

    const parsed = parseReceivingScan(cleaned);
    const matchedLine = resolveLineFromScan(cleaned, parsed);
    const itemId = parsed.itemId || matchedLine?.itemId;
    const itemUnitOptionId = parsed.itemUnitOptionId || matchedLine?.itemUnitOptionId || null;
    const quantity = parsed.qty || 1;

    if (!parsed.boxId) {
      toast.error("Scanned code did not include a box ID");
      return;
    }
    if (!quantity || quantity <= 0) {
      toast.error("Scanned code did not include a quantity");
      return;
    }

    try {
      const response = await recordScanMutation.mutateAsync({
        id: deliveryNoteId,
        data: {
          qrCode: parsed.qrCode,
          boxId: parsed.boxId,
          itemId,
          itemUnitOptionId,
          qty: quantity,
          batchNumber: parsed.batchNumber,
          locationId: parsed.locationId,
        },
      });

      setScanCode("");
      if (response.result.isUnexpected) {
        toast.warning("Unexpected item recorded for review");
      } else if (response.result.isOverReceived) {
        toast.warning("Item received with over-receipt noted");
      } else {
        toast.success("Item received");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record receiving scan");
    }
  };

  const handleVoidScan = async (scan: DeliveryNoteReceivingScan) => {
    try {
      await voidScanMutation.mutateAsync({
        id: deliveryNoteId,
        scanId: scan.id,
        reason: "Voided from tablet receiving",
      });
      toast.success("Scan voided");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to void scan");
    }
  };

  const handleSubmitReceiving = async () => {
    if (totals.hasVariance && !discrepancyNotes.trim()) {
      toast.error("Enter discrepancy notes before submitting");
      discrepancyNotesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      discrepancyNotesRef.current?.focus();
      return;
    }

    try {
      await submitReceivingMutation.mutateAsync({
        id: deliveryNoteId,
        data: {
          receivedDate: new Date().toISOString().split("T")[0],
          acknowledgeDiscrepancy: totals.hasVariance,
          discrepancyNotes: totals.hasVariance ? discrepancyNotes.trim() : undefined,
        },
      });
      toast.success("Delivery note received");
      router.push("/tablet/receiving");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit receiving");
    }
  };

  const getExceptionItemLabel = (exception: DeliveryNoteReceivingException) => {
    const itemRef = one(exception.items);
    const unitRef = one(exception.units_of_measure);
    const unitOption = one(exception.item_unit_options as ItemUnitOption | ItemUnitOption[] | null);
    return {
      itemName: itemRef?.item_name || itemRef?.item_code || exception.item_id,
      itemCode: itemRef?.item_code || exception.item_id,
      unitLabel: unitOption?.optionLabel || unitRef?.symbol || unitRef?.code || unitRef?.name || "Unit",
    };
  };

  const handleAcceptException = async (exceptionId: string) => {
    try {
      await acceptExceptionMutation.mutateAsync({
        id: deliveryNoteId,
        exceptionId,
        notes: "Accepted from tablet receiving review",
      });
      toast.success("Unexpected item accepted and posted to inventory");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to accept unexpected item");
    }
  };

  const handleRejectException = async (exceptionId: string) => {
    try {
      await rejectExceptionMutation.mutateAsync({
        id: deliveryNoteId,
        exceptionId,
        notes: "Rejected from tablet receiving review",
      });
      toast.success("Unexpected item rejected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject unexpected item");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <TabletHeader
          title="Loading..."
          subtitle="Delivery Note Receiving"
          showBack
          backHref="/tablet/receiving"
          warehouseName="Main Warehouse"
        />
        <div className="flex h-[calc(100vh-200px)] items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (error || !deliveryNote) {
    return (
      <div className="min-h-screen">
        <TabletHeader
          title="Error"
          subtitle="Delivery note not found"
          showBack
          backHref="/tablet/receiving"
          warehouseName="Main Warehouse"
        />
        <div className="flex h-[calc(100vh-200px)] flex-col items-center justify-center gap-4 p-6">
          <AlertCircle className="h-16 w-16 text-red-500" />
          <p className="text-lg text-red-600">Failed to load delivery note</p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  const exceptions = deliveryNote.delivery_note_receiving_exceptions || [];
  const pendingExceptions = exceptions.filter((item) => item.status === "pending_review");
  const canViewReceivingDetails = deliveryNote.can_view_receiving_details !== false;
  const isReceiving = deliveryNote.status === "dispatched";
  const canSubmit =
    canViewReceivingDetails &&
    isReceiving &&
    totals.received > 0 &&
    !submitReceivingMutation.isPending;

  return (
    <div className="min-h-screen bg-gray-50">
      <TabletHeader
        title={deliveryNote.dn_no}
        subtitle="Delivery Note Receiving"
        showBack
        backHref="/tablet/receiving"
        warehouseName="Destination Warehouse"
      />

      <CameraScannerDialog
        open={showCamera}
        onOpenChange={setShowCamera}
        onDetected={(value) => {
          setShowCamera(false);
          setScanCode(value);
          void processScan(value);
        }}
        title="Scan Receiving QR"
      />

      <div className="space-y-4 p-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gray-600" />
                  <span className="font-semibold text-gray-900">{deliveryNote.dn_no}</span>
                  <Badge variant={deliveryNote.status === "received" ? "default" : "secondary"}>
                    {deliveryNote.status.replace("_", " ")}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  Received {totals.received} of {totals.dispatched} items
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                {canViewReceivingDetails && isReceiving && !deliveryNote.receiving_started_at && (
                  <Button
                    onClick={handleStartReceiving}
                    disabled={startReceivingMutation.isPending}
                    variant="outline"
                  >
                    <Scan className="mr-2 h-4 w-4" />
                    Start Receiving
                  </Button>
                )}
                {canViewReceivingDetails && isReceiving && (
                  <Button onClick={handleSubmitReceiving} disabled={!canSubmit}>
                    <Send className="mr-2 h-4 w-4" />
                    Submit Receiving
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {!canViewReceivingDetails && (
          <Alert className="border-gray-200 bg-white">
            <AlertCircle className="h-4 w-4 text-gray-600" />
            <AlertDescription className="text-gray-700">
              Receiving details are only visible to the receiving business unit.
            </AlertDescription>
          </Alert>
        )}

        {canViewReceivingDetails && pendingExceptions.length > 0 && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-700" />
            <AlertDescription className="text-amber-800">
              {pendingExceptions.length} unexpected item scan
              {pendingExceptions.length === 1 ? "" : "s"} require review before they can be handled
              outside the normal delivery note receive posting.
            </AlertDescription>
          </Alert>
        )}

        {canViewReceivingDetails && exceptions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-700" />
                Unexpected Items
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {exceptions.map((exception) => {
                const labels = getExceptionItemLabel(exception);
                const isPending = exception.status === "pending_review";
                return (
                  <div
                    key={exception.id}
                    className="rounded-lg border border-amber-200 bg-amber-50 p-3"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-gray-900">{labels.itemName}</p>
                          <Badge variant={isPending ? "secondary" : "default"}>
                            {exception.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-gray-700">
                          {labels.itemCode} • {labels.unitLabel} • Qty {exception.accepted_qty}
                        </p>
                        <p className="mt-1 text-xs text-gray-600">
                          Box {exception.box_id} • {new Date(exception.scanned_at).toLocaleString()}
                        </p>
                        {exception.reason && (
                          <p className="mt-1 text-sm text-amber-900">{exception.reason}</p>
                        )}
                      </div>

                      {isPending && (
                        <div className="flex gap-2 md:justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRejectException(exception.id)}
                            disabled={
                              rejectExceptionMutation.isPending || acceptExceptionMutation.isPending
                            }
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleAcceptException(exception.id)}
                            disabled={
                              acceptExceptionMutation.isPending || rejectExceptionMutation.isPending
                            }
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Accept
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {canViewReceivingDetails && isReceiving && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scan className="h-5 w-5" />
                Receiving
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3 md:flex-row">
                <div className="flex-1">
                  <Label htmlFor="scan-code">QR / Barcode</Label>
                  <Input
                    id="scan-code"
                    value={scanCode}
                    onChange={(event) => setScanCode(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void processScan(scanCode);
                    }}
                    placeholder="Scan or paste item QR"
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2 md:items-end">
                  <Button variant="outline" onClick={() => setShowCamera(true)} className="flex-1">
                    <Camera className="mr-2 h-4 w-4" />
                    Scan
                  </Button>
                  <Button
                    onClick={() => processScan(scanCode)}
                    disabled={recordScanMutation.isPending}
                    className="flex-1"
                  >
                    <Scan className="mr-2 h-4 w-4" />
                    Verify
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {canViewReceivingDetails && totals.hasVariance && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-700" />
            <AlertDescription className="space-y-2 text-amber-900">
              <p className="font-semibold">
                Shortage or overage must be acknowledged before submit.
              </p>
              <Textarea
                ref={discrepancyNotesRef}
                value={discrepancyNotes}
                onChange={(event) => setDiscrepancyNotes(event.target.value)}
                placeholder="Enter discrepancy reason or receiving notes"
                rows={3}
                className="bg-white text-gray-900"
              />
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          {lines.map((line) => {
            const complete = line.receivedQty >= line.dispatchedQty && line.dispatchedQty > 0;
            return (
              <Card key={line.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {complete ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        ) : (
                          <Scan className="h-5 w-5 text-gray-500" />
                        )}
                        <h3 className="truncate font-semibold text-gray-900">{line.itemName}</h3>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        {line.itemCode} • {line.uomLabel}
                      </p>
                      {canViewReceivingDetails && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge
                            variant={line.reviewStatus === "exact" ? "default" : "secondary"}
                            className={
                              line.reviewStatus === "short"
                                ? "bg-amber-100 text-amber-900"
                                : line.reviewStatus === "over"
                                  ? "bg-red-100 text-red-900"
                                  : ""
                            }
                          >
                            {line.reviewStatus}
                          </Badge>
                          {line.varianceQty !== 0 && (
                            <span className="text-sm text-gray-600">
                              Variance {line.varianceQty > 0 ? "+" : ""}
                              {line.varianceQty}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-lg font-bold text-gray-900">
                        {line.receivedQty} / {line.dispatchedQty}
                      </p>
                      <p className="text-sm text-gray-600">received</p>
                    </div>
                  </div>

                  {line.activeScans.length > 0 && (
                    <details className="group mt-4 border-t pt-3">
                      <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-1 py-2 text-sm font-semibold text-gray-800">
                        <span>Scanned history ({line.activeScans.length})</span>
                        <ChevronDown className="h-4 w-4 text-gray-500 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="mt-2 space-y-2">
                        {line.activeScans.map((scan) => (
                          <div
                            key={scan.id}
                            className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium text-gray-900">{line.itemName}</p>
                              <p className="text-sm text-gray-600">
                                Scan count {scan.accepted_qty} • Box qty {scan.qr_qty} •{" "}
                                {new Date(scan.scanned_at).toLocaleTimeString()}
                              </p>
                            </div>
                            {isReceiving && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleVoidScan(scan)}
                                disabled={voidScanMutation.isPending}
                              >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Void
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
