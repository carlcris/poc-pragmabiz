import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from "react-native";
import { Card, ErrorState, LoadingState, ScannerModal, Screen } from "@/components/ui";
import { ActionFooter, type ActionFooterNoteTone } from "@/components/ActionFooter";
import { ActionFooterButton } from "@/components/ActionFooterButton";
import { PickLocationMapModal } from "@/components/picking/PickLocationMapModal";
import { ApiError } from "@/api/client";
import {
  claimPickListItem,
  releasePickListItem,
  resolvePickSource,
  type RecordPickProgressInput,
} from "@/api/picking";
import type { PickListItem, PickListItemClaim } from "@/contracts/picking";
import {
  useCompletePickList,
  usePickList,
  usePickListRealtime,
  useRecordPickProgress,
  useSetPickListStatus,
} from "@/hooks/queries";
import { useScreenFocusState } from "@/hooks/useScreenFocusState";
import { useSunmiScanner } from "@/hooks/useSunmiScanner";
import { sunmiScannerModule } from "@/native/sunmi-scanner";
import { useAuthStore } from "@/stores/authStore";
import {
  clearPendingPickConfirmation,
  loadPendingPickConfirmation,
  savePendingPickConfirmation,
  type PendingPickConfirmation,
} from "@/storage/pending-pick-confirmation-storage";
import { colors } from "@/theme/colors";
import { borderRadius, spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { primaryGlow, softShadow } from "@/theme/elevation";
import { canAccessPicking } from "@/utils/permissions";
import { createTranslator } from "use-intl/core";
import { translations } from "../../../../src/lib/i18n/translations";

// The native app currently uses English; reuse the web source of truth for new pick detail copy.
const tPickDetail = createTranslator({ locale: "en", messages: translations.en.mobilePickDetail });
const getStatusMeta = (status: string) => {
  switch (status) {
    case "in_progress":
      return { label: "In progress", color: colors.statusInfo };
    case "paused":
      return { label: "Paused", color: colors.statusWarning };
    case "done":
      return { label: "Completed", color: colors.statusSuccess };
    case "cancelled":
      return { label: "Cancelled", color: colors.statusError };
    case "pending":
    default:
      return { label: "Not started", color: colors.statusWarning };
  }
};

type ParsedBatchLocationQr = {
  batchLocationSku: string | null;
  itemId: string | null;
  locationId: string | null;
  batchCode: string | null;
};

type PickSource = {
  batchLocationSku: string | null;
  locationId: string | null;
  locationName: string | null;
  batchCode: string | null;
  batchReceivedAt: string | null;
  isMismatch: boolean;
};

type ScanFeedback = "match" | "mismatch" | "error";

// Android vibration patterns alternate wait/vibrate durations in milliseconds.
const SCAN_FEEDBACK_VIBRATION: Record<ScanFeedback, number | number[]> = {
  match: 60,
  mismatch: [0, 80, 120, 80],
  error: 400,
};

const signalScanFeedback = (feedback: ScanFeedback) => {
  Vibration.vibrate(SCAN_FEEDBACK_VIBRATION[feedback]);
};

const BATCH_LOCATION_SKU_PATTERN = /^\d{10}$/;
const HAS_HARDWARE_SCANNER = sunmiScannerModule !== null;

const parseBatchLocationQrPayload = (rawScan: string): ParsedBatchLocationQr | null => {
  const candidates = [rawScan.trim()];
  try {
    candidates.push(decodeURIComponent(rawScan.trim()));
  } catch {}

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      const batchLocationSku =
        typeof parsed.batchLocationSku === "string" && parsed.batchLocationSku.trim()
          ? parsed.batchLocationSku.trim()
          : null;
      const itemId =
        typeof parsed.itemId === "string" && parsed.itemId.trim() ? parsed.itemId.trim() : null;
      const locationId =
        typeof parsed.location === "string" && parsed.location.trim()
          ? parsed.location.trim()
          : null;
      const batchCode =
        typeof parsed.batchNumber === "string" && parsed.batchNumber.trim()
          ? parsed.batchNumber.trim()
          : null;

      if (batchLocationSku || itemId || locationId || batchCode) {
        return { batchLocationSku, itemId, locationId, batchCode };
      }
    } catch {}
  }

  return null;
};

const extractScannedSource = (rawScan: string) => {
  const raw = rawScan.trim();
  const parsedQr = parseBatchLocationQrPayload(raw);
  const batchLocationSku =
    parsedQr?.batchLocationSku && BATCH_LOCATION_SKU_PATTERN.test(parsedQr.batchLocationSku)
      ? parsedQr.batchLocationSku
      : BATCH_LOCATION_SKU_PATTERN.test(raw)
        ? raw
        : null;
  const hasSourceMetadata = Boolean(
    parsedQr?.batchLocationSku || parsedQr?.locationId || parsedQr?.batchCode
  );
  return { parsedQr, batchLocationSku, hasSourceMetadata };
};

const defaultPickSource = (item: PickListItem): PickSource => ({
  batchLocationSku: item.sourceSku,
  locationId: item.sourceLocationId,
  locationName: item.locationNamePath,
  batchCode: item.batchNumber,
  batchReceivedAt: item.sourceBatchReceivedAt,
  isMismatch: false,
});

const getAssignedLocationAddress = (item: PickListItem) => item.locationNamePath;

// Sort coded addresses naturally to keep nearby storage locations together.
const compareByPickLocation = (left: PickListItem, right: PickListItem) => {
  const leftCode = left.locationPath;
  const rightCode = right.locationPath;
  if (leftCode && rightCode) {
    const byLocation = leftCode.localeCompare(rightCode, undefined, { numeric: true });
    if (byLocation !== 0) return byLocation;
  } else if (leftCode || rightCode) {
    return leftCode ? -1 : 1;
  }
  return left.name.localeCompare(right.name);
};

const getRemainingQty = (item: PickListItem) => Math.max(0, item.requiredQty - item.pickedQty);

const roundQuantity = (value: number) => Math.round(value * 100) / 100;

const formatReceivedDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const createOperationId = () => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};

const CLAIM_REQUIRED_MESSAGE = "This item is no longer reserved for you";
const SHORT_PICK_SUMMARY_LIMIT = 5;

const formatShortPickSummary = (shortItems: PickListItem[]) => {
  const lines = shortItems
    .slice(0, SHORT_PICK_SUMMARY_LIMIT)
    .map((item) => `• ${item.name}: ${item.pickedQty} / ${item.requiredQty} ${item.uom}`);
  const hiddenCount = shortItems.length - SHORT_PICK_SUMMARY_LIMIT;
  if (hiddenCount > 0) lines.push(`and ${hiddenCount} more`);
  return lines.join("\n");
};

const isAmbiguousConfirmationError = (error: unknown) =>
  error instanceof ApiError && (error.status === 0 || error.status === 408 || error.status >= 500);

const isClaimRequiredError = (error: unknown) =>
  error instanceof ApiError && error.status === 400 && error.message === CLAIM_REQUIRED_MESSAGE;

export default function PickingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isFocused = useScreenFocusState();
  const session = useAuthStore((state) => state.session);
  const canViewPicking = canAccessPicking(session);
  const [mapPickListItemId, setMapPickListItemId] = useState<string | null>(null);
  const pickList = usePickList(id, canViewPicking && isFocused);
  usePickListRealtime(id, canViewPicking && isFocused && mapPickListItemId === null);
  const setStatus = useSetPickListStatus(id);
  const recordPickProgress = useRecordPickProgress(id);
  const completePickList = useCompletePickList(id);
  const [barcode, setBarcode] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [pickedItemsExpanded, setPickedItemsExpanded] = useState(false);
  const [verifiedItemId, setVerifiedItemId] = useState<string | null>(null);
  const [currentPickSource, setCurrentPickSource] = useState<PickSource | null>(null);
  const [pickedQtyText, setPickedQtyText] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingPickConfirmation | null>(
    null
  );
  const [claimClockMs, setClaimClockMs] = useState(() => Date.now());
  const pendingConfirmationRef = useRef<PendingPickConfirmation | null>(null);
  const confirmationInFlightRef = useRef(false);
  const recoveryAttemptedKeyRef = useRef<string | null>(null);
  const userId = session?.user.id || "";
  const businessUnitId = session?.currentBusinessUnit?.id || "";
  const effectiveStatus =
    setStatus.isPending && typeof setStatus.variables === "string"
      ? setStatus.variables
      : (pickList.data?.status ?? "pending");
  const statusMeta = getStatusMeta(effectiveStatus);
  const pickingActive = effectiveStatus === "in_progress";
  const canStartPicking = effectiveStatus === "pending" || effectiveStatus === "paused";

  const items = useMemo(() => pickList.data?.items || [], [pickList.data?.items]);
  const remaining = useMemo(
    () => items.filter((item) => item.pickedQty < item.requiredQty).sort(compareByPickLocation),
    [items]
  );
  const completed = useMemo(
    () => items.filter((item) => item.pickedQty >= item.requiredQty),
    [items]
  );
  const verifiedItem = items.find((item) => item.id === verifiedItemId) || null;
  const claims = pickList.data?.claims;
  const activeClaims = useMemo(
    () => (claims || []).filter((claim) => new Date(claim.expiresAt).getTime() > claimClockMs),
    [claimClockMs, claims]
  );
  const claimFor = (pickListItemId: string) =>
    activeClaims.find((claim) => claim.pickListItemId === pickListItemId);
  const claimedByOther = (pickListItemId: string) => {
    const claim = claimFor(pickListItemId);
    return claim && claim.claimedBy !== userId ? claim : null;
  };
  const nextPick = remaining.find((item) => !claimedByOther(item.pickListItemId)) || null;
  const upNext = remaining.filter((item) => item !== nextPick);
  const otherPickerClaim = activeClaims.find((claim) => claim.claimedBy !== userId) || null;
  const verifiedRemainingQty = verifiedItem ? getRemainingQty(verifiedItem) : 0;
  const pickedQtyValue = Number(pickedQtyText);
  const canConfirmPick =
    !!verifiedItem &&
    Number.isFinite(pickedQtyValue) &&
    pickedQtyValue > 0 &&
    pickedQtyValue <= verifiedRemainingQty &&
    !recordPickProgress.isPending;

  const clearVerifiedSelection = useCallback(() => {
    setVerifiedItemId(null);
    setCurrentPickSource(null);
    setPickedQtyText("");
    setOperationId(null);
    setBarcode("");
  }, []);

  const closeLocationMap = () => {
    setMapPickListItemId(null);
    void pickList.refetch();
  };

  const executePendingConfirmation = useCallback(
    async (pending: PendingPickConfirmation, renewBeforeSubmit: boolean) => {
      if (confirmationInFlightRef.current) return;
      confirmationInFlightRef.current = true;
      pendingConfirmationRef.current = pending;
      setPendingConfirmation(pending);
      setVerifyError("");

      try {
        if (renewBeforeSubmit) {
          await claimPickListItem(pending.pickListId, pending.payload.pickListItemId);
        }

        try {
          await recordPickProgress.mutateAsync(pending.payload);
        } catch (error) {
          if (!renewBeforeSubmit && isClaimRequiredError(error)) {
            await claimPickListItem(pending.pickListId, pending.payload.pickListItemId);
            await recordPickProgress.mutateAsync(pending.payload);
          } else {
            throw error;
          }
        }

        try {
          await clearPendingPickConfirmation(
            pending.userId,
            pending.pickListId,
            pending.payload.operationId
          );
        } catch {}
        pendingConfirmationRef.current = null;
        setPendingConfirmation(null);
        clearVerifiedSelection();
      } catch (error) {
        if (!isAmbiguousConfirmationError(error)) {
          try {
            await clearPendingPickConfirmation(
              pending.userId,
              pending.pickListId,
              pending.payload.operationId
            );
          } catch {}
          pendingConfirmationRef.current = null;
          setPendingConfirmation(null);
          void pickList.refetch();
        }
        setVerifyError(error instanceof Error ? error.message : "Failed to save pick progress.");
      } finally {
        confirmationInFlightRef.current = false;
      }
    },
    [clearVerifiedSelection, pickList, recordPickProgress]
  );

  const reconcilePendingConfirmation = useCallback(async () => {
    if (!userId || !businessUnitId || !id || confirmationInFlightRef.current) return;
    const pending =
      pendingConfirmationRef.current || (await loadPendingPickConfirmation(userId, id));
    if (!pending || pending.businessUnitId !== businessUnitId) return;

    pendingConfirmationRef.current = pending;
    setPendingConfirmation(pending);
    await executePendingConfirmation(pending, false);
  }, [businessUnitId, executePendingConfirmation, id, userId]);

  useEffect(() => {
    if (!pendingConfirmation || verifiedItemId || !pickList.data) return;
    const item = pickList.data.items.find(
      (candidate) => candidate.pickListItemId === pendingConfirmation.payload.pickListItemId
    );
    if (!item) return;

    setVerifiedItemId(item.id);
    setCurrentPickSource({
      batchLocationSku: pendingConfirmation.payload.batchLocationSku || item.sourceSku,
      locationId: pendingConfirmation.payload.pickedLocationId || item.sourceLocationId,
      locationName: item.locationNamePath,
      batchCode: pendingConfirmation.payload.pickedBatchCode || item.batchNumber,
      batchReceivedAt:
        pendingConfirmation.payload.pickedBatchReceivedAt || item.sourceBatchReceivedAt,
      isMismatch: pendingConfirmation.payload.isMismatchWarningAcknowledged === true,
    });
    setPickedQtyText(String(pendingConfirmation.payload.pickedQty));
    setOperationId(pendingConfirmation.payload.operationId);
  }, [pendingConfirmation, pickList.data, verifiedItemId]);

  useEffect(() => {
    if (!userId || !businessUnitId || !id) return;
    const recoveryKey = `${userId}:${businessUnitId}:${id}`;
    if (recoveryAttemptedKeyRef.current === recoveryKey) return;
    recoveryAttemptedKeyRef.current = recoveryKey;
    void reconcilePendingConfirmation();
  }, [businessUnitId, id, reconcilePendingConfirmation, userId]);

  useEffect(() => {
    const nextExpiryMs = (claims || []).reduce<number | null>((nearest, claim) => {
      const expiresAtMs = new Date(claim.expiresAt).getTime();
      if (!Number.isFinite(expiresAtMs) || expiresAtMs <= claimClockMs) return nearest;
      return nearest === null ? expiresAtMs : Math.min(nearest, expiresAtMs);
    }, null);

    if (nextExpiryMs === null) return;
    const timer = setTimeout(
      () => setClaimClockMs(Date.now()),
      Math.max(0, nextExpiryMs - Date.now() + 50)
    );
    return () => clearTimeout(timer);
  }, [claimClockMs, claims]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        setClaimClockMs(Date.now());
        void reconcilePendingConfirmation();
      }
    });
    return () => subscription.remove();
  }, [reconcilePendingConfirmation]);

  useEffect(() => {
    if (!verifiedItemId) return;

    const heartbeat = setInterval(() => {
      if (confirmationInFlightRef.current || pendingConfirmationRef.current) return;
      void claimPickListItem(id, verifiedItemId).catch((error) => {
        if (confirmationInFlightRef.current || pendingConfirmationRef.current) return;
        setVerifyError(error instanceof Error ? error.message : "Unable to reserve this item");
        setVerifiedItemId(null);
        setCurrentPickSource(null);
        setPickedQtyText("");
        setOperationId(null);
      });
    }, 45_000);

    return () => {
      clearInterval(heartbeat);
      if (!confirmationInFlightRef.current && !pendingConfirmationRef.current) {
        void releasePickListItem(id, verifiedItemId).catch(() => undefined);
      }
    };
  }, [id, verifiedItemId]);

  const rejectScan = (message: string) => {
    setVerifyError(message);
    signalScanFeedback("error");
  };

  const verifyBarcode = async (value = barcode) => {
    if (!pickingActive) {
      rejectScan("Start picking before scanning items.");
      return;
    }

    if (!value.trim() || !pickList.data) {
      rejectScan("Scan the QR code or enter its 10-digit code.");
      return;
    }

    setIsVerifying(true);
    setVerifyError("");

    try {
      const selectClaimedItem = async (match: PickListItem, source: PickSource) => {
        await claimPickListItem(pickList.data.id, match.pickListItemId);
        setVerifiedItemId(match.id);
        setCurrentPickSource(source);
        setPickedQtyText(String(getRemainingQty(match)));
        setOperationId(createOperationId());
        setBarcode("");
        setManualEntryOpen(false);
        signalScanFeedback(source.isMismatch ? "mismatch" : "match");
      };
      const { parsedQr, batchLocationSku, hasSourceMetadata } = extractScannedSource(value);

      if (hasSourceMetadata && !batchLocationSku) {
        rejectScan("Scanned QR code is incomplete or invalid.");
        return;
      }

      if (batchLocationSku) {
        const resolved = await resolvePickSource(pickList.data.id, {
          batchLocationSku,
          itemId: parsedQr?.itemId,
          locationId: parsedQr?.locationId,
          batchCode: parsedQr?.batchCode,
        });

        if (!resolved.line) {
          rejectScan("Scanned QR code is not on this pick list.");
          return;
        }

        const match =
          pickList.data.items.find((item) => item.id === resolved.line?.pickListItemId) || null;
        if (!match || match.pickedQty >= match.requiredQty) {
          rejectScan("This item is already fully picked.");
          return;
        }
        const otherClaim = claimedByOther(match.pickListItemId);
        if (otherClaim) {
          rejectScan(`${otherClaim.claimedByName} is picking this item.`);
          return;
        }

        await selectClaimedItem(match, {
          batchLocationSku: resolved.batchLocationSku,
          locationId: resolved.source.locationId,
          locationName: resolved.source.locationName || resolved.source.locationCode,
          batchCode: resolved.source.batchCode,
          batchReceivedAt: resolved.source.batchReceivedAt,
          isMismatch: resolved.isMismatch,
        });
        return;
      }

      rejectScan("Scan the QR code or enter its 10-digit code.");
    } catch (error) {
      rejectScan(error instanceof Error ? error.message : "Failed to verify scanned item.");
    } finally {
      setIsVerifying(false);
    }
  };

  const confirmPick = async () => {
    if (!verifiedItem || !userId || !businessUnitId) return;
    const quantityToAdd = Number(pickedQtyText);
    if (!Number.isFinite(quantityToAdd) || quantityToAdd <= 0) return;

    const source = currentPickSource || defaultPickSource(verifiedItem);
    if (!operationId) return;

    const existingPending = pendingConfirmationRef.current;
    if (existingPending?.payload.operationId === operationId) {
      await executePendingConfirmation(existingPending, false);
      return;
    }

    const payload: RecordPickProgressInput = {
      pickListItemId: verifiedItem.pickListItemId,
      operationId,
      pickedQty: quantityToAdd,
      batchLocationSku: source.batchLocationSku,
      pickedLocationId: source.locationId,
      pickedBatchCode: source.batchCode,
      pickedBatchReceivedAt: source.batchReceivedAt,
      isMismatchWarningAcknowledged: source.isMismatch,
      mismatchReason: source.isMismatch ? "ALTERNATIVE_BATCH_LOCATION_SKU" : null,
    };
    const pending: PendingPickConfirmation = {
      version: 1,
      userId,
      businessUnitId,
      pickListId: id,
      createdAt: new Date().toISOString(),
      payload,
    };

    pendingConfirmationRef.current = pending;
    setPendingConfirmation(pending);
    try {
      await savePendingPickConfirmation(pending);
    } catch (error) {
      pendingConfirmationRef.current = null;
      setPendingConfirmation(null);
      setVerifyError(error instanceof Error ? error.message : "Failed to save pick progress.");
      return;
    }

    await executePendingConfirmation(pending, true);
  };

  // Re-scanning the verified QR code confirms the pick at the shown quantity.
  const confirmFromRescan = (value: string) => {
    if (!verifiedItem || pendingConfirmationRef.current) return;
    const source = currentPickSource || defaultPickSource(verifiedItem);
    const { batchLocationSku } = extractScannedSource(value);

    if (!batchLocationSku || batchLocationSku !== source.batchLocationSku) {
      rejectScan("This QR code is for a different pick. Cancel to switch items.");
      return;
    }
    if (source.isMismatch) {
      rejectScan("Use the button below to confirm picking from a different batch.");
      return;
    }
    if (!canConfirmPick) {
      rejectScan("Check the quantity before confirming.");
      return;
    }
    void confirmPick();
  };

  useSunmiScanner({
    enabled:
      canViewPicking &&
      isFocused &&
      pickingActive &&
      !scannerOpen &&
      !isVerifying &&
      !pendingConfirmation &&
      mapPickListItemId === null,
    onScan: (value) => (verifiedItem ? confirmFromRescan(value) : verifyBarcode(value)),
  });

  const complete = () => {
    if (remaining.length === 0) {
      completePickList.mutate();
      return;
    }

    const lineLabel = remaining.length === 1 ? "line is" : "lines are";
    Alert.alert(
      "Complete with short picks?",
      `${remaining.length} ${lineLabel} not fully picked:\n\n${formatShortPickSummary(remaining)}\n\nCompleting closes this pick list with these lines short.`,
      [
        { text: "Keep picking", style: "cancel" },
        {
          text: "Complete anyway",
          style: "destructive",
          onPress: () => completePickList.mutate(),
        },
      ]
    );
  };

  const cancelVerifiedPick = () => {
    if (pendingConfirmationRef.current) return;
    setVerifiedItemId(null);
    setCurrentPickSource(null);
    setPickedQtyText("");
    setVerifyError("");
    setOperationId(null);
  };

  const adjustPickedQty = (delta: number) => {
    const current = Number(pickedQtyText);
    const next = roundQuantity((Number.isFinite(current) ? current : 0) + delta);
    setPickedQtyText(String(Math.min(verifiedRemainingQty, Math.max(0, next))));
  };

  if (!canViewPicking) {
    return (
      <Screen title="Picking" subtitle="Pick list detail" back>
        <ErrorState message="You do not have permission to access picking." />
      </Screen>
    );
  }

  const verifiedSource = verifiedItem ? currentPickSource || defaultPickSource(verifiedItem) : null;
  const statusErrorMessage = setStatus.error
    ? "Could not update the pick list status. Try again."
    : null;
  const completeErrorMessage = completePickList.error
    ? completePickList.error instanceof Error
      ? completePickList.error.message
      : "Unable to complete pick list."
    : null;
  const otherPickerItemName = otherPickerClaim
    ? items.find((item) => item.pickListItemId === otherPickerClaim.pickListItemId)?.name
    : undefined;
  const lineProgressPercent = items.length > 0 ? (completed.length / items.length) * 100 : 0;

  const activeFooterNote: { note: string; tone: ActionFooterNoteTone } = completeErrorMessage
    ? { note: completeErrorMessage, tone: "error" }
    : statusErrorMessage
      ? { note: statusErrorMessage, tone: "error" }
      : otherPickerClaim
        ? {
            note: `${otherPickerClaim.claimedByName} is picking ${otherPickerItemName ?? "an item"}. Pause and Finish unlock when they are done.`,
            tone: "neutral",
          }
        : remaining.length > 0
          ? {
              note: `${remaining.length} ${remaining.length === 1 ? "line" : "lines"} open`,
              tone: "warning",
            }
          : { note: "All lines picked", tone: "success" };

  const footer = !pickList.data ? null : verifiedItem && verifiedSource ? (
    <ActionFooter note={verifyError || undefined} noteTone="error">
      <ActionFooterButton
        label="Cancel"
        variant="secondary"
        disabled={!!pendingConfirmation}
        onPress={cancelVerifiedPick}
      />
      <ActionFooterButton
        label={
          recordPickProgress.isPending
            ? "Saving..."
            : pendingConfirmation
              ? "Retry confirm"
              : verifiedSource.isMismatch
                ? `Pick from ${verifiedSource.batchCode ?? "this batch"} instead`
                : `Confirm ${pickedQtyText || "0"} ${verifiedItem.uom}`
        }
        variant={verifiedSource.isMismatch ? "warning" : "success"}
        grow={2}
        disabled={!canConfirmPick}
        onPress={() => void confirmPick()}
      />
    </ActionFooter>
  ) : pickingActive ? (
    <ActionFooter note={activeFooterNote.note} noteTone={activeFooterNote.tone}>
      <ActionFooterButton
        label="Pause"
        variant="secondary"
        disabled={setStatus.isPending || activeClaims.length > 0 || !!pendingConfirmation}
        onPress={() => setStatus.mutate("paused")}
      />
      <ActionFooterButton
        label={completePickList.isPending ? "Finishing..." : "Finish"}
        variant={remaining.length === 0 ? "success" : "secondary"}
        disabled={
          completePickList.isPending ||
          setStatus.isPending ||
          recordPickProgress.isPending ||
          activeClaims.length > 0 ||
          !!pendingConfirmation
        }
        onPress={complete}
      />
    </ActionFooter>
  ) : canStartPicking ? (
    <ActionFooter note={statusErrorMessage ?? undefined} noteTone="error">
      <ActionFooterButton
        label={
          setStatus.isPending
            ? "Starting..."
            : effectiveStatus === "paused"
              ? "Resume picking"
              : "Start picking"
        }
        disabled={setStatus.isPending}
        onPress={() => setStatus.mutate("in_progress")}
      />
    </ActionFooter>
  ) : null;

  return (
    <Screen
      title={pickList.data?.code || "Pick List"}
      subtitle={
        pickList.data?.deliveryNoteCode
          ? `Delivery note ${pickList.data.deliveryNoteCode}`
          : "Pick list"
      }
      back
      onRefresh={async () => {
        await pickList.refetch();
      }}
      refreshing={pickList.isRefetching}
      footer={footer}
    >
      {pickList.isLoading ? <LoadingState /> : null}
      {pickList.error ? <ErrorState message="Unable to load the pick list." /> : null}
      {pickList.data ? (
        <>
          <View style={styles.progressBlock}>
            <View style={styles.progressRow}>
              <Text style={[styles.statusText, { color: statusMeta.color }]}>
                {statusMeta.label}
              </Text>
              <Text style={styles.lineProgressText}>
                <Text style={styles.lineProgressCount}>{completed.length}</Text> of {items.length}{" "}
                lines
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${lineProgressPercent}%` }]} />
            </View>
          </View>

          {verifiedItem && verifiedSource ? (
            <PickConfirmationPanel
              item={verifiedItem}
              source={verifiedSource}
              pickedQtyText={pickedQtyText}
              remainingQty={verifiedRemainingQty}
              confirmationPending={!!pendingConfirmation}
              onPickedQtyChange={setPickedQtyText}
              onAdjustPickedQty={adjustPickedQty}
              onViewLocation={() => setMapPickListItemId(verifiedItem.pickListItemId)}
            />
          ) : (
            <>
              {pickingActive ? (
                <ScannerStatusBar
                  isVerifying={isVerifying}
                  manualEntryOpen={manualEntryOpen}
                  disabled={!!pendingConfirmation}
                  onOpenCamera={() => setScannerOpen(true)}
                  onToggleManualEntry={() => setManualEntryOpen((open) => !open)}
                />
              ) : null}
              {pickingActive && verifyError ? <ScanErrorBanner message={verifyError} /> : null}
              {pickingActive && manualEntryOpen ? (
                <ManualLabelEntry
                  value={barcode}
                  isVerifying={isVerifying}
                  disabled={!!pendingConfirmation}
                  onChange={setBarcode}
                  onSubmit={() => void verifyBarcode()}
                />
              ) : null}
              {nextPick ? (
                <NextPickCard
                  item={nextPick}
                  remainingLineCount={remaining.length}
                  onViewLocation={() => setMapPickListItemId(nextPick.pickListItemId)}
                />
              ) : remaining.length === 0 ? (
                <Card style={styles.allPickedCard}>
                  <Ionicons name="checkmark-circle" size={28} color={colors.statusSuccess} />
                  <Text style={styles.allPickedText}>
                    {effectiveStatus === "done"
                      ? "Picking completed."
                      : "All lines picked. Finish to close this pick list."}
                  </Text>
                </Card>
              ) : null}
              {upNext.length > 0 ? (
                <UpNextList
                  items={upNext}
                  claims={activeClaims}
                  currentUserId={userId}
                  onViewLocation={setMapPickListItemId}
                />
              ) : null}
              {completed.length > 0 ? (
                <PickedItemsSection
                  items={completed}
                  expanded={pickedItemsExpanded}
                  onToggle={() => setPickedItemsExpanded((expanded) => !expanded)}
                />
              ) : null}
            </>
          )}
        </>
      ) : null}
      <ScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(value) => {
          void verifyBarcode(value);
        }}
      />
      <PickLocationMapModal
        visible={mapPickListItemId !== null}
        pickListId={id}
        pickListItemId={mapPickListItemId}
        onClose={closeLocationMap}
      />
    </Screen>
  );
}

const RecordedValue = ({ value, missingLabel }: { value: string | null; missingLabel: string }) =>
  value ? <Text>{value}</Text> : <Text style={styles.missingValue}>{missingLabel}</Text>;

const ScannerStatusBar = ({
  isVerifying,
  manualEntryOpen,
  disabled,
  onOpenCamera,
  onToggleManualEntry,
}: {
  isVerifying: boolean;
  manualEntryOpen: boolean;
  disabled: boolean;
  onOpenCamera: () => void;
  onToggleManualEntry: () => void;
}) => (
  <View style={[styles.scannerBar, isVerifying ? styles.scannerBarVerifying : null]}>
    {isVerifying ? (
      <ActivityIndicator size="small" color={colors.statusInfo} />
    ) : (
      <View
        style={[
          styles.scannerDot,
          { backgroundColor: HAS_HARDWARE_SCANNER ? colors.statusSuccess : colors.muted },
        ]}
      />
    )}
    <Text
      style={[styles.scannerText, isVerifying ? styles.scannerTextVerifying : null]}
      numberOfLines={1}
      accessibilityLiveRegion="polite"
    >
      {isVerifying
        ? "Checking QR code..."
        : HAS_HARDWARE_SCANNER
          ? "Scanner ready"
          : "Scan with the camera"}
    </Text>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Scan with camera"
      hitSlop={4}
      style={({ pressed }) => [styles.scannerAction, pressed ? styles.scannerActionPressed : null]}
      disabled={disabled}
      onPress={onOpenCamera}
    >
      <Ionicons
        name="camera-outline"
        size={24}
        color={disabled ? colors.textDisabled : colors.primaryDark}
      />
    </Pressable>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={manualEntryOpen ? "Hide code entry" : "Type QR code number"}
      accessibilityState={{ expanded: manualEntryOpen, disabled }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.scannerAction,
        manualEntryOpen ? styles.scannerActionActive : null,
        pressed ? styles.scannerActionPressed : null,
      ]}
      disabled={disabled}
      onPress={onToggleManualEntry}
    >
      <Ionicons
        name={manualEntryOpen ? "keypad" : "keypad-outline"}
        size={22}
        color={disabled ? colors.textDisabled : colors.primaryDark}
      />
    </Pressable>
  </View>
);

const ScanErrorBanner = ({ message }: { message: string }) => (
  <View style={styles.scanErrorBanner} accessibilityLiveRegion="assertive">
    <Ionicons name="close-circle" size={22} color={colors.statusError} />
    <Text style={styles.scanErrorText}>{message}</Text>
  </View>
);

const ManualLabelEntry = ({
  value,
  isVerifying,
  disabled,
  onChange,
  onSubmit,
}: {
  value: string;
  isVerifying: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) => {
  const submitDisabled = disabled || isVerifying || !value.trim();
  return (
    <Card style={styles.manualEntryCard}>
      <Text style={styles.fieldLabel}>QR code number</Text>
      <View style={styles.manualEntryRow}>
        <TextInput
          value={value}
          onChangeText={onChange}
          editable={!disabled}
          autoFocus
          keyboardType="number-pad"
          maxLength={10}
          placeholder="10-digit code"
          placeholderTextColor={colors.textSecondary}
          style={styles.manualEntryInput}
          onSubmitEditing={() => {
            if (!submitDisabled) onSubmit();
          }}
          returnKeyType="go"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: submitDisabled }}
          onPress={onSubmit}
          disabled={submitDisabled}
          style={[styles.verifyButton, submitDisabled ? styles.verifyButtonDisabled : null]}
        >
          <Text
            style={[
              styles.verifyButtonText,
              submitDisabled ? styles.verifyButtonTextDisabled : null,
            ]}
          >
            {isVerifying ? "Checking..." : "Verify"}
          </Text>
        </Pressable>
      </View>
    </Card>
  );
};

const NextPickCard = ({
  item,
  remainingLineCount,
  onViewLocation,
}: {
  item: PickListItem;
  remainingLineCount: number;
  onViewLocation: () => void;
}) => {
  const locationAddress = getAssignedLocationAddress(item);
  const sourceMeta = [
    item.sourceWarehouseCode,
    item.batchNumber ? `Batch ${item.batchNumber}` : null,
  ]
    .filter((segment): segment is string => Boolean(segment))
    .join(" · ");
  const remainingQty = getRemainingQty(item);
  const progress = item.requiredQty > 0 ? Math.min(item.pickedQty / item.requiredQty, 1) : 0;
  return (
    <View style={styles.nextPickCard}>
      <View style={styles.nextPickCircle} />
      <View style={styles.nextPickHeader}>
        <Text style={styles.nextPickLabel}>{tPickDetail("nextPick")}</Text>
        <Text style={styles.nextPickRemaining}>
          {tPickDetail("linesLeft", { count: remainingLineCount })}
        </Text>
      </View>
      <View style={styles.nextPickLocationRow}>
        <View style={styles.nextPickPin}>
          <Ionicons name="location-outline" size={24} color={colors.primary} />
        </View>
        <View style={styles.flexFill}>
          <Text style={styles.nextPickMeta}>{tPickDetail("location")}</Text>
          {locationAddress ? (
            <Text style={styles.nextPickLocation}>{locationAddress}</Text>
          ) : (
            <Text style={styles.nextPickLocationMissing}>Location not recorded</Text>
          )}
          {sourceMeta ? (
            <Text style={styles.nextPickMeta} numberOfLines={1}>
              {sourceMeta}
            </Text>
          ) : null}
        </View>
        {item.sourceLocationId ? (
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.nextPickMapButton,
              pressed && styles.scannerActionPressed,
            ]}
            onPress={onViewLocation}
          >
            <Ionicons name="map-outline" size={16} color={colors.primaryDark} />
            <Text style={styles.nextPickMapText}>{tPickDetail("map")}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.nextPickItemCard}>
        <View style={[styles.flexFill, styles.nextPickItemText]}>
          <Text style={styles.nextPickItemName}>{item.name}</Text>
          <View style={styles.nextPickItemTrack}>
            <View style={[styles.nextPickItemFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.nextPickMeta}>
            {item.pickedQty} of {item.requiredQty} {item.uom} picked
          </Text>
        </View>
        <View style={styles.nextPickQtyBox}>
          <Text style={styles.nextPickQtyLabel}>{tPickDetail("pickQuantity")}</Text>
          <Text style={styles.nextPickQty}>{remainingQty}</Text>
          <Text style={styles.nextPickQtyUom} numberOfLines={1}>
            {item.uom}
          </Text>
        </View>
      </View>
    </View>
  );
};

const UpNextList = ({
  items,
  claims,
  currentUserId,
  onViewLocation,
}: {
  items: PickListItem[];
  claims: PickListItemClaim[];
  currentUserId: string;
  onViewLocation: (pickListItemId: string) => void;
}) => (
  <View style={styles.listSection}>
    <Text style={styles.sectionLabel}>Up next</Text>
    <View style={styles.listSurface}>
      {items.map((item, index) => {
        const claim = claims.find(
          (candidate) =>
            candidate.pickListItemId === item.pickListItemId &&
            candidate.claimedBy !== currentUserId
        );
        const rowContent = (
          <>
            <Text style={styles.rowLocation} numberOfLines={1}>
              {getAssignedLocationAddress(item) ?? "—"}
            </Text>
            <Text style={styles.rowItemName} numberOfLines={2}>
              {item.name}
            </Text>
            {claim ? (
              <Text style={styles.rowReserved}>Reserved by {claim.claimedByName}</Text>
            ) : (
              <Text style={styles.rowQty}>
                {getRemainingQty(item)} {item.uom}
              </Text>
            )}
            {item.sourceLocationId ? (
              <Ionicons name="map-outline" size={18} color={colors.primaryDark} />
            ) : null}
          </>
        );
        const rowStyle = [styles.listRow, index > 0 ? styles.listRowDivider : null];
        return item.sourceLocationId ? (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`Show ${item.name} on map`}
            style={rowStyle}
            onPress={() => onViewLocation(item.pickListItemId)}
          >
            {rowContent}
          </Pressable>
        ) : (
          <View key={item.id} style={rowStyle}>
            {rowContent}
          </View>
        );
      })}
    </View>
  </View>
);

const PickedItemsSection = ({
  items,
  expanded,
  onToggle,
}: {
  items: PickListItem[];
  expanded: boolean;
  onToggle: () => void;
}) => (
  <View style={styles.listSection}>
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      style={styles.pickedToggle}
      onPress={onToggle}
    >
      <Text style={styles.pickedToggleText}>{items.length} picked</Text>
      <Ionicons
        name={expanded ? "chevron-up" : "chevron-down"}
        size={18}
        color={colors.primaryDark}
      />
    </Pressable>
    {expanded ? (
      <View style={styles.listSurface}>
        {items.map((item, index) => (
          <View key={item.id} style={[styles.listRow, index > 0 ? styles.listRowDivider : null]}>
            <Ionicons name="checkmark-circle" size={18} color={colors.statusSuccess} />
            <View style={styles.flexFill}>
              <Text style={styles.pickedItemName}>{item.name}</Text>
              <Text style={styles.secondaryText}>
                {getAssignedLocationAddress(item) ?? "—"} · {item.pickedQty} / {item.requiredQty}{" "}
                {item.uom}
              </Text>
            </View>
          </View>
        ))}
      </View>
    ) : null}
  </View>
);

const PickConfirmationPanel = ({
  item,
  source,
  pickedQtyText,
  remainingQty,
  confirmationPending,
  onPickedQtyChange,
  onAdjustPickedQty,
  onViewLocation,
}: {
  item: PickListItem;
  source: PickSource;
  pickedQtyText: string;
  remainingQty: number;
  confirmationPending: boolean;
  onPickedQtyChange: (value: string) => void;
  onAdjustPickedQty: (delta: number) => void;
  onViewLocation: () => void;
}) => {
  const receivedDate = formatReceivedDate(source.batchReceivedAt);
  const pickedQty = Number(pickedQtyText);
  const canDecrease = !confirmationPending && Number.isFinite(pickedQty) && pickedQty > 0;
  const canIncrease =
    !confirmationPending && (!Number.isFinite(pickedQty) || pickedQty < remainingQty);
  return (
    <>
      <View
        style={[
          styles.resultBanner,
          source.isMismatch ? styles.resultBannerWarning : styles.resultBannerSuccess,
        ]}
        accessibilityLiveRegion="polite"
      >
        <Ionicons
          name={source.isMismatch ? "warning" : "checkmark-circle"}
          size={24}
          color={source.isMismatch ? colors.statusWarning : colors.surface}
        />
        <Text
          style={[
            styles.resultBannerText,
            source.isMismatch ? styles.resultBannerTextWarning : null,
          ]}
        >
          {source.isMismatch ? "Different batch or location" : "QR code matches"}
        </Text>
      </View>

      <Card style={styles.confirmLocationCard}>
        {source.locationName ? (
          <Text style={styles.confirmLocation}>{source.locationName}</Text>
        ) : (
          <Text style={styles.nextPickLocationMissing}>Location not recorded</Text>
        )}
        <Text style={styles.secondaryText}>
          <RecordedValue
            value={source.batchCode ? `Batch ${source.batchCode}` : null}
            missingLabel="Batch not recorded"
          />
          {receivedDate ? ` · received ${receivedDate}` : ""}
        </Text>
        <Text style={styles.secondaryText}>
          QR code <RecordedValue value={source.batchLocationSku} missingLabel="not recorded" />
        </Text>
        <Text style={[styles.itemNameLarge, styles.confirmItemName]}>{item.name}</Text>
        <Pressable accessibilityRole="button" style={styles.mapButton} onPress={onViewLocation}>
          <Ionicons name="map-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.mapButtonText}>Show on map</Text>
        </Pressable>
      </Card>

      {source.isMismatch ? (
        <Card style={styles.comparisonCard}>
          <View style={styles.comparisonColumn}>
            <Text style={styles.sectionLabel}>Assigned</Text>
            <Text style={styles.comparisonValue}>
              <RecordedValue value={getAssignedLocationAddress(item)} missingLabel="Not recorded" />
            </Text>
            <Text style={styles.secondaryText}>
              <RecordedValue
                value={item.batchNumber ? `Batch ${item.batchNumber}` : null}
                missingLabel="Batch not recorded"
              />
            </Text>
          </View>
          <View style={styles.comparisonDivider} />
          <View style={styles.comparisonColumn}>
            <Text style={styles.sectionLabel}>Scanned</Text>
            <Text style={styles.comparisonValue}>
              <RecordedValue value={source.locationName} missingLabel="Not recorded" />
            </Text>
            <Text style={styles.secondaryText}>
              <RecordedValue
                value={source.batchCode ? `Batch ${source.batchCode}` : null}
                missingLabel="Batch not recorded"
              />
            </Text>
          </View>
        </Card>
      ) : null}

      <Card style={styles.quantityCard}>
        <Text style={styles.fieldLabel}>Quantity picked</Text>
        <View style={styles.stepperRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decrease quantity"
            accessibilityState={{ disabled: !canDecrease }}
            disabled={!canDecrease}
            style={styles.stepperButton}
            onPress={() => onAdjustPickedQty(-1)}
          >
            <Ionicons
              name="remove"
              size={28}
              color={canDecrease ? colors.text : colors.textDisabled}
            />
          </Pressable>
          <TextInput
            value={pickedQtyText}
            onChangeText={onPickedQtyChange}
            editable={!confirmationPending}
            keyboardType="decimal-pad"
            selectTextOnFocus
            accessibilityLabel="Quantity picked"
            style={styles.quantityInput}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Increase quantity"
            accessibilityState={{ disabled: !canIncrease }}
            disabled={!canIncrease}
            style={styles.stepperButton}
            onPress={() => onAdjustPickedQty(1)}
          >
            <Ionicons
              name="add"
              size={28}
              color={canIncrease ? colors.text : colors.textDisabled}
            />
          </Pressable>
        </View>
        <Text style={styles.secondaryText}>
          {item.uom} · {remainingQty} left on this line · tap the number to type
        </Text>
      </Card>
    </>
  );
};

const styles = StyleSheet.create({
  flexFill: { flex: 1 },
  progressBlock: { gap: spacing.sm },
  progressRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  statusText: { fontSize: 15, fontWeight: typography.fontWeights.semibold },
  lineProgressText: { fontSize: 15, color: colors.textSecondary },
  lineProgressCount: { color: colors.text, fontWeight: typography.fontWeights.bold },
  progressTrack: {
    height: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.violetFaint,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: colors.violet },
  scannerBar: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingLeft: spacing.base,
    paddingRight: spacing.xs,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surface,
    ...softShadow,
  },
  scannerBarVerifying: {
    borderColor: colors.statusInfo,
    backgroundColor: colors.blueSoft,
  },
  scannerDot: { width: 10, height: 10, borderRadius: 5 },
  scannerText: {
    flex: 1,
    fontSize: 16,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
  },
  scannerTextVerifying: { color: colors.statusInfo },
  scannerAction: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.full,
    backgroundColor: colors.violetSoft,
  },
  scannerActionActive: { backgroundColor: colors.violetLight },
  scannerActionPressed: { opacity: 0.6 },
  scanErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.base,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.statusError,
    backgroundColor: colors.dangerSoft,
  },
  scanErrorText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: typography.fontWeights.semibold,
    color: colors.statusError,
  },
  manualEntryCard: { gap: spacing.sm, padding: spacing.base },
  fieldLabel: {
    fontSize: 14,
    fontWeight: typography.fontWeights.semibold,
    color: colors.textSecondary,
  },
  manualEntryRow: { flexDirection: "row", gap: spacing.sm },
  manualEntryInput: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    fontSize: 18,
    fontWeight: typography.fontWeights.semibold,
    letterSpacing: 1,
    color: colors.text,
    backgroundColor: colors.background,
  },
  verifyButton: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...primaryGlow,
  },
  verifyButtonDisabled: {
    backgroundColor: colors.backgroundSecondary,
    shadowOpacity: 0,
    elevation: 0,
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: typography.fontWeights.semibold,
    color: colors.surface,
  },
  verifyButtonTextDisabled: { color: colors.textSecondary },
  nextPickCard: {
    overflow: "hidden",
    gap: 14,
    padding: spacing.base,
    borderRadius: 22,
    backgroundColor: colors.violetSoft,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 6,
  },
  nextPickCircle: {
    position: "absolute",
    right: -50,
    top: -70,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.violet,
    opacity: 0.12,
  },
  nextPickHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  nextPickLabel: {
    fontSize: 14,
    fontWeight: typography.fontWeights.bold,
    color: colors.primaryDark,
  },
  nextPickRemaining: {
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    fontSize: 12,
    fontWeight: typography.fontWeights.medium,
    color: colors.primaryDark,
  },
  nextPickLocationRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  nextPickPin: {
    width: 48,
    height: 48,
    borderRadius: spacing.base,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    ...softShadow,
  },
  nextPickLocation: {
    fontVariant: ["tabular-nums"],
    fontSize: 20,
    lineHeight: 26,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  nextPickLocationMissing: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: typography.fontWeights.bold,
    color: colors.statusWarning,
  },
  nextPickMeta: { fontSize: 12, lineHeight: 16, color: colors.textSecondary },
  nextPickMapButton: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    ...softShadow,
  },
  nextPickMapText: {
    fontSize: 13,
    fontWeight: typography.fontWeights.medium,
    color: colors.primaryDark,
  },
  nextPickItemCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: spacing.base,
    backgroundColor: colors.surface,
    ...softShadow,
  },
  nextPickItemText: { gap: spacing.sm },
  nextPickItemName: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
  },
  nextPickItemTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.violetFaint,
    overflow: "hidden",
  },
  nextPickItemFill: { height: 6, borderRadius: 3, backgroundColor: colors.violet },
  nextPickQtyBox: {
    width: 72,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: colors.primarySoft,
  },
  nextPickQtyLabel: { fontSize: 11, lineHeight: 14, color: colors.textSecondary },
  nextPickQty: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  nextPickQtyUom: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: typography.fontWeights.medium,
    color: colors.primaryDark,
  },
  secondaryText: { fontSize: 15, lineHeight: 20, color: colors.textSecondary },
  missingValue: { color: colors.statusWarning, fontWeight: typography.fontWeights.semibold },
  itemNameLarge: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
  },
  mapButton: {
    minHeight: 48,
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.violetSoft,
  },
  mapButtonText: {
    fontSize: 15,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primaryDark,
  },
  allPickedCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  allPickedText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
  },
  listSection: { gap: spacing.sm },
  sectionLabel: {
    fontSize: 13,
    fontWeight: typography.fontWeights.semibold,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textSecondary,
  },
  listSurface: {
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surface,
    overflow: "hidden",
    ...softShadow,
  },
  listRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  listRowDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  rowLocation: {
    width: 88,
    fontVariant: ["tabular-nums"],
    fontSize: 15,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  rowItemName: { flex: 1, fontSize: 15, lineHeight: 20, color: colors.text },
  rowQty: { fontSize: 15, fontWeight: typography.fontWeights.semibold, color: colors.text },
  rowReserved: {
    maxWidth: 120,
    fontSize: 14,
    fontWeight: typography.fontWeights.medium,
    color: colors.statusWarning,
  },
  pickedToggle: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    alignSelf: "flex-start",
  },
  pickedToggleText: {
    fontSize: 15,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primaryDark,
  },
  pickedItemName: { fontSize: 15, lineHeight: 20, color: colors.text },
  resultBanner: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    borderRadius: borderRadius.xl,
  },
  resultBannerSuccess: { backgroundColor: colors.statusSuccess },
  resultBannerWarning: {
    borderWidth: 2,
    borderColor: colors.statusWarning,
    backgroundColor: colors.amberSoft,
  },
  resultBannerText: {
    flex: 1,
    fontSize: 18,
    fontWeight: typography.fontWeights.semibold,
    color: colors.surface,
  },
  resultBannerTextWarning: { color: colors.statusWarning },
  confirmLocationCard: { gap: spacing.xs },
  confirmLocation: {
    fontVariant: ["tabular-nums"],
    fontSize: 32,
    lineHeight: 38,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  confirmItemName: { marginTop: spacing.sm },
  comparisonCard: { flexDirection: "row", gap: spacing.base },
  comparisonColumn: { flex: 1, gap: spacing.xs },
  comparisonDivider: { width: 1, backgroundColor: colors.border },
  comparisonValue: {
    fontVariant: ["tabular-nums"],
    fontSize: 18,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  quantityCard: { alignItems: "center", gap: spacing.md },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  stepperButton: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.violetSoft,
  },
  quantityInput: {
    minWidth: 120,
    paddingVertical: spacing.xs,
    fontSize: 48,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    textAlign: "center",
  },
});
