import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  ActionButton,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  ScannerModal,
  Screen,
} from "@/components/ui";
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
import { useSunmiScanner } from "@/hooks/useSunmiScanner";
import { useAuthStore } from "@/stores/authStore";
import {
  clearPendingPickConfirmation,
  loadPendingPickConfirmation,
  savePendingPickConfirmation,
  type PendingPickConfirmation,
} from "@/storage/pending-pick-confirmation-storage";
import { colors } from "@/theme/colors";
import { canAccessPicking } from "@/utils/permissions";

const normalizeScanValue = (value: string) => value.trim().toLowerCase();

const getStatusMeta = (status: string) => {
  switch (status) {
    case "in_progress":
      return { label: "In progress", hint: "Ready to scan items", dotColor: colors.primary };
    case "paused":
      return { label: "Paused", hint: "Tap Resume Picking to continue", dotColor: "#F59E0B" };
    case "done":
      return { label: "Completed", hint: "Picking completed", dotColor: colors.green };
    case "cancelled":
      return { label: "Cancelled", hint: "This pick list is cancelled", dotColor: colors.danger };
    case "pending":
    default:
      return { label: "Not started", hint: "Tap Start Picking to begin", dotColor: "#F59E0B" };
  }
};

const extractScanCandidates = (rawScan: string) => {
  const cleaned = rawScan.trim();
  const values = new Set<string>();
  if (!cleaned) return values;

  values.add(cleaned);

  try {
    values.add(decodeURIComponent(cleaned));
  } catch {}

  for (const candidate of Array.from(values)) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      const keys = ["id", "itemId", "item", "itemCode", "code", "barcode", "batchLocationSku"];
      for (const key of keys) {
        const value = parsed[key];
        if (typeof value === "string" && value.trim()) {
          values.add(value.trim());
        }
      }
    } catch {}
  }

  for (const token of cleaned.split(/[\s|,;]+/g)) {
    if (token.trim()) values.add(token.trim());
  }

  return values;
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

const defaultPickSource = (item: PickListItem): PickSource => ({
  batchLocationSku: item.sourceSku,
  locationId: item.sourceLocationId,
  locationName: item.locationName,
  batchCode: item.batchNumber,
  batchReceivedAt: item.sourceBatchReceivedAt,
  isMismatch: false,
});

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

const isAmbiguousConfirmationError = (error: unknown) =>
  error instanceof ApiError && (error.status === 0 || error.status === 408 || error.status >= 500);

const isClaimRequiredError = (error: unknown) =>
  error instanceof ApiError && error.status === 400 && error.message === CLAIM_REQUIRED_MESSAGE;

export default function PickingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((state) => state.session);
  const canViewPicking = canAccessPicking(session);
  const pickList = usePickList(id, canViewPicking);
  usePickListRealtime(id, canViewPicking);
  const setStatus = useSetPickListStatus(id);
  const recordPickProgress = useRecordPickProgress(id);
  const completePickList = useCompletePickList(id);
  const [barcode, setBarcode] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
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

  const totals = useMemo(() => {
    const items = pickList.data?.items || [];
    const pickedTotal = items.reduce((sum, item) => sum + item.pickedQty, 0);
    const requiredTotal = items.reduce((sum, item) => sum + item.requiredQty, 0);
    return { pickedTotal, requiredTotal };
  }, [pickList.data?.items]);

  const remaining = (pickList.data?.items || []).filter(
    (item) => item.pickedQty < item.requiredQty
  );
  const completed = (pickList.data?.items || []).filter(
    (item) => item.pickedQty >= item.requiredQty
  );
  const verifiedItem = pickList.data?.items.find((item) => item.id === verifiedItemId) || null;
  const claims = pickList.data?.claims;
  const activeClaims = useMemo(
    () => (claims || []).filter((claim) => new Date(claim.expiresAt).getTime() > claimClockMs),
    [claimClockMs, claims]
  );
  const claimFor = (pickListItemId: string) =>
    activeClaims.find((claim) => claim.pickListItemId === pickListItemId);
  const isClaimedByOther = (pickListItemId: string) => {
    const claim = claimFor(pickListItemId);
    return !!claim && claim.claimedBy !== session?.user.id;
  };
  const verifiedAlreadyPicked = verifiedItem?.pickedQty || 0;
  const verifiedRemainingQty = verifiedItem
    ? Math.max(0, verifiedItem.requiredQty - verifiedAlreadyPicked)
    : 0;
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
      locationName: item.locationName,
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

  const verifyBarcode = async (value = barcode) => {
    if (!pickingActive) {
      setVerifyError("Start picking before verifying items.");
      return;
    }

    const scanCandidates = extractScanCandidates(value);
    if (scanCandidates.size === 0 || !pickList.data) {
      setVerifyError("Please enter or scan a barcode.");
      return;
    }

    setIsVerifying(true);
    setVerifyError("");

    const normalizedCandidates = new Set(Array.from(scanCandidates).map(normalizeScanValue));

    try {
      const selectClaimedItem = async (match: PickListItem, source: PickSource) => {
        await claimPickListItem(pickList.data.id, match.pickListItemId);
        setVerifiedItemId(match.id);
        setCurrentPickSource(source);
        setPickedQtyText(String(Math.max(0, match.requiredQty - match.pickedQty)));
        setOperationId(createOperationId());
        setBarcode("");
      };
      const rawScanned = value.trim();
      const parsedQr = parseBatchLocationQrPayload(rawScanned);
      const scannedBatchLocationSku =
        parsedQr?.batchLocationSku && /^\d{10}$/.test(parsedQr.batchLocationSku)
          ? parsedQr.batchLocationSku
          : /^\d{10}$/.test(rawScanned)
            ? rawScanned
            : null;

      if (scannedBatchLocationSku) {
        const resolved = await resolvePickSource(pickList.data.id, {
          batchLocationSku: scannedBatchLocationSku,
          itemId: parsedQr?.itemId,
          locationId: parsedQr?.locationId,
          batchCode: parsedQr?.batchCode,
        });

        if (resolved?.line) {
          const resolvedMatch =
            pickList.data.items.find((item) => item.id === resolved.line?.pickListItemId) || null;
          const resolvedMatchPicked = resolvedMatch?.pickedQty || 0;
          const match =
            resolvedMatch &&
            resolvedMatchPicked < resolvedMatch.requiredQty &&
            !isClaimedByOther(resolvedMatch.pickListItemId)
              ? resolvedMatch
              : pickList.data.items.find((item) => {
                  return (
                    item.itemId === resolved.source.itemId &&
                    item.pickedQty < item.requiredQty &&
                    !isClaimedByOther(item.pickListItemId)
                  );
                }) || null;
          if (match) {
            const remainingQty = Math.max(0, match.requiredQty - match.pickedQty);
            if (remainingQty <= 0) {
              setVerifyError("Item is already picked in this pick list.");
              return;
            }

            const isMismatch =
              (match.sourceSku !== null && match.sourceSku !== resolved.batchLocationSku) ||
              (match.sourceLocationId !== null &&
                match.sourceLocationId !== resolved.source.locationId) ||
              (match.batchNumber !== null && match.batchNumber !== resolved.source.batchCode);
            await selectClaimedItem(match, {
              batchLocationSku: resolved.batchLocationSku,
              locationId: resolved.source.locationId,
              locationName: resolved.source.locationName || resolved.source.locationCode,
              batchCode: resolved.source.batchCode,
              batchReceivedAt: resolved.source.batchReceivedAt,
              isMismatch,
            });
            return;
          }
        }
      }

      const match = pickList.data.items.find((item) => {
        if (item.pickedQty >= item.requiredQty) return false;
        if (isClaimedByOther(item.pickListItemId)) return false;

        const directMatch = [item.itemId, item.code, item.barcode, item.sourceSku]
          .filter(Boolean)
          .some((candidate) => normalizedCandidates.has(normalizeScanValue(String(candidate))));
        return directMatch;
      });

      if (match) {
        const remainingQty = Math.max(0, match.requiredQty - match.pickedQty);
        if (remainingQty <= 0) {
          setVerifyError("Item is already picked in this pick list.");
          return;
        }

        await selectClaimedItem(match, defaultPickSource(match));
        return;
      }

      setVerifyError("Item not found");
    } catch (error) {
      setVerifyError(error instanceof Error ? error.message : "Failed to verify scanned item.");
    } finally {
      setIsVerifying(false);
    }
  };

  useSunmiScanner({
    enabled:
      canViewPicking &&
      pickingActive &&
      !scannerOpen &&
      !isVerifying &&
      !pendingConfirmation &&
      !verifiedItemId,
    onScan: verifyBarcode
  });

  if (!canViewPicking) {
    return (
      <Screen title="Picking" subtitle="Pick list detail" back>
        <ErrorState message="You do not have permission to access picking." />
      </Screen>
    );
  }

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
      mismatchReason: null,
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

  const complete = () => {
    completePickList.mutate();
  };

  return (
    <Screen title={pickList.data?.code || "Pick List"} subtitle="Pick and verify items">
      {pickList.isLoading ? <LoadingState /> : null}
      {pickList.error ? <ErrorState message="Unable to load the pick list." /> : null}
      {pickList.data ? (
        <>
          <View style={styles.progressContainer}>
            <View style={styles.headerRow}>
              <Text style={styles.pickListCode}>
                {pickList.data.deliveryNoteCode || pickList.data.code}
              </Text>
            </View>

            <View style={styles.dividerLine} />

            <View style={styles.statsRow}>
              <View style={styles.statColumnWrapper}>
                <View style={styles.statColumn}>
                  <Text style={styles.statValue}>{totals.pickedTotal}</Text>
                  <Text style={styles.statLabel}>PICKED</Text>
                </View>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statColumnWrapper}>
                <View style={styles.statColumn}>
                  <Text style={styles.statValue}>{totals.requiredTotal}</Text>
                  <Text style={styles.statLabel}>TOTAL</Text>
                </View>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statColumnWrapper}>
                <View style={styles.statColumn}>
                  <Text style={styles.statValue}>
                    {totals.requiredTotal > 0
                      ? Math.round((totals.pickedTotal / totals.requiredTotal) * 100)
                      : 0}
                    %
                  </Text>
                  <Text style={styles.statLabel}>PROGRESS</Text>
                </View>
              </View>
            </View>

            <View style={styles.dividerLine} />

            <View style={styles.statusRow}>
              <View style={styles.statusLeft}>
                <View style={[styles.statusDot, { backgroundColor: statusMeta.dotColor }]} />
                <Text style={styles.statusText}>{statusMeta.label}</Text>
              </View>
              <Text style={styles.statusHint}>{statusMeta.hint}</Text>
            </View>
          </View>

          {!pickingActive && effectiveStatus !== "done" && effectiveStatus !== "cancelled" ? (
            <ActionButton
              label={effectiveStatus === "paused" ? "Resume Picking" : "Start Picking"}
              icon="play-outline"
              disabled={setStatus.isPending}
              onPress={() => setStatus.mutate("in_progress")}
            />
          ) : null}

          {pickingActive ? (
            <View style={styles.actionRow}>
              <ActionButton
                label="Pause"
                icon="pause-outline"
                variant="secondary"
                onPress={() => setStatus.mutate("paused")}
                disabled={setStatus.isPending || activeClaims.length > 0 || !!pendingConfirmation}
                style={{ flex: 1 }}
              />
              <ActionButton
                label="Complete"
                icon="checkmark-circle-outline"
                variant="success"
                onPress={complete}
                disabled={
                  completePickList.isPending ||
                  setStatus.isPending ||
                  recordPickProgress.isPending ||
                  activeClaims.length > 0 ||
                  !!pendingConfirmation
                }
                style={{ flex: 1 }}
              />
            </View>
          ) : null}

          {verifiedItem ? (
            <VerifiedPanel
              item={verifiedItem}
              source={currentPickSource || defaultPickSource(verifiedItem)}
              error={verifyError}
              pickedQtyText={pickedQtyText}
              remainingQty={verifiedRemainingQty}
              canConfirm={canConfirmPick}
              confirmationPending={!!pendingConfirmation}
              onPickedQtyChange={setPickedQtyText}
              onCancel={() => {
                if (pendingConfirmationRef.current) return;
                setVerifiedItemId(null);
                setCurrentPickSource(null);
                setPickedQtyText("");
                setVerifyError("");
                setOperationId(null);
              }}
              onConfirm={confirmPick}
            />
          ) : (
            <Card style={styles.scanCard}>
              <View style={styles.scanHeader}>
                <Text style={styles.sectionTitle}>Scan item</Text>
                <Text style={styles.scanSubtitle}>Barcode or SKU</Text>
              </View>
              {!pickingActive ? (
                <View style={styles.disabledNotice}>
                  <Ionicons name="scan-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.notice}>
                    Start picking to enable scanning. Items will appear here once active.
                  </Text>
                </View>
              ) : null}
              <View style={styles.scanInputCombo}>
                <Ionicons
                  name="barcode-outline"
                  size={22}
                  color={pickingActive ? colors.primary : colors.textSecondary}
                />
                <TextInput
                  value={barcode}
                  onChangeText={setBarcode}
                  editable={pickingActive && !pendingConfirmation}
                  placeholder="Enter barcode or SKU..."
                  placeholderTextColor={colors.textSecondary}
                  style={styles.comboInput}
                  onSubmitEditing={() => {
                    if (barcode.trim()) void verifyBarcode();
                  }}
                  returnKeyType="search"
                />
                <Pressable
                  onPress={() => void verifyBarcode()}
                  disabled={
                    !pickingActive || !barcode.trim() || isVerifying || !!pendingConfirmation
                  }
                  style={[
                    styles.verifyButton,
                    (!pickingActive || !barcode.trim() || isVerifying || !!pendingConfirmation) &&
                      styles.verifyButtonDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.verifyButtonText,
                      (!pickingActive || !barcode.trim() || isVerifying || !!pendingConfirmation) &&
                        styles.verifyButtonTextDisabled,
                    ]}
                  >
                    {isVerifying ? "Checking..." : "Verify"}
                  </Text>
                </Pressable>
              </View>
              {verifyError ? <Text style={styles.scanErrorText}>{verifyError}</Text> : null}
              <ActionButton
                label="Use Camera"
                icon="camera-outline"
                disabled={!pickingActive || !!pendingConfirmation}
                onPress={() => setScannerOpen(true)}
              />
            </Card>
          )}

          {remaining.length > 0 ? (
            <ItemSection
              title="Remaining Items"
              items={remaining}
              claims={activeClaims}
              currentUserId={session?.user.id || ""}
            />
          ) : null}
          {completed.length > 0 ? (
            <ItemSection
              title="Picked Items"
              items={completed}
              claims={activeClaims}
              currentUserId={session?.user.id || ""}
            />
          ) : null}
        </>
      ) : null}
      <ScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(value) => {
          void verifyBarcode(value);
        }}
      />
    </Screen>
  );
}

const VerifiedPanel = ({
  item,
  source,
  error,
  pickedQtyText,
  remainingQty,
  canConfirm,
  confirmationPending,
  onPickedQtyChange,
  onCancel,
  onConfirm,
}: {
  item: PickListItem;
  source: PickSource;
  error: string;
  pickedQtyText: string;
  remainingQty: number;
  canConfirm: boolean;
  confirmationPending: boolean;
  onPickedQtyChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) => (
  <Card style={styles.verifiedCard}>
    <View style={styles.verifiedHeader}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Ionicons name="checkmark-circle-outline" size={20} color={colors.green} />
        <Text style={styles.sectionTitle}>Item Verified</Text>
      </View>
      <Pressable onPress={onCancel} disabled={confirmationPending}>
        <Text style={[styles.cancelText, confirmationPending ? { opacity: 0.5 } : null]}>
          Cancel
        </Text>
      </Pressable>
    </View>
    <View style={styles.pickLocation}>
      <Text style={styles.locationTitle}>Pick Location</Text>
      <Text style={styles.locationText}>Location: {source.locationName || "Main"}</Text>
      <Text style={styles.locationText}>Batch: {source.batchCode || "OPENING-BALANCE"}</Text>
      <Text style={styles.locationText}>
        Location SKU: {source.batchLocationSku || item.barcode || item.code}
      </Text>
    </View>
    {source.isMismatch ? (
      <View style={styles.sourceMismatchWarning}>
        <Ionicons name="warning-outline" size={18} color={colors.amberDark} />
        <Text style={styles.sourceMismatchWarningText}>
          Scanned batch/location does not match the suggested source. Confirm pick to override.
        </Text>
      </View>
    ) : null}
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>Barcode</Text>
      <Text style={styles.detailValue}>{item.barcode || item.code}</Text>
    </View>
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>Required</Text>
      <Text style={[styles.detailValue, { color: colors.primary }]}>
        {item.requiredQty} {item.uom}
      </Text>
    </View>
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>To pick</Text>
      <Text style={[styles.detailValue, { color: colors.amberDark }]}>
        {remainingQty} {item.uom}
      </Text>
    </View>
    <Text style={styles.label}>Picked Quantity</Text>
    <TextInput
      value={pickedQtyText}
      onChangeText={onPickedQtyChange}
      editable={!confirmationPending}
      keyboardType="decimal-pad"
      placeholder="Enter quantity"
      placeholderTextColor={colors.textSecondary}
      style={styles.quantityInput}
    />
    {error ? <Text style={styles.scanErrorText}>{error}</Text> : null}
    <ActionButton
      label="Confirm Pick"
      icon="checkmark-circle-outline"
      variant="success"
      disabled={!canConfirm}
      onPress={onConfirm}
    />
  </Card>
);

const ItemSection = ({
  title,
  items,
  claims,
  currentUserId,
}: {
  title: string;
  items: PickListItem[];
  claims: PickListItemClaim[];
  currentUserId: string;
}) => (
  <Card style={styles.itemSection}>
    <View style={styles.itemSectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCount}>
        <Text style={styles.sectionCountText}>{items.length}</Text>
      </View>
    </View>
    {items.length === 0 ? (
      <EmptyState title="No items" subtitle="There are no items in this section" />
    ) : (
      items.map((item) => {
        const pickedQty = item.pickedQty;
        const remainingQty = Math.max(0, item.requiredQty - pickedQty);
        const done = pickedQty >= item.requiredQty;
        const claim = claims.find(
          (candidate) =>
            candidate.pickListItemId === item.pickListItemId &&
            candidate.claimedBy !== currentUserId &&
            new Date(candidate.expiresAt).getTime() > Date.now()
        );
        return (
          <View
            key={item.id}
            style={[
              styles.itemRow,
              done ? styles.itemDone : null,
              claim ? styles.itemClaimed : null,
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={[styles.itemMeta, done ? styles.itemMetaDone : null]}>
                {done ? "Picked" : "To pick"}: {done ? pickedQty : remainingQty} {item.uom}
              </Text>
              <Text style={[styles.itemMetaDetail, done ? styles.itemMetaDone : null]}>
                Picked {pickedQty} / {item.requiredQty} {item.uom}
              </Text>
              {claim ? <Text style={styles.itemClaimedBy}>{claim.claimedByName}</Text> : null}
            </View>
            {claim ? (
              <Ionicons name="lock-closed-outline" size={18} color={colors.amberDark} />
            ) : done ? (
              <Ionicons name="checkmark-circle-outline" size={20} color={colors.green} />
            ) : (
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            )}
          </View>
        );
      })
    )}
  </Card>
);

const styles = StyleSheet.create({
  progressContainer: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
  },
  pickListCode: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  dateText: {
    fontSize: 13,
    fontWeight: "400",
    color: "#A0AEC0",
  },
  dividerLine: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 0,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
  },
  statColumnWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statColumn: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    width: "100%",
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#E2E8F0",
  },
  statValue: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1A202C",
    lineHeight: 32,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#A78BFA",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
  },
  statusLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F59E0B",
  },
  statusText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.text,
  },
  statusHint: {
    fontSize: 13,
    fontWeight: "400",
    color: "#A0AEC0",
  },
  actionRow: { flexDirection: "row", gap: 8 },
  scanCard: { gap: 12 },
  scanHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scanSubtitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "400",
  },
  sectionTitle: { color: colors.text, fontSize: 13, fontWeight: "600" },
  disabledNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 9,
    backgroundColor: colors.background,
  },
  notice: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  label: { color: colors.textSecondary, fontSize: 11, fontWeight: "400" },
  scanInputCombo: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 9,
    paddingHorizontal: 12,
    gap: 10,
    backgroundColor: colors.surface,
  },
  comboInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    paddingVertical: 8,
  },
  verifyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  verifyButtonDisabled: {
    backgroundColor: colors.backgroundSecondary,
    opacity: 0.5,
  },
  verifyButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  verifyButtonTextDisabled: {
    color: colors.textSecondary,
  },
  scanErrorText: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 16,
  },
  verifiedCard: { gap: 12 },
  verifiedHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cancelText: { color: colors.primary, fontSize: 13, fontWeight: "600" },
  pickLocation: {
    backgroundColor: colors.primarySoft,
    borderRadius: 9,
    padding: 12,
    gap: 6,
  },
  locationTitle: { color: colors.primary, fontSize: 12, fontWeight: "600" },
  locationText: { color: colors.primaryDark, fontSize: 11, lineHeight: 16 },
  sourceMismatchWarning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 9,
    backgroundColor: colors.amberSoft,
    padding: 12,
  },
  sourceMismatchWarningText: {
    flex: 1,
    color: colors.amberDark,
    fontSize: 12,
    lineHeight: 17,
  },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  detailLabel: { color: colors.textSecondary, fontSize: 11 },
  detailValue: { color: colors.text, fontSize: 13, fontWeight: "600" },
  quantityInput: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 9,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    paddingHorizontal: 12,
    textAlign: "center",
  },
  itemSection: { gap: 12 },
  itemSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionCount: {
    minWidth: 32,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  sectionCountText: { color: colors.primary, fontSize: 11, fontWeight: "600" },
  itemRow: {
    minHeight: 56,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 9,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
  },
  itemDone: {
    borderColor: colors.green,
    backgroundColor: colors.greenSoft,
  },
  itemClaimed: {
    borderColor: colors.amberDark,
    backgroundColor: colors.amberSoft,
  },
  itemClaimedBy: { color: colors.amberDark, fontSize: 10, marginTop: 2, lineHeight: 13 },
  itemName: { color: colors.text, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  itemMeta: { color: colors.textSecondary, fontSize: 11, marginTop: 2, lineHeight: 14 },
  itemMetaDetail: { color: colors.muted, fontSize: 10, marginTop: 1, lineHeight: 13 },
  itemMetaDone: { color: colors.greenDark },
});
