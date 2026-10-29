import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ReceivingDetailFooter } from "@/components/receiving/ReceivingDetailFooter";
import { ReceivingFooterButton } from "@/components/receiving/ReceivingFooterButton";
import { ReceivingProgressSummary } from "@/components/receiving/ReceivingProgressSummary";
import { getDeliveryNoteStage } from "@/components/receiving/receiving-stages";
import { Card, ErrorState, LoadingState, ScannerModal, Screen } from "@/components/ui";
import {
  useDeliveryNote,
  useReceivingWarehouses,
  useRecordDeliveryNoteReceivingScan,
  useResolveDeliveryNoteReceivingItem,
  useStartReceiving,
  useSubmitReceiving,
  useVoidDeliveryNoteReceivingException,
  useVoidDeliveryNoteReceivingScan,
} from "@/hooks/queries";
import { useScreenFocusState } from "@/hooks/useScreenFocusState";
import { useSunmiScanner } from "@/hooks/useSunmiScanner";
import { useAuthStore } from "@/stores/authStore";
import type {
  ReceivingLine,
  ReceivingUnexpectedItem,
  ReceivingUnexpectedItemStatus,
  RecordDeliveryNoteReceivingScanPayload,
} from "@/contracts/receiving";
import { colors } from "@/theme/colors";
import { spacing, borderRadius, shadows } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { formatDate } from "@/utils/format";
import { ApiError } from "@/api/client";
import {
  canAccessDeliveryNoteReceiving,
  canManageDeliveryNoteReceiving,
} from "@/utils/permissions";

const normalizeScanValue = (value: string) => value.trim().toLowerCase();
const keepReceivingDialogOpen = () => undefined;

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

type ScanConfirmation = {
  title: string;
  message: string;
  tone: "success" | "warning";
  payload: RecordDeliveryNoteReceivingScanPayload;
};

const toNumber = (value: unknown) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseScanUuid = (value: unknown) => {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleaned)
    ? cleaned
    : null;
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
      const itemId = parseScanUuid(parsed.itemId);
      const itemUnitOptionId = parseScanUuid(parsed.itemUnitOptionId ?? parsed.unitOptionId);
      const qtyRaw = parsed.qty ?? parsed.quantity ?? parsed.totalQty ?? parsed.boxQty;
      const qty = toNumber(qtyRaw);
      const batchNumber =
        typeof parsed.batchNumber === "string" && parsed.batchNumber.trim()
          ? parsed.batchNumber.trim()
          : null;
      const locationId = parseScanUuid(parsed.locationId ?? parsed.location);

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

const resolveLineFromScan = (
  lines: ReceivingLine[],
  rawScan: string,
  parsed: ParsedReceivingScan
) => {
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
      line.code,
      line.barcode,
      line.itemUnitOptionId,
    ]
      .filter(Boolean)
      .map((value) => normalizeScanValue(String(value)));
    return values.some((value) => candidates.includes(value));
  });
};

// A scan of an expected line is a receiving scan; an unexpected item is a receiving exception.
type ReceivingScanRecord = { kind: "scan" | "exception"; id: string };

type LastReceivingScan = {
  record: ReceivingScanRecord | null;
  itemName: string;
  scannedAt: string;
};

const LINE_ORDER: Record<string, number> = { short: 0, over: 1, pending: 2, exact: 3 };

const lineSortRank = (line: ReceivingLine) =>
  line.receivingStatus === "short" && line.receivedQty === 0
    ? LINE_ORDER.pending
    : (LINE_ORDER[line.receivingStatus] ?? LINE_ORDER.pending);

const describeReceivingLine = (line: ReceivingLine) => {
  if (line.receivingStatus === "exact") {
    return { text: "Complete", color: colors.statusSuccess, barColor: colors.statusSuccess };
  }
  if (line.receivingStatus === "over") {
    return {
      text: `Over by ${Math.abs(line.varianceQty)}`,
      color: colors.dangerDark,
      barColor: colors.dangerDark,
    };
  }
  if (line.receivedQty === 0) {
    return { text: "Not scanned", color: colors.textSecondary, barColor: colors.primaryDark };
  }
  return {
    text: `${line.allocatedQty - line.receivedQty} to go`,
    color: colors.textSecondary,
    barColor: colors.primaryDark,
  };
};

const UNEXPECTED_ITEM_STATUS: Record<
  ReceivingUnexpectedItemStatus,
  { text: string; color: string }
> = {
  pending_review: { text: "Needs review", color: colors.statusReview },
  accepted: { text: "Accepted", color: colors.statusSuccess },
  resolved: { text: "Resolved", color: colors.statusNeutral },
};

const formatScanTime = (value: string) =>
  new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value));

type ScanFailure = {
  title: string;
  message: string;
  tone: "warning" | "error";
  retryScan: string | null;
};

const SCAN_FAILURES_BY_CODE: Record<string, Omit<ScanFailure, "retryScan">> = {
  DELIVERY_NOTE_RECEIVING_FULL_QR_REQUIRED: {
    title: "Couldn't identify this item",
    message: "This looks like a box number. Scan the QR code on the box label.",
    tone: "warning",
  },
  DELIVERY_NOTE_RECEIVING_ITEM_NOT_FOUND: {
    title: "Item not recognized",
    message: "This label isn't in the item list. Set the box aside for review.",
    tone: "warning",
  },
  DELIVERY_NOTE_RECEIVING_AMBIGUOUS_ITEM: {
    title: "More than one item matches",
    message: "Scan the full QR code to pick the exact item.",
    tone: "warning",
  },
};

const CONNECTION_SCAN_FAILURE: Omit<ScanFailure, "retryScan"> = {
  title: "Couldn't check this scan",
  message: "Check the connection and try again.",
  tone: "error",
};

const describeScanFailure = (error: unknown, rawScan: string): ScanFailure => {
  if (error instanceof ApiError) {
    const known = error.code ? SCAN_FAILURES_BY_CODE[error.code] : undefined;
    if (known) return { ...known, retryScan: null };
    const isConnectionFailure =
      error.code === "DELIVERY_NOTE_RECEIVING_LOOKUP_FAILED" ||
      error.status >= 500 ||
      error.status === 408 ||
      error.status === 429;
    if (!isConnectionFailure) {
      return {
        title: "Scan not recorded",
        message: error.message,
        tone: "warning",
        retryScan: null,
      };
    }
  }
  return { ...CONNECTION_SCAN_FAILURE, retryScan: rawScan };
};

const scanValidationFailure = (message: string): ScanFailure => ({
  title: "Scan not recorded",
  message,
  tone: "warning",
  retryScan: null,
});

export default function ReceivingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isFocused = useScreenFocusState();
  const session = useAuthStore((state) => state.session);
  const canViewDeliveryNoteReceiving = canAccessDeliveryNoteReceiving(session);
  const canManageReceiving = canManageDeliveryNoteReceiving(session);
  const [discrepancyNotes, setDiscrepancyNotes] = useState("");
  const [receivingWarehouseId, setReceivingWarehouseId] = useState("");
  const [barcode, setBarcode] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanFailure, setScanFailure] = useState<ScanFailure | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [discrepancySheetOpen, setDiscrepancySheetOpen] = useState(false);
  const [scanConfirmation, setScanConfirmation] = useState<ScanConfirmation | null>(null);
  const [lastScan, setLastScan] = useState<LastReceivingScan | null>(null);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const discrepancyBackdropOpacity = useRef(new Animated.Value(0)).current;
  const hardwareScanBlockedRef = useRef(false);
  const scanMutationInFlightRef = useRef(false);
  const pendingScanConfirmationRef = useRef<ScanConfirmation | null>(null);
  const deliveryNote = useDeliveryNote(id, canViewDeliveryNoteReceiving && isFocused);
  const refetchDeliveryNote = deliveryNote.refetch;
  const receivingWarehouses = useReceivingWarehouses(
    isFocused && canManageReceiving && !deliveryNote.data?.receivingStartedAt
  );
  const startReceiving = useStartReceiving(id);
  const recordScan = useRecordDeliveryNoteReceivingScan(id);
  const resolveItem = useResolveDeliveryNoteReceivingItem(id);
  const voidScan = useVoidDeliveryNoteReceivingScan(id);
  const voidException = useVoidDeliveryNoteReceivingException(id);
  const submitReceiving = useSubmitReceiving(id);
  const isScanMutationPending =
    resolveItem.isPending || recordScan.isPending || voidScan.isPending || voidException.isPending;
  const isReceivingMutationPending = isScanMutationPending || submitReceiving.isPending;
  const isReceiving = deliveryNote.data?.status === "dispatched";
  const isReceived = deliveryNote.data?.status === "received";
  const isReceivingStarted = Boolean(deliveryNote.data?.receivingStartedAt);
  const receivingWarehouseOptions = receivingWarehouses.data || [];
  const effectiveReceivingWarehouseId =
    receivingWarehouseId ||
    (receivingWarehouseOptions.length === 1 ? receivingWarehouseOptions[0]?.id || "" : "");
  const showReceivingWarehousePicker = receivingWarehouseOptions.length > 1;

  const handleRefresh = useCallback(async () => {
    if (canViewDeliveryNoteReceiving) {
      await refetchDeliveryNote();
    }
  }, [canViewDeliveryNoteReceiving, refetchDeliveryNote]);

  useEffect(() => {
    if (!scanConfirmation && !discrepancySheetOpen && !isReceivingMutationPending) {
      hardwareScanBlockedRef.current = false;
    }
  }, [discrepancySheetOpen, isReceivingMutationPending, scanConfirmation]);

  useEffect(() => {
    if (!scanConfirmation) return;

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => subscription.remove();
  }, [scanConfirmation]);

  useEffect(() => {
    if (scanConfirmation) {
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [scanConfirmation, backdropOpacity]);

  useEffect(() => {
    if (discrepancySheetOpen) {
      Animated.timing(discrepancyBackdropOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(discrepancyBackdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [discrepancySheetOpen, discrepancyBackdropOpacity]);

  // Scanned units include confirmed unexpected items; the total is the dispatched quantity.
  const totals = useMemo(() => {
    const items = deliveryNote.data?.items || [];
    const unexpected = deliveryNote.data?.unexpectedItems || [];
    return {
      total: items.reduce((sum, item) => sum + item.allocatedQty, 0),
      scanned:
        items.reduce((sum, item) => sum + item.receivedQty, 0) +
        unexpected.reduce((sum, item) => sum + item.scannedQty, 0),
    };
  }, [deliveryNote.data]);
  const hasVariance = useMemo(
    () => Boolean(deliveryNote.data?.items.some((item) => item.receivedQty !== item.allocatedQty)),
    [deliveryNote.data]
  );
  const sortedLines = useMemo(
    () =>
      [...(deliveryNote.data?.items || [])].sort(
        (left, right) => lineSortRank(left) - lineSortRank(right)
      ),
    [deliveryNote.data]
  );
  const shortLineCount = sortedLines.filter((line) => line.receivedQty < line.allocatedQty).length;
  const overLineCount = sortedLines.filter((line) => line.receivedQty > line.allocatedQty).length;
  const unexpectedItems = deliveryNote.data?.unexpectedItems || [];
  const unexpectedItemCount = new Set(
    unexpectedItems.map((item) => `${item.itemId}:${item.itemUnitOptionId ?? ""}`)
  ).size;

  const submitReceivingWithNotes = async (notes: string) => {
    if (scanMutationInFlightRef.current) return;

    setSubmitError("");

    if (!isReceiving) {
      setSubmitError("This delivery note is no longer open for receiving.");
      return;
    }

    if (hasVariance && !notes.trim()) {
      setSubmitError("Enter discrepancy notes before submitting this delivery note.");
      return;
    }

    try {
      await submitReceiving.mutateAsync({
        receivedDate: new Date().toISOString().split("T")[0],
        acknowledgeDiscrepancy: hasVariance,
        discrepancyNotes: hasVariance ? notes.trim() : undefined,
      });
      setDiscrepancySheetOpen(false);
      setLastScan(null);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to submit receiving.");
    }
  };

  const handleSubmitReceiving = () => {
    if (scanMutationInFlightRef.current) return;

    setSubmitError("");

    if (!isReceiving) {
      setSubmitError("This delivery note is no longer open for receiving.");
      return;
    }

    if (hasVariance) {
      hardwareScanBlockedRef.current = true;
      setDiscrepancySheetOpen(true);
      return;
    }

    hardwareScanBlockedRef.current = true;
    void submitReceivingWithNotes("");
  };

  const openScanConfirmation = (confirmation: ScanConfirmation) => {
    hardwareScanBlockedRef.current = true;
    pendingScanConfirmationRef.current = confirmation;
    setScanConfirmation(confirmation);
  };

  const dismissScanConfirmation = () => {
    pendingScanConfirmationRef.current = null;
    setScanConfirmation(null);
    setBarcode("");
    setScanFailure(null);
  };

  const commitReceivingScan = async (
    payload: RecordDeliveryNoteReceivingScanPayload,
    closeConfirmationOnSuccess = false
  ) => {
    if (scanMutationInFlightRef.current) return;

    setScanFailure(null);
    scanMutationInFlightRef.current = true;
    try {
      const response = await recordScan.mutateAsync(payload);
      const scannedLine = response.deliveryNote.items.find(
        (line) => line.id === response.result.deliveryNoteItemId
      );
      const exceptionId = response.result.exceptionId;
      const unexpectedItem = exceptionId
        ? response.deliveryNote.unexpectedItems.find((item) =>
            item.exceptionIds.includes(exceptionId)
          )
        : undefined;
      const { scanId } = response.result;
      setLastScan({
        record: scanId
          ? { kind: "scan", id: scanId }
          : exceptionId
            ? { kind: "exception", id: exceptionId }
            : null,
        itemName: scannedLine?.name || unexpectedItem?.name || "Unexpected item",
        scannedAt: new Date().toISOString(),
      });
      setBarcode("");
      if (closeConfirmationOnSuccess) {
        pendingScanConfirmationRef.current = null;
        setScanConfirmation(null);
      }
    } catch (error) {
      setBarcode("");
      setScanFailure(describeScanFailure(error, payload.qrCode));
    } finally {
      scanMutationInFlightRef.current = false;
    }
  };

  const voidReceivingRecord = async (record: ReceivingScanRecord) => {
    if (
      scanMutationInFlightRef.current ||
      hardwareScanBlockedRef.current ||
      submitReceiving.isPending
    ) {
      return false;
    }

    scanMutationInFlightRef.current = true;
    setScanFailure(null);
    try {
      if (record.kind === "scan") {
        await voidScan.mutateAsync(record.id);
      } else {
        await voidException.mutateAsync(record.id);
      }
      if (lastScan?.record?.kind === record.kind && lastScan.record.id === record.id) {
        setLastScan(null);
      }
      return true;
    } catch (error) {
      setScanFailure({
        title: "Couldn't remove the scan",
        message:
          error instanceof Error
            ? error.message
            : "Could not reduce the scanned quantity. Refresh and try again.",
        tone: "error",
        retryScan: null,
      });
      return false;
    } finally {
      scanMutationInFlightRef.current = false;
    }
  };

  const decrementReceivingScan = async (item: ReceivingLine) => {
    if (!item.latestActiveScanId) return;
    await voidReceivingRecord({ kind: "scan", id: item.latestActiveScanId });
  };

  const decrementUnexpectedItem = async (item: ReceivingUnexpectedItem) => {
    await voidReceivingRecord({ kind: "exception", id: item.latestExceptionId });
  };

  const undoLastScan = async () => {
    if (!lastScan?.record) return;
    await voidReceivingRecord(lastScan.record);
  };

  const processScan = async (rawScan: string) => {
    if (
      hardwareScanBlockedRef.current ||
      scanMutationInFlightRef.current ||
      pendingScanConfirmationRef.current
    ) {
      return;
    }

    const cleaned = rawScan.trim();
    setScanFailure(null);

    if (!cleaned) {
      setScanFailure(scanValidationFailure("Enter or scan a QR code."));
      return;
    }

    if (!deliveryNote.data) return;

    if (deliveryNote.data.status !== "dispatched") {
      setScanFailure(scanValidationFailure("Only dispatched delivery notes can be received."));
      return;
    }

    const parsed = parseReceivingScan(cleaned);
    let matchedLine = resolveLineFromScan(deliveryNote.data.items, cleaned, parsed);
    const itemId = parsed.itemId || matchedLine?.itemId;
    const itemUnitOptionId = parsed.itemUnitOptionId || matchedLine?.itemUnitOptionId || null;
    const quantity = parsed.qty || 1;

    if (!parsed.boxId) {
      setBarcode("");
      setScanFailure({
        ...SCAN_FAILURES_BY_CODE.DELIVERY_NOTE_RECEIVING_FULL_QR_REQUIRED,
        retryScan: null,
      });
      return;
    }

    let payload: RecordDeliveryNoteReceivingScanPayload = {
      qrCode: parsed.qrCode,
      boxId: parsed.boxId,
      itemId,
      itemUnitOptionId,
      qty: quantity,
      batchNumber: parsed.batchNumber,
      locationId: parsed.locationId,
    };

    if (!matchedLine) {
      scanMutationInFlightRef.current = true;
      try {
        const identity = await resolveItem.mutateAsync(payload);
        payload = { ...payload, ...identity };
        matchedLine = resolveLineFromScan(deliveryNote.data.items, cleaned, {
          ...parsed,
          ...identity,
        });
      } catch (error) {
        setBarcode("");
        setScanFailure(describeScanFailure(error, cleaned));
        return;
      } finally {
        scanMutationInFlightRef.current = false;
      }
    }
    const isUnexpected = !matchedLine;
    const isOverage = matchedLine
      ? matchedLine.receivedQty + 1 > matchedLine.allocatedQty && matchedLine.allocatedQty > 0
      : false;

    if (isUnexpected) {
      openScanConfirmation({
        title: "Confirm unexpected item",
        message:
          "This scan does not match the delivery note items. Confirm only if you want to record it for receiving review.",
        tone: "warning",
        payload,
      });
      return;
    }

    if (isOverage) {
      openScanConfirmation({
        title: "Confirm overage",
        message:
          "This scan will put the item over the dispatched quantity. Confirm only if you want to record the overage.",
        tone: "warning",
        payload,
      });
      return;
    }

    await commitReceivingScan(payload);
  };

  useSunmiScanner({
    enabled:
      canManageReceiving &&
      isFocused &&
      isReceiving &&
      isReceivingStarted &&
      !scannerOpen &&
      !isScanMutationPending &&
      !scanConfirmation &&
      !discrepancySheetOpen &&
      !submitReceiving.isPending,
    onScan: processScan,
  });

  if (!canViewDeliveryNoteReceiving) {
    return (
      <Screen
        title="Delivery note"
        subtitle="Delivery note receiving"
        back
        onRefresh={handleRefresh}
        refreshing={deliveryNote.isRefetching}
      >
        <ErrorState message="You do not have permission to access receiving." />
      </Screen>
    );
  }

  const data = deliveryNote.data;
  const canScan = Boolean(isReceiving && isReceivingStarted && canManageReceiving);
  const varianceParts = [
    shortLineCount > 0
      ? `${shortLineCount} ${shortLineCount === 1 ? "line" : "lines"} short`
      : null,
    overLineCount > 0 ? `${overLineCount} ${overLineCount === 1 ? "line" : "lines"} over` : null,
    unexpectedItemCount > 0
      ? `${unexpectedItemCount} unexpected ${unexpectedItemCount === 1 ? "item" : "items"}`
      : null,
  ].filter((part): part is string => part !== null);
  const footer =
    data && isReceiving && canManageReceiving ? (
      !isReceivingStarted ? (
        <ReceivingDetailFooter
          note={
            startReceiving.error
              ? "Could not start receiving. Try again."
              : effectiveReceivingWarehouseId
                ? undefined
                : "Choose a receiving warehouse to start."
          }
          noteTone={startReceiving.error ? "error" : "neutral"}
        >
          <ReceivingFooterButton
            label={startReceiving.isPending ? "Starting..." : "Start receiving"}
            disabled={!effectiveReceivingWarehouseId || startReceiving.isPending}
            onPress={() => startReceiving.mutate(effectiveReceivingWarehouseId)}
          />
        </ReceivingDetailFooter>
      ) : (
        <ReceivingDetailFooter
          note={
            submitError
              ? submitError
              : totals.scanned === 0
                ? "Scan items to start counting."
                : varianceParts.length > 0
                  ? [
                      ...varianceParts,
                      hasVariance ? "you'll add a note when you submit" : "held for review",
                    ].join(" · ")
                  : "Every line matches."
          }
          noteTone={
            submitError
              ? "error"
              : totals.scanned === 0
                ? "neutral"
                : varianceParts.length > 0
                  ? "warning"
                  : "success"
          }
        >
          <ReceivingFooterButton
            label={submitReceiving.isPending ? "Submitting..." : "Submit receiving"}
            disabled={isReceivingMutationPending}
            onPress={handleSubmitReceiving}
          />
        </ReceivingDetailFooter>
      )
    ) : null;

  return (
    <View style={styles.screenRoot}>
      <Screen
        title={data?.code || "Delivery note"}
        subtitle={
          data?.sourceBusinessUnitName
            ? `Delivery note · Transfer from ${data.sourceBusinessUnitName}`
            : "Delivery note"
        }
        back
        onRefresh={handleRefresh}
        refreshing={deliveryNote.isRefetching}
        footer={footer}
      >
        {deliveryNote.isLoading ? <LoadingState /> : null}
        {deliveryNote.error ? <ErrorState message="Unable to load the delivery note." /> : null}
        {data ? (
          <>
            <ReceivingProgressSummary
              stage={getDeliveryNoteStage(data.status, data.receivingStartedAt)}
              done={totals.scanned}
              total={totals.total}
              unitLabel="units scanned"
              facts={[
                `${data.items.length} ${data.items.length === 1 ? "line" : "lines"}`,
                data.dispatchedAt ? `Dispatched ${formatDate(data.dispatchedAt)}` : null,
              ].filter((fact): fact is string => fact !== null)}
            />

            {isReceiving &&
            canManageReceiving &&
            !isReceivingStarted &&
            showReceivingWarehousePicker ? (
              <Card style={styles.warehouseCard}>
                <Text style={styles.warehouseLabel}>Receiving warehouse</Text>
                <View style={styles.warehouseOptions}>
                  {receivingWarehouseOptions.map((warehouse) => {
                    const isSelected = effectiveReceivingWarehouseId === warehouse.id;
                    return (
                      <Pressable
                        key={warehouse.id}
                        onPress={() => setReceivingWarehouseId(warehouse.id)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: isSelected }}
                        style={[
                          styles.warehouseOption,
                          isSelected && styles.warehouseOptionSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.warehouseOptionText,
                            isSelected && styles.warehouseOptionTextSelected,
                          ]}
                        >
                          {warehouse.code} - {warehouse.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Card>
            ) : null}

            {isReceived ? (
              <Card style={styles.receivedCard}>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.statusSuccess} />
                <View style={styles.receivedCardText}>
                  <Text style={styles.receivedTitle}>Receiving completed</Text>
                  <Text style={styles.receivedSubtitle}>
                    This delivery note has already been submitted.
                  </Text>
                </View>
              </Card>
            ) : null}

            {canScan ? (
              <View style={styles.scanCard}>
                <View style={styles.scanRow}>
                  <TextInput
                    value={barcode}
                    onChangeText={setBarcode}
                    onSubmitEditing={() => void processScan(barcode)}
                    placeholder="Scan or enter item QR"
                    placeholderTextColor={colors.textSecondary}
                    returnKeyType="done"
                    editable={!isReceivingMutationPending}
                    accessibilityLabel="Item QR code"
                    style={styles.scanInput}
                  />
                  {barcode.trim() ? (
                    <Pressable
                      onPress={() => void processScan(barcode)}
                      disabled={isReceivingMutationPending}
                      accessibilityRole="button"
                      style={styles.addButton}
                    >
                      <Text style={styles.addButtonText}>
                        {recordScan.isPending ? "Adding..." : "Add"}
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => setScannerOpen(true)}
                    disabled={isReceivingMutationPending}
                    accessibilityRole="button"
                    accessibilityLabel="Scan with camera"
                    style={({ pressed }) => [
                      styles.cameraButton,
                      pressed && !isReceivingMutationPending ? styles.cameraButtonPressed : null,
                    ]}
                  >
                    <Ionicons name="scan-outline" size={22} color={colors.surface} />
                  </Pressable>
                </View>
                {scanFailure ? (
                  <View
                    accessibilityRole="alert"
                    accessibilityLiveRegion="assertive"
                    style={[
                      styles.scanFailure,
                      scanFailure.tone === "error"
                        ? styles.scanFailureError
                        : styles.scanFailureWarning,
                    ]}
                  >
                    <View style={styles.scanFailureRow}>
                      <Ionicons
                        name={
                          scanFailure.tone === "error"
                            ? "refresh-circle-outline"
                            : "warning-outline"
                        }
                        size={20}
                        color={
                          scanFailure.tone === "error" ? colors.statusError : colors.statusWarning
                        }
                      />
                      <View style={styles.scanFailureText}>
                        <Text
                          style={[
                            styles.scanFailureTitle,
                            scanFailure.tone === "error"
                              ? styles.scanFailureInkError
                              : styles.scanFailureInkWarning,
                          ]}
                        >
                          {scanFailure.title}
                        </Text>
                        <Text
                          style={[
                            styles.scanFailureMessage,
                            scanFailure.tone === "error"
                              ? styles.scanFailureInkError
                              : styles.scanFailureInkWarning,
                          ]}
                        >
                          {scanFailure.message}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => setScanFailure(null)}
                        accessibilityRole="button"
                        accessibilityLabel="Dismiss"
                        style={styles.scanFailureDismiss}
                      >
                        <Ionicons
                          name="close"
                          size={18}
                          color={
                            scanFailure.tone === "error" ? colors.statusError : colors.statusWarning
                          }
                        />
                      </Pressable>
                    </View>
                    {scanFailure.retryScan ? (
                      <Pressable
                        onPress={() => {
                          const retryScan = scanFailure.retryScan;
                          if (retryScan) void processScan(retryScan);
                        }}
                        disabled={isReceivingMutationPending}
                        accessibilityRole="button"
                        style={styles.scanFailureRetry}
                      >
                        <Text style={[styles.scanFailureRetryText, styles.scanFailureInkError]}>
                          {isScanMutationPending ? "Trying..." : "Try again"}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : lastScan ? (
                  <View style={styles.lastScan} accessibilityLiveRegion="polite">
                    <Ionicons name="checkmark-circle" size={20} color={colors.statusSuccess} />
                    <View style={styles.lastScanText}>
                      <Text style={styles.lastScanTitle}>+1 {lastScan.itemName}</Text>
                      <Text style={styles.lastScanTime}>
                        Scanned {formatScanTime(lastScan.scannedAt)}
                      </Text>
                    </View>
                    {lastScan.record ? (
                      <Pressable
                        onPress={() => void undoLastScan()}
                        disabled={isReceivingMutationPending}
                        accessibilityRole="button"
                        accessibilityLabel={`Undo scan of ${lastScan.itemName}`}
                        style={styles.undoButton}
                      >
                        <Text style={styles.undoText}>Undo</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.scanHint}>
                    Use the scan trigger or camera. Each scan adds 1.
                  </Text>
                )}
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>Lines · {data.items.length}</Text>
            <View style={styles.lines}>
              {sortedLines.map((line, index) => {
                const status = describeReceivingLine(line);
                const progress =
                  line.allocatedQty > 0 ? Math.min(line.receivedQty / line.allocatedQty, 1) : 0;
                return (
                  <View
                    key={line.id}
                    style={[
                      styles.line,
                      index > 0 ? styles.lineDivider : null,
                      line.receivingStatus === "over" ? styles.lineOver : null,
                    ]}
                  >
                    <View style={styles.lineRow}>
                      <View style={styles.lineTitleBlock}>
                        <Text style={styles.lineName} numberOfLines={2}>
                          {line.name}
                        </Text>
                        <Text style={styles.lineMeta}>
                          {line.code} · {line.uom}
                        </Text>
                      </View>
                      <View style={styles.lineValueBlock}>
                        <Text style={styles.lineValue}>
                          {line.receivedQty} / {line.allocatedQty}
                        </Text>
                        <Text style={[styles.lineStatus, { color: status.color }]}>
                          {status.text}
                        </Text>
                      </View>
                      {canScan && line.receivedQty > 0 && line.latestActiveScanId ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Remove one scan of ${line.name}`}
                          onPress={() => void decrementReceivingScan(line)}
                          disabled={isReceivingMutationPending}
                          style={styles.decrementButton}
                        >
                          <Ionicons name="remove" size={20} color={colors.dangerDark} />
                        </Pressable>
                      ) : null}
                    </View>
                    <View style={styles.lineTrack}>
                      <View
                        style={[
                          styles.lineFill,
                          { width: `${progress * 100}%`, backgroundColor: status.barColor },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>

            {unexpectedItems.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>
                  Not on this delivery note · {unexpectedItems.length}
                </Text>
                <View style={styles.lines}>
                  {unexpectedItems.map((item, index) => {
                    const status = UNEXPECTED_ITEM_STATUS[item.status];
                    return (
                      <View
                        key={`${item.itemId}:${item.itemUnitOptionId ?? ""}:${item.status}`}
                        style={[styles.line, index > 0 ? styles.lineDivider : null]}
                      >
                        <View style={styles.lineRow}>
                          <View style={styles.lineTitleBlock}>
                            <Text style={styles.lineName} numberOfLines={2}>
                              {item.name}
                            </Text>
                            <Text style={styles.lineMeta}>
                              {item.code} · {item.uom}
                            </Text>
                          </View>
                          <View style={styles.lineValueBlock}>
                            <Text style={styles.lineValue}>{item.scannedQty} scanned</Text>
                            <Text style={[styles.lineStatus, { color: status.color }]}>
                              {status.text}
                            </Text>
                          </View>
                          {canScan && item.status === "pending_review" ? (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Remove one scan of ${item.name}`}
                              onPress={() => void decrementUnexpectedItem(item)}
                              disabled={isReceivingMutationPending}
                              style={styles.decrementButton}
                            >
                              <Ionicons name="remove" size={20} color={colors.dangerDark} />
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : null}
          </>
        ) : null}
        <ScannerModal
          visible={canManageReceiving && isReceivingStarted && scannerOpen}
          onClose={() => setScannerOpen(false)}
          onScan={(value) => {
            void processScan(value);
          }}
        />
        <Modal
          visible={canManageReceiving && discrepancySheetOpen}
          transparent
          animationType="slide"
          onRequestClose={keepReceivingDialogOpen}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.discrepancyRoot}
          >
            <Animated.View
              style={[
                styles.discrepancyBackdrop,
                {
                  opacity: discrepancyBackdropOpacity,
                },
              ]}
            />
            <SafeAreaView edges={["bottom"]} style={styles.discrepancySafeArea}>
              <View style={styles.discrepancySheet}>
                <View style={styles.discrepancyHandle} />
                <View style={styles.discrepancyIconCircle}>
                  <Ionicons name="alert-circle" size={40} color={colors.amberDark} />
                </View>
                <Text style={styles.discrepancyTitle}>Discrepancy notes</Text>
                <Text style={styles.discrepancyMessage}>
                  Add the shortage or overage reason before submitting this delivery note.
                </Text>
                <TextInput
                  value={discrepancyNotes}
                  onChangeText={setDiscrepancyNotes}
                  placeholder="Enter discrepancy reason or receiving notes..."
                  placeholderTextColor="#9B8FC4"
                  multiline
                  style={styles.discrepancyInput}
                  autoFocus
                />
                {submitError ? (
                  <Text style={styles.discrepancyErrorText}>{submitError}</Text>
                ) : null}
                <View style={styles.discrepancyActions}>
                  <Pressable
                    onPress={() => setDiscrepancySheetOpen(false)}
                    disabled={submitReceiving.isPending}
                    style={({ pressed }) => [
                      styles.discrepancyButton,
                      styles.discrepancyButtonSecondary,
                      submitReceiving.isPending && styles.discrepancyButtonDisabled,
                      pressed &&
                        !submitReceiving.isPending &&
                        styles.discrepancyButtonSecondaryPressed,
                    ]}
                  >
                    <Text style={styles.discrepancyButtonSecondaryText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void submitReceivingWithNotes(discrepancyNotes)}
                    disabled={submitReceiving.isPending}
                    style={({ pressed }) => [
                      styles.discrepancyButton,
                      styles.discrepancyButtonPrimary,
                      submitReceiving.isPending && styles.discrepancyButtonDisabled,
                      pressed && !submitReceiving.isPending && styles.discrepancyButtonPressed,
                    ]}
                  >
                    <Text style={styles.discrepancyButtonText}>
                      {submitReceiving.isPending ? "Submitting..." : "Submit"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </Modal>
      </Screen>
      {scanConfirmation ? (
        <View style={styles.confirmationRoot}>
          <Animated.View
            style={[
              styles.confirmationBackdrop,
              {
                opacity: backdropOpacity,
              },
            ]}
          />
          <SafeAreaView edges={["bottom"]} style={styles.confirmationSafeArea}>
            <View style={styles.confirmationSheet}>
              <View style={styles.confirmationHandle} />
              <View
                style={[
                  styles.confirmationIconCircle,
                  scanConfirmation?.tone === "warning"
                    ? styles.confirmationIconWarning
                    : styles.confirmationIconSuccess,
                ]}
              >
                <Ionicons
                  name={scanConfirmation?.tone === "warning" ? "alert-circle" : "checkmark-circle"}
                  size={40}
                  color={scanConfirmation?.tone === "warning" ? colors.amberDark : colors.greenDark}
                />
              </View>
              <Text style={styles.confirmationTitle}>{scanConfirmation?.title}</Text>
              <Text style={styles.confirmationMessage}>{scanConfirmation?.message}</Text>
              {scanFailure ? (
                <Text style={styles.scanErrorText} accessibilityLiveRegion="polite">
                  {scanFailure.title}. {scanFailure.message}
                </Text>
              ) : null}
              <View style={styles.confirmationActions}>
                <Pressable
                  onPress={dismissScanConfirmation}
                  disabled={recordScan.isPending}
                  style={({ pressed }) => [
                    styles.confirmationButton,
                    styles.confirmationButtonSecondary,
                    recordScan.isPending && styles.confirmationButtonDisabled,
                    pressed && !recordScan.isPending && styles.confirmationButtonSecondaryPressed,
                  ]}
                >
                  <Text style={styles.confirmationButtonSecondaryText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (scanConfirmation) {
                      void commitReceivingScan(scanConfirmation.payload, true);
                    }
                  }}
                  disabled={recordScan.isPending}
                  style={({ pressed }) => [
                    styles.confirmationButton,
                    styles.confirmationButtonPrimary,
                    scanConfirmation?.tone === "warning" && styles.confirmationButtonWarning,
                    recordScan.isPending && styles.confirmationButtonDisabled,
                    pressed && !recordScan.isPending && styles.confirmationButtonPressed,
                  ]}
                >
                  <Text style={styles.confirmationButtonText}>
                    {recordScan.isPending ? "Recording..." : "Confirm"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
  },
  warehouseCard: {
    gap: spacing.sm,
  },
  warehouseLabel: {
    fontSize: 13,
    fontWeight: typography.fontWeights.semibold,
    color: colors.statusNeutral,
  },
  warehouseOptions: {
    gap: spacing.sm,
  },
  warehouseOption: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  warehouseOptionSelected: {
    borderWidth: 2,
    borderColor: colors.primaryDark,
    backgroundColor: colors.primarySoft,
  },
  warehouseOptionText: {
    fontSize: 14,
    color: colors.text,
  },
  warehouseOptionTextSelected: {
    fontWeight: typography.fontWeights.semibold,
    color: colors.primaryDark,
  },
  receivedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  receivedCardText: {
    flex: 1,
    gap: 2,
  },
  receivedTitle: {
    fontSize: 15,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
  },
  receivedSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  scanCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  scanRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  scanInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.base,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 15,
    color: colors.text,
  },
  addButton: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.base,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primaryDark,
  },
  cameraButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.base,
    backgroundColor: colors.primaryDark,
  },
  cameraButtonPressed: {
    opacity: 0.85,
  },
  scanHint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  scanFailure: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    borderRadius: borderRadius.base,
    borderWidth: 1,
  },
  scanFailureWarning: {
    borderColor: colors.amber,
    backgroundColor: colors.amberSoft,
  },
  scanFailureError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  scanFailureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  scanFailureText: {
    flex: 1,
    gap: 2,
    paddingTop: 1,
  },
  scanFailureTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: typography.fontWeights.bold,
  },
  scanFailureMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
  scanFailureInkWarning: {
    color: colors.statusWarning,
  },
  scanFailureInkError: {
    color: colors.statusError,
  },
  scanFailureDismiss: {
    width: 44,
    height: 44,
    marginTop: -spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  scanFailureRetry: {
    alignSelf: "flex-start",
    minHeight: 44,
    marginLeft: 28,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.base,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.base,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.surface,
  },
  scanFailureRetryText: {
    fontSize: 14,
    fontWeight: typography.fontWeights.semibold,
  },
  scanErrorText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: typography.fontWeights.semibold,
    color: colors.dangerDark,
  },
  lastScan: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingLeft: spacing.md,
    borderRadius: borderRadius.base,
    backgroundColor: colors.greenSoft,
  },
  lastScanText: {
    flex: 1,
    gap: 1,
    paddingVertical: spacing.sm,
  },
  lastScanTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: typography.fontWeights.bold,
    color: colors.statusSuccess,
  },
  lastScanTime: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.statusSuccess,
  },
  undoButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  undoText: {
    fontSize: 13,
    fontWeight: typography.fontWeights.bold,
    color: colors.statusSuccess,
  },
  sectionTitle: {
    paddingHorizontal: spacing.xs,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: typography.fontWeights.semibold,
    color: colors.statusNeutral,
  },
  lines: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  line: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
  },
  lineDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  lineOver: {
    backgroundColor: colors.dangerSoft,
  },
  lineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  lineTitleBlock: {
    flex: 1,
    gap: 2,
  },
  lineName: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
  },
  lineMeta: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  lineValueBlock: {
    alignItems: "flex-end",
    gap: 2,
  },
  lineValue: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  lineStatus: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: typography.fontWeights.semibold,
  },
  decrementButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lineTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.backgroundSecondary,
    overflow: "hidden",
  },
  lineFill: {
    height: 4,
    borderRadius: 2,
  },
  discrepancyRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  discrepancyBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17, 24, 39, 0.5)",
  },
  discrepancySafeArea: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  discrepancySheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    alignItems: "center",
    ...shadows.xl,
  },
  discrepancyHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },
  discrepancyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    backgroundColor: colors.amberSoft,
  },
  discrepancyTitle: {
    fontSize: 20,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  discrepancyMessage: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  discrepancyInput: {
    width: "100%",
    minHeight: 100,
    maxHeight: 160,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    padding: spacing.md,
    textAlignVertical: "top",
    marginBottom: spacing.md,
  },
  discrepancyErrorText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.danger,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  discrepancyActions: {
    flexDirection: "row",
    width: "100%",
    gap: spacing.md,
  },
  discrepancyButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  discrepancyButtonPrimary: {
    backgroundColor: colors.primary,
    ...shadows.sm,
  },
  discrepancyButtonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  discrepancyButtonDisabled: {
    opacity: 0.5,
  },
  discrepancyButtonPressed: {
    opacity: 0.85,
  },
  discrepancyButtonSecondaryPressed: {
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.textSecondary,
  },
  discrepancyButtonText: {
    fontSize: 16,
    fontWeight: typography.fontWeights.semibold,
    color: "#fff",
  },
  discrepancyButtonSecondaryText: {
    fontSize: 16,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
  },
  confirmationRoot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    zIndex: 1,
    elevation: 1,
  },
  confirmationBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17, 24, 39, 0.5)",
  },
  confirmationSafeArea: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  confirmationSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    alignItems: "center",
    ...shadows.xl,
  },
  confirmationHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },
  confirmationIconCircle: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  confirmationIconSuccess: {
    backgroundColor: colors.greenSoft,
  },
  confirmationIconWarning: {
    backgroundColor: colors.amberSoft,
  },
  confirmationTitle: {
    fontSize: 20,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  confirmationMessage: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  confirmationActions: {
    flexDirection: "row",
    width: "100%",
    gap: spacing.md,
  },
  confirmationButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmationButtonPrimary: {
    backgroundColor: colors.primary,
    ...shadows.sm,
  },
  confirmationButtonWarning: {
    backgroundColor: colors.amberDark,
    ...shadows.sm,
  },
  confirmationButtonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  confirmationButtonDisabled: {
    opacity: 0.5,
  },
  confirmationButtonPressed: {
    opacity: 0.85,
  },
  confirmationButtonSecondaryPressed: {
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.textSecondary,
  },
  confirmationButtonText: {
    fontSize: 16,
    fontWeight: typography.fontWeights.semibold,
    color: "#fff",
  },
  confirmationButtonSecondaryText: {
    fontSize: 16,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
  },
});
