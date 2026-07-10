import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  ActionButton,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  ScannerModal,
  Screen
} from "@/components/ui";
import { resolvePickSource } from "@/api/picking";
import type { PickListItem } from "@/contracts/picking";
import {
  useCompletePickList,
  usePickList,
  useSetPickListStatus
} from "@/hooks/queries";
import { useAuthStore } from "@/stores/authStore";
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
      const keys = [
        "id",
        "itemId",
        "item",
        "itemCode",
        "code",
        "barcode",
        "batchLocationSku"
      ];
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
  batchReceivedAt: item.sourceBatchReceivedAt
});

export default function PickingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((state) => state.session);
  const canViewPicking = canAccessPicking(session);
  const pickList = usePickList(id, canViewPicking);
  const setStatus = useSetPickListStatus(id);
  const completePickList = useCompletePickList(id);
  const [barcode, setBarcode] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [verifiedItemId, setVerifiedItemId] = useState<string | null>(null);
  const [currentPickSource, setCurrentPickSource] = useState<PickSource | null>(null);
  const [pickedSources, setPickedSources] = useState<Record<string, PickSource>>({});
  const [pickedQtyText, setPickedQtyText] = useState("");
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [verifyError, setVerifyError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const effectiveStatus =
    setStatus.isPending && typeof setStatus.variables === "string"
      ? setStatus.variables
      : (pickList.data?.status ?? "pending");
  const statusMeta = getStatusMeta(effectiveStatus);
  const pickingActive = effectiveStatus === "in_progress";

  const totals = useMemo(() => {
    const items = pickList.data?.items || [];
    const pickedTotal = items.reduce((sum, item) => sum + (picked[item.id] ?? item.pickedQty), 0);
    const requiredTotal = items.reduce((sum, item) => sum + item.requiredQty, 0);
    return { pickedTotal, requiredTotal };
  }, [pickList.data?.items, picked]);

  const remaining = (pickList.data?.items || []).filter(
    (item) => (picked[item.id] ?? item.pickedQty) < item.requiredQty
  );
  const completed = (pickList.data?.items || []).filter(
    (item) => (picked[item.id] ?? item.pickedQty) >= item.requiredQty
  );
  const verifiedItem = pickList.data?.items.find((item) => item.id === verifiedItemId) || null;
  const verifiedAlreadyPicked = verifiedItem ? (picked[verifiedItem.id] ?? verifiedItem.pickedQty) : 0;
  const verifiedRemainingQty = verifiedItem
    ? Math.max(0, verifiedItem.requiredQty - verifiedAlreadyPicked)
    : 0;
  const pickedQtyValue = Number(pickedQtyText);
  const canConfirmPick =
    !!verifiedItem &&
    Number.isFinite(pickedQtyValue) &&
    pickedQtyValue > 0 &&
    pickedQtyValue <= verifiedRemainingQty;

  if (!canViewPicking) {
    return (
      <Screen title="Picking" subtitle="Pick list detail" back>
        <ErrorState message="You do not have permission to access picking." />
      </Screen>
    );
  }

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
          batchCode: parsedQr?.batchCode
        });

        if (resolved?.line) {
          const match =
            pickList.data.items.find((item) => item.id === resolved.line?.pickListItemId) || null;
          if (match) {
            setVerifiedItemId(match.id);
            setCurrentPickSource({
              batchLocationSku: resolved.batchLocationSku,
              locationId: resolved.source.locationId,
              locationName: resolved.source.locationName || resolved.source.locationCode,
              batchCode: resolved.source.batchCode,
              batchReceivedAt: resolved.source.batchReceivedAt
            });
            setPickedQtyText(String(resolved.line.remainingQty));
            setBarcode("");
            return;
          }
        }
      }

      const match = pickList.data.items.find((item) => {
        const directMatch = [item.itemId, item.code, item.barcode, item.sourceSku]
          .filter(Boolean)
          .some((candidate) => normalizedCandidates.has(normalizeScanValue(String(candidate))));
        if (directMatch) return true;

        return Array.from(normalizedCandidates).some((candidate) => {
          const name = normalizeScanValue(item.name);
          return name.length > 0 && (name.includes(candidate) || candidate.includes(name));
        });
      });

      if (match) {
        const alreadyPicked = picked[match.id] ?? match.pickedQty;
        const remainingQty = Math.max(0, match.requiredQty - alreadyPicked);
        if (remainingQty <= 0) {
          setVerifyError("Item is already picked in this pick list.");
          return;
        }

        setVerifiedItemId(match.id);
        setCurrentPickSource(defaultPickSource(match));
        setPickedQtyText(String(remainingQty));
        setBarcode("");
        return;
      }

      setVerifyError("Item not found in current pick list.");
      setBarcode(value);
    } catch (error) {
      setVerifyError(error instanceof Error ? error.message : "Failed to verify scanned item.");
    } finally {
      setIsVerifying(false);
    }
  };

  const confirmPick = () => {
    if (!verifiedItem) return;
    const quantityToAdd = Number(pickedQtyText);
    if (!Number.isFinite(quantityToAdd) || quantityToAdd <= 0) return;

    const currentPicked = picked[verifiedItem.id] ?? verifiedItem.pickedQty;
    const nextPickedQty = Math.min(verifiedItem.requiredQty, currentPicked + quantityToAdd);

    setPicked((previous) => ({ ...previous, [verifiedItem.id]: nextPickedQty }));
    setPickedSources((previous) => ({
      ...previous,
      [verifiedItem.id]: currentPickSource || defaultPickSource(verifiedItem)
    }));
    setVerifiedItemId(null);
    setCurrentPickSource(null);
    setPickedQtyText("");
    setBarcode("");
  };

  const complete = () => {
    const items = pickList.data?.items || [];
    const payload = items
      .map((item) => {
        const finalPickedQty = picked[item.id] ?? item.pickedQty;
        const source = pickedSources[item.id] || defaultPickSource(item);
        return {
          pickListItemId: item.pickListItemId,
          deliveryNoteItemId: item.deliveryNoteItemId,
          pickedQty: Math.max(0, finalPickedQty - item.pickedQty),
          batchLocationSku: source.batchLocationSku,
          pickedLocationId: source.locationId,
          pickedBatchCode: source.batchCode,
          pickedBatchReceivedAt: source.batchReceivedAt
        };
      })
      .filter((item) => item.pickedQty > 0);

    completePickList.mutate(payload);
  };

  return (
    <Screen title={pickList.data?.code || "Pick List"} subtitle="Pick and verify items">
      {pickList.isLoading ? <LoadingState /> : null}
      {pickList.error ? <ErrorState message="Unable to load the pick list." /> : null}
      {pickList.data ? (
        <>
          <View style={styles.progressContainer}>
            <View style={styles.headerRow}>
              <Text style={styles.pickListCode}>{pickList.data.deliveryNoteCode || pickList.data.code}</Text>
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
                    {totals.requiredTotal > 0 ? Math.round((totals.pickedTotal / totals.requiredTotal) * 100) : 0}%
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
                disabled={setStatus.isPending}
                style={{ flex: 1 }}
              />
              <ActionButton
                label="Complete"
                icon="checkmark-circle-outline"
                variant="success"
                onPress={complete}
                disabled={completePickList.isPending || setStatus.isPending}
                style={{ flex: 1 }}
              />
            </View>
          ) : null}

          {verifiedItem ? (
            <VerifiedPanel
              item={verifiedItem}
              pickedQtyText={pickedQtyText}
              remainingQty={verifiedRemainingQty}
              canConfirm={canConfirmPick}
              onPickedQtyChange={setPickedQtyText}
              onCancel={() => {
                setVerifiedItemId(null);
                setPickedQtyText("");
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
                <Ionicons name="barcode-outline" size={22} color={pickingActive ? colors.primary : colors.textSecondary} />
                <TextInput
                  value={barcode}
                  onChangeText={setBarcode}
                  editable={pickingActive}
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
                  disabled={!pickingActive || !barcode.trim() || isVerifying}
                  style={[
                    styles.verifyButton,
                    (!pickingActive || !barcode.trim() || isVerifying) && styles.verifyButtonDisabled
                  ]}
                >
                  <Text
                    style={[
                      styles.verifyButtonText,
                      (!pickingActive || !barcode.trim() || isVerifying) &&
                        styles.verifyButtonTextDisabled
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
                disabled={!pickingActive}
                onPress={() => setScannerOpen(true)}
              />
            </Card>
          )}

          {remaining.length > 0 ? (
            <ItemSection title="Remaining Items" items={remaining} picked={picked} />
          ) : null}
          {completed.length > 0 ? (
            <ItemSection title="Picked Items" items={completed} picked={picked} />
          ) : null}
        </>
      ) : null}
      <ScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(value) => {
          setBarcode(value);
          void verifyBarcode(value);
        }}
      />
    </Screen>
  );
}

const VerifiedPanel = ({
  item,
  pickedQtyText,
  remainingQty,
  canConfirm,
  onPickedQtyChange,
  onCancel,
  onConfirm
}: {
  item: PickListItem;
  pickedQtyText: string;
  remainingQty: number;
  canConfirm: boolean;
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
      <Pressable onPress={onCancel}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </View>
    <View style={styles.pickLocation}>
      <Text style={styles.locationTitle}>Pick Location</Text>
      <Text style={styles.locationText}>Location: {item.locationName || "Main"}</Text>
      <Text style={styles.locationText}>Batch: {item.batchNumber || "OPENING-BALANCE"}</Text>
      <Text style={styles.locationText}>Location SKU: {item.sourceSku || item.barcode || item.code}</Text>
    </View>
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
      keyboardType="decimal-pad"
      placeholder="Enter quantity"
      placeholderTextColor={colors.textSecondary}
      style={styles.quantityInput}
    />
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
  picked
}: {
  title: string;
  items: PickListItem[];
  picked: Record<string, number>;
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
        const pickedQty = picked[item.id] ?? item.pickedQty;
        const remainingQty = Math.max(0, item.requiredQty - pickedQty);
        const done = pickedQty >= item.requiredQty;
        return (
          <View key={item.id} style={[styles.itemRow, done ? styles.itemDone : null]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={[styles.itemMeta, done ? styles.itemMetaDone : null]}>
                {done ? "Picked" : "To pick"}: {done ? pickedQty : remainingQty} {item.uom}
              </Text>
              <Text style={[styles.itemMetaDetail, done ? styles.itemMetaDone : null]}>
                Picked {pickedQty} / {item.requiredQty} {item.uom}
              </Text>
            </View>
            {done ? (
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
    marginBottom: 16
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12
  },
  pickListCode: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text
  },
  dateText: {
    fontSize: 13,
    fontWeight: "400",
    color: "#A0AEC0"
  },
  dividerLine: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 0
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16
  },
  statColumnWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  statColumn: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    width: "100%"
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#E2E8F0"
  },
  statValue: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1A202C",
    lineHeight: 32
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#A78BFA",
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12
  },
  statusLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F59E0B"
  },
  statusText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.text
  },
  statusHint: {
    fontSize: 13,
    fontWeight: "400",
    color: "#A0AEC0"
  },
  actionRow: { flexDirection: "row", gap: 8 },
  scanCard: { gap: 12 },
  scanHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  scanSubtitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "400"
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
    backgroundColor: colors.background
  },
  notice: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary
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
    backgroundColor: colors.surface
  },
  comboInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    paddingVertical: 8
  },
  verifyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  verifyButtonDisabled: {
    backgroundColor: colors.backgroundSecondary,
    opacity: 0.5
  },
  verifyButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF"
  },
  verifyButtonTextDisabled: {
    color: colors.textSecondary
  },
  scanErrorText: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 16
  },
  verifiedCard: { gap: 12 },
  verifiedHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cancelText: { color: colors.primary, fontSize: 13, fontWeight: "600" },
  pickLocation: {
    backgroundColor: colors.primarySoft,
    borderRadius: 9,
    padding: 12,
    gap: 6
  },
  locationTitle: { color: colors.primary, fontSize: 12, fontWeight: "600" },
  locationText: { color: colors.primaryDark, fontSize: 11, lineHeight: 16 },
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
    textAlign: "center"
  },
  itemSection: { gap: 12 },
  itemSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionCount: {
    minWidth: 32,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8
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
    backgroundColor: colors.surface
  },
  itemDone: {
    borderColor: colors.green,
    backgroundColor: colors.greenSoft
  },
  itemName: { color: colors.text, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  itemMeta: { color: colors.textSecondary, fontSize: 11, marginTop: 2, lineHeight: 14 },
  itemMetaDetail: { color: colors.muted, fontSize: 10, marginTop: 1, lineHeight: 13 },
  itemMetaDone: { color: colors.greenDark }
});
