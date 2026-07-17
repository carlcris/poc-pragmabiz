import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Card,
  ErrorState,
  LoadingState,
  ScannerModal,
  Screen,
  StatusBadge
} from "@/components/ui";
import {
  useDeliveryNote,
  useRecordDeliveryNoteReceivingScan,
  useStartReceiving,
  useSubmitReceiving
} from "@/hooks/queries";
import { useSunmiScanner } from "@/hooks/useSunmiScanner";
import { useAuthStore } from "@/stores/authStore";
import type { ReceivingLine, RecordDeliveryNoteReceivingScanPayload } from "@/contracts/receiving";
import { colors } from "@/theme/colors";
import { spacing, borderRadius, shadows } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import {
  canAccessDeliveryNoteReceiving,
  canManageDeliveryNoteReceiving
} from "@/utils/permissions";

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
      const qty = toNumber(qtyRaw);
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
        locationId
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
    locationId: null
  };
};

const resolveLineFromScan = (lines: ReceivingLine[], rawScan: string, parsed: ParsedReceivingScan) => {
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
      line.itemUnitOptionId
    ]
      .filter(Boolean)
      .map((value) => normalizeScanValue(String(value)));
    return values.some((value) => candidates.includes(value));
  });
};

export default function ReceivingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((state) => state.session);
  const canViewDeliveryNoteReceiving = canAccessDeliveryNoteReceiving(session);
  const canManageReceiving = canManageDeliveryNoteReceiving(session);
  const [discrepancyNotes, setDiscrepancyNotes] = useState("");
  const [barcode, setBarcode] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanError, setScanError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [discrepancySheetOpen, setDiscrepancySheetOpen] = useState(false);
  const [scanConfirmation, setScanConfirmation] = useState<ScanConfirmation | null>(null);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const discrepancyBackdropOpacity = useRef(new Animated.Value(0)).current;
  const deliveryNote = useDeliveryNote(id, canViewDeliveryNoteReceiving);
  const startReceiving = useStartReceiving(id);
  const recordScan = useRecordDeliveryNoteReceivingScan(id);
  const submitReceiving = useSubmitReceiving(id);
  const isReceiving = deliveryNote.data?.status === "dispatched";
  const isReceived = deliveryNote.data?.status === "received";
  const isReceivingStarted = Boolean(deliveryNote.data?.receivingStartedAt);
  const displayStatus =
    isReceiving && isReceivingStarted ? "receiving" : deliveryNote.data?.status || "unknown";

  useEffect(() => {
    if (scanConfirmation) {
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true
      }).start();
    } else {
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      }).start();
    }
  }, [scanConfirmation, backdropOpacity]);

  useEffect(() => {
    if (discrepancySheetOpen) {
      Animated.timing(discrepancyBackdropOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true
      }).start();
    } else {
      Animated.timing(discrepancyBackdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      }).start();
    }
  }, [discrepancySheetOpen, discrepancyBackdropOpacity]);

  const totals = useMemo(() => {
    const items = deliveryNote.data?.items || [];
    return {
      total: items.reduce((sum, item) => sum + item.allocatedQty, 0),
      received: items.reduce((sum, item) => sum + item.receivedQty, 0)
    };
  }, [deliveryNote.data]);
  const hasVariance = useMemo(
    () => Boolean(deliveryNote.data?.items.some((item) => item.receivedQty !== item.allocatedQty)),
    [deliveryNote.data]
  );

  const submitReceivingWithNotes = async (notes: string) => {
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
        discrepancyNotes: hasVariance ? notes.trim() : undefined
      });
      setDiscrepancySheetOpen(false);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to submit receiving.");
    }
  };

  const handleSubmitReceiving = () => {
    setSubmitError("");

    if (!isReceiving) {
      setSubmitError("This delivery note is no longer open for receiving.");
      return;
    }

    if (hasVariance) {
      setDiscrepancySheetOpen(true);
      return;
    }

    void submitReceivingWithNotes("");
  };

  const commitReceivingScan = async (payload: RecordDeliveryNoteReceivingScanPayload) => {
    try {
      await recordScan.mutateAsync(payload);
      setBarcode("");
      setScanConfirmation(null);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Failed to record receiving scan.");
    }
  };

  const processScan = async (rawScan: string) => {
    const cleaned = rawScan.trim();
    setScanError("");

    if (!cleaned) {
      setScanError("Please enter or scan a QR code.");
      return;
    }

    if (!deliveryNote.data) return;

    if (deliveryNote.data.status !== "dispatched") {
      setScanError("Only dispatched delivery notes can be received.");
      return;
    }

    const parsed = parseReceivingScan(cleaned);
    const matchedLine = resolveLineFromScan(deliveryNote.data.items, cleaned, parsed);
    const itemId = parsed.itemId || matchedLine?.itemId;
    const itemUnitOptionId = parsed.itemUnitOptionId || matchedLine?.itemUnitOptionId || null;
    const quantity = parsed.qty || 1;

    if (!parsed.boxId) {
      setScanError("Scanned code did not include a box ID.");
      return;
    }

    const payload: RecordDeliveryNoteReceivingScanPayload = {
      qrCode: parsed.qrCode,
      boxId: parsed.boxId,
      itemId,
      itemUnitOptionId,
      qty: quantity,
      batchNumber: parsed.batchNumber,
      locationId: parsed.locationId
    };
    const isUnexpected = !matchedLine;
    const isOverage = matchedLine
      ? matchedLine.receivedQty + 1 > matchedLine.allocatedQty && matchedLine.allocatedQty > 0
      : false;

    if (isUnexpected) {
      setScanConfirmation({
        title: "Confirm unexpected item",
        message:
          "This scan does not match the delivery note items. Confirm only if you want to record it for receiving review.",
        tone: "warning",
        payload
      });
      return;
    }

    if (isOverage) {
      setScanConfirmation({
        title: "Confirm overage",
        message:
          "This scan will put the item over the dispatched quantity. Confirm only if you want to record the overage.",
        tone: "warning",
        payload
      });
      return;
    }

    await commitReceivingScan(payload);
  };

  useSunmiScanner({
    enabled:
      canManageReceiving &&
      isReceiving &&
      !scannerOpen &&
      !recordScan.isPending &&
      !scanConfirmation,
    onScan: processScan
  });

  if (!canViewDeliveryNoteReceiving) {
    return (
      <Screen title="Receiving" subtitle="Delivery note receiving" back>
        <ErrorState message="You do not have permission to access receiving." />
      </Screen>
    );
  }

  return (
    <Screen title={deliveryNote.data?.code || "Delivery Note"} subtitle="Scan and verify items">
      {deliveryNote.isLoading ? <LoadingState /> : null}
      {deliveryNote.error ? <ErrorState message="Unable to load the delivery note." /> : null}
      {deliveryNote.data ? (
        <>
          <Card style={styles.heroCard}>
            <Text style={styles.heroCode}>{deliveryNote.data.code}</Text>
            <Text style={styles.heroSubtitle}>
              {deliveryNote.data.items.length} items expected
            </Text>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>Receiving progress</Text>
              <Text style={styles.progressValue}>
                {totals.received} / {totals.total}
              </Text>
            </View>
            <StatusBadge status={displayStatus} />
          </Card>

          {isReceiving && canManageReceiving ? (
            <View style={styles.actionRow}>
              {!isReceivingStarted ? (
                <Pressable
                  onPress={() => startReceiving.mutate()}
                  disabled={startReceiving.isPending}
                  style={({ pressed }) => [
                    styles.actionButton,
                    pressed && styles.actionButtonPressed
                  ]}
                >
                  <Ionicons name="scan-outline" size={18} color="#fff" />
                  <Text style={styles.actionButtonText}>Start Receiving</Text>
                </Pressable>
              ) : (
                <View style={[styles.actionButton, styles.actionButtonStarted]}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.greenDark} />
                  <Text style={styles.actionButtonTextStarted}>Receiving Started</Text>
                </View>
              )}
              <Pressable
                onPress={handleSubmitReceiving}
                disabled={submitReceiving.isPending}
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.actionButtonSecondary,
                  pressed && styles.actionButtonSecondaryPressed
                ]}
              >
                <Ionicons name="paper-plane-outline" size={18} color={colors.text} />
                <Text style={styles.actionButtonTextSecondary}>
                  {submitReceiving.isPending ? "Submitting..." : "Submit"}
                </Text>
              </Pressable>
            </View>
          ) : isReceived ? (
            <Card style={styles.receivedCard}>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.greenDark} />
              <View style={styles.receivedCardText}>
                <Text style={styles.receivedTitle}>Receiving completed</Text>
                <Text style={styles.receivedSubtitle}>
                  This delivery note has already been submitted.
                </Text>
              </View>
            </Card>
          ) : null}
          {submitError ? <Text style={styles.submitErrorText}>{submitError}</Text> : null}

          {isReceiving && canManageReceiving ? (
            <>
              <Text style={styles.sectionTitle}>QR / BARCODE</Text>

              <Card style={styles.scanCard}>
                <View style={styles.inputRow}>
                  <Ionicons name="scan-outline" size={18} color="#9B8FC4" style={styles.inputIcon} />
                  <TextInput
                    value={barcode}
                    onChangeText={setBarcode}
                    placeholder="Enter barcode..."
                    placeholderTextColor="#9B8FC4"
                    style={styles.input}
                  />
                </View>
                <Pressable
                  onPress={() => setScannerOpen(true)}
                  style={({ pressed }) => [
                    styles.scanButton,
                    pressed && styles.scanButtonPressed
                  ]}
                >
                  <Ionicons name="camera-outline" size={18} color="#fff" />
                  <Text style={styles.scanButtonText}>Scan</Text>
                </Pressable>
                <Pressable
                  onPress={() => void processScan(barcode)}
                  disabled={!barcode.trim() || recordScan.isPending}
                  style={({ pressed }) => [
                    styles.verifyButton,
                    (!barcode.trim() || recordScan.isPending) && styles.verifyButtonDisabled,
                    pressed && !(!barcode.trim() || recordScan.isPending) && styles.verifyButtonPressed
                  ]}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.text} />
                  <Text style={styles.verifyButtonText}>
                    {recordScan.isPending ? "Verifying..." : "Verify Item"}
                  </Text>
                </Pressable>
                {scanError ? <Text style={styles.scanErrorText}>{scanError}</Text> : null}
              </Card>
            </>
          ) : null}

          {isReceiving && canManageReceiving && hasVariance ? (
            <>
              <Card style={styles.warningCard}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.amberDark} />
                <Text style={styles.warningText}>Acknowledgement required</Text>
              </Card>
              <Text style={styles.warningSubtext}>
                Shortage or overage must be noted during submit.
              </Text>
            </>
          ) : null}

          <View style={styles.itemsSection}>
            {deliveryNote.data.items.map((item) => {
              const complete = item.receivedQty >= item.allocatedQty && item.allocatedQty > 0;
              const progressPercent =
                item.allocatedQty > 0 ? (item.receivedQty / item.allocatedQty) * 100 : 0;
              return (
                <Card key={item.id} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <View
                      style={[
                        styles.itemIconContainer,
                        complete && styles.itemIconContainerComplete
                      ]}
                    >
                      <Ionicons
                        name={complete ? "checkmark-circle" : "cube-outline"}
                        size={24}
                        color={complete ? colors.greenDark : colors.primary}
                      />
                    </View>
                    <View style={styles.itemHeaderContent}>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {item.name}
                      </Text>
                      <Text style={styles.itemMeta}>
                        {item.code} • {item.uom}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.itemProgressSection}>
                    <View style={styles.itemProgressHeader}>
                      <Text style={styles.itemProgressLabel}>Progress</Text>
                      <Text style={styles.itemProgressValue}>
                        {item.receivedQty} / {item.allocatedQty}
                      </Text>
                    </View>
                    <View style={styles.itemProgressBarBackground}>
                      <View
                        style={[
                          styles.itemProgressBarFill,
                          {
                            width: `${Math.min(progressPercent, 100)}%`,
                            backgroundColor:
                              item.receivingStatus === "exact"
                                ? colors.green
                                : item.receivingStatus === "short"
                                  ? colors.amber
                                  : item.receivingStatus === "over"
                                    ? colors.danger
                                    : colors.primary
                          }
                        ]}
                      />
                    </View>
                  </View>

                  <View style={styles.itemFooter}>
                    <View
                      style={[
                        styles.itemStatusBadge,
                        item.receivingStatus === "short" && styles.itemStatusBadgeWarning,
                        item.receivingStatus === "over" && styles.itemStatusBadgeDanger,
                        item.receivingStatus === "exact" && styles.itemStatusBadgeSuccess
                      ]}
                    >
                      <Ionicons
                        name={
                          item.receivingStatus === "exact"
                            ? "checkmark-circle"
                            : item.receivingStatus === "short"
                              ? "alert-circle"
                              : item.receivingStatus === "over"
                                ? "warning"
                                : "ellipse"
                        }
                        size={14}
                        color={
                          item.receivingStatus === "exact"
                            ? colors.greenDark
                            : item.receivingStatus === "short"
                              ? colors.amberDark
                              : item.receivingStatus === "over"
                                ? colors.dangerDark
                                : colors.textSecondary
                        }
                      />
                      <Text
                        style={[
                          styles.itemStatusBadgeText,
                          item.receivingStatus === "short" && styles.itemStatusBadgeTextWarning,
                          item.receivingStatus === "over" && styles.itemStatusBadgeTextDanger,
                          item.receivingStatus === "exact" && styles.itemStatusBadgeTextSuccess
                        ]}
                      >
                        {item.receivingStatus === "exact"
                          ? "Complete"
                          : item.receivingStatus === "short"
                            ? "Shortage"
                            : item.receivingStatus === "over"
                              ? "Overage"
                              : "Pending"}
                      </Text>
                    </View>
                    {item.varianceQty !== 0 ? (
                      <View style={styles.itemVarianceBadge}>
                        <Text style={styles.itemVarianceText}>
                          {item.varianceQty > 0 ? "+" : ""}
                          {item.varianceQty}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Card>
              );
            })}
          </View>
        </>
      ) : null}
      <ScannerModal
        visible={canManageReceiving && scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(value) => {
          void processScan(value);
        }}
      />
      <Modal
        visible={canManageReceiving && discrepancySheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDiscrepancySheetOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.discrepancyRoot}
        >
          <Animated.View
            style={[
              styles.discrepancyBackdrop,
              {
                opacity: discrepancyBackdropOpacity
              }
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
              {submitError ? <Text style={styles.discrepancyErrorText}>{submitError}</Text> : null}
              <View style={styles.discrepancyActions}>
                <Pressable
                  onPress={() => setDiscrepancySheetOpen(false)}
                  disabled={submitReceiving.isPending}
                  style={({ pressed }) => [
                    styles.discrepancyButton,
                    styles.discrepancyButtonSecondary,
                    submitReceiving.isPending && styles.discrepancyButtonDisabled,
                    pressed && !submitReceiving.isPending && styles.discrepancyButtonSecondaryPressed
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
                    pressed && !submitReceiving.isPending && styles.discrepancyButtonPressed
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
      <Modal
        visible={canManageReceiving && Boolean(scanConfirmation)}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setScanConfirmation(null);
          setBarcode("");
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.confirmationRoot}
        >
          <Animated.View
            style={[
              styles.confirmationBackdrop,
              {
                opacity: backdropOpacity
              }
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
                    : styles.confirmationIconSuccess
                ]}
              >
                <Ionicons
                  name={
                    scanConfirmation?.tone === "warning"
                      ? "alert-circle"
                      : "checkmark-circle"
                  }
                  size={40}
                  color={
                    scanConfirmation?.tone === "warning" ? colors.amberDark : colors.greenDark
                  }
                />
              </View>
              <Text style={styles.confirmationTitle}>{scanConfirmation?.title}</Text>
              <Text style={styles.confirmationMessage}>{scanConfirmation?.message}</Text>
              <View style={styles.confirmationActions}>
                <Pressable
                  onPress={() => {
                    setScanConfirmation(null);
                    setBarcode("");
                  }}
                  disabled={recordScan.isPending}
                  style={({ pressed }) => [
                    styles.confirmationButton,
                    styles.confirmationButtonSecondary,
                    recordScan.isPending && styles.confirmationButtonDisabled,
                    pressed && !recordScan.isPending && styles.confirmationButtonSecondaryPressed
                  ]}
                >
                  <Text style={styles.confirmationButtonSecondaryText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (scanConfirmation) void commitReceivingScan(scanConfirmation.payload);
                  }}
                  disabled={recordScan.isPending}
                  style={({ pressed }) => [
                    styles.confirmationButton,
                    styles.confirmationButtonPrimary,
                    scanConfirmation?.tone === "warning" && styles.confirmationButtonWarning,
                    recordScan.isPending && styles.confirmationButtonDisabled,
                    pressed && !recordScan.isPending && styles.confirmationButtonPressed
                  ]}
                >
                  <Text style={styles.confirmationButtonText}>
                    {recordScan.isPending ? "Recording..." : "Confirm"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: spacing.xs,
    position: "relative",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingBottom: spacing.md
  },
  heroCode: {
    fontSize: 20,
    fontWeight: typography.fontWeights.bold,
    color: colors.text
  },
  heroSubtitle: {
    fontSize: 13,
    color: "#9B8FC4"
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xs
  },
  progressLabel: {
    fontSize: 13,
    color: "#9B8FC4"
  },
  progressValue: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: typography.fontWeights.bold
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  actionButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs
  },
  actionButtonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  actionButtonStarted: {
    backgroundColor: colors.greenSoft,
    borderWidth: 1,
    borderColor: colors.green
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: typography.fontWeights.semibold,
    color: "#fff"
  },
  actionButtonTextSecondary: {
    fontSize: 14,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text
  },
  actionButtonTextStarted: {
    fontSize: 14,
    fontWeight: typography.fontWeights.semibold,
    color: colors.greenDark
  },
  actionButtonPressed: {
    opacity: 0.7
  },
  actionButtonSecondaryPressed: {
    backgroundColor: colors.backgroundSecondary
  },
  receivedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
    borderWidth: 1,
    borderRadius: borderRadius.md
  },
  receivedCardText: {
    flex: 1,
    gap: 2
  },
  receivedTitle: {
    fontSize: 14,
    fontWeight: typography.fontWeights.semibold,
    color: colors.greenDark
  },
  receivedSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary
  },
  submitErrorText: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.danger,
    paddingHorizontal: spacing.xs
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: typography.fontWeights.semibold,
    color: "#9B8FC4",
    letterSpacing: 1,
    marginTop: spacing.sm
  },
  scanCard: {
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface
  },
  inputIcon: {
    marginRight: spacing.xs
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    padding: 0
  },
  scanButton: {
    minHeight: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryDark,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    ...shadows.sm
  },
  scanButtonText: {
    fontSize: 14,
    fontWeight: typography.fontWeights.semibold,
    color: "#fff"
  },
  scanButtonPressed: {
    opacity: 0.7
  },
  verifyButton: {
    minHeight: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs
  },
  verifyButtonDisabled: {
    opacity: 0.5
  },
  verifyButtonPressed: {
    backgroundColor: colors.backgroundSecondary
  },
  verifyButtonText: {
    fontSize: 14,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text
  },
  scanErrorText: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.danger
  },
  warningCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.amberSoft,
    borderColor: colors.amber,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: 0
  },
  warningText: {
    fontSize: 14,
    fontWeight: typography.fontWeights.semibold,
    color: colors.amberDark,
    flex: 1
  },
  warningSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: -spacing.xs,
    paddingHorizontal: spacing.md
  },
  discrepancyRoot: {
    flex: 1,
    justifyContent: "flex-end"
  },
  discrepancyBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17, 24, 39, 0.5)"
  },
  discrepancySafeArea: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl
  },
  discrepancySheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    alignItems: "center",
    ...shadows.xl
  },
  discrepancyHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.lg
  },
  discrepancyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    backgroundColor: colors.amberSoft
  },
  discrepancyTitle: {
    fontSize: 20,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.xs
  },
  discrepancyMessage: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm
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
    marginBottom: spacing.md
  },
  discrepancyErrorText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.danger,
    textAlign: "center",
    marginBottom: spacing.sm
  },
  discrepancyActions: {
    flexDirection: "row",
    width: "100%",
    gap: spacing.md
  },
  discrepancyButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center"
  },
  discrepancyButtonPrimary: {
    backgroundColor: colors.primary,
    ...shadows.sm
  },
  discrepancyButtonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border
  },
  discrepancyButtonDisabled: {
    opacity: 0.5
  },
  discrepancyButtonPressed: {
    opacity: 0.85
  },
  discrepancyButtonSecondaryPressed: {
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.textSecondary
  },
  discrepancyButtonText: {
    fontSize: 16,
    fontWeight: typography.fontWeights.semibold,
    color: "#fff"
  },
  discrepancyButtonSecondaryText: {
    fontSize: 16,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text
  },
  confirmationRoot: {
    flex: 1,
    justifyContent: "flex-end"
  },
  confirmationBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17, 24, 39, 0.5)"
  },
  confirmationSafeArea: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl
  },
  confirmationSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    alignItems: "center",
    ...shadows.xl
  },
  confirmationHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.lg
  },
  confirmationIconCircle: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md
  },
  confirmationIconSuccess: {
    backgroundColor: colors.greenSoft
  },
  confirmationIconWarning: {
    backgroundColor: colors.amberSoft
  },
  confirmationTitle: {
    fontSize: 20,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.xs
  },
  confirmationMessage: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm
  },
  confirmationActions: {
    flexDirection: "row",
    width: "100%",
    gap: spacing.md
  },
  confirmationButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center"
  },
  confirmationButtonPrimary: {
    backgroundColor: colors.primary,
    ...shadows.sm
  },
  confirmationButtonWarning: {
    backgroundColor: colors.amberDark,
    ...shadows.sm
  },
  confirmationButtonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border
  },
  confirmationButtonDisabled: {
    opacity: 0.5
  },
  confirmationButtonPressed: {
    opacity: 0.85
  },
  confirmationButtonSecondaryPressed: {
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.textSecondary
  },
  confirmationButtonText: {
    fontSize: 16,
    fontWeight: typography.fontWeights.semibold,
    color: "#fff"
  },
  confirmationButtonSecondaryText: {
    fontSize: 16,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text
  },
  sheetActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs
  },
  sheetButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  sheetButtonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  sheetButtonText: {
    fontSize: 14,
    fontWeight: typography.fontWeights.semibold,
    color: "#fff"
  },
  sheetButtonSecondaryText: {
    fontSize: 14,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text
  },
  sheetButtonPressed: {
    opacity: 0.7
  },
  sheetButtonSecondaryPressed: {
    backgroundColor: colors.backgroundSecondary
  },
  itemsSection: {
    gap: spacing.md
  },
  itemCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.sm
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md
  },
  itemIconContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  itemIconContainerComplete: {
    backgroundColor: colors.greenSoft
  },
  itemHeaderContent: {
    flex: 1,
    gap: 4
  },
  itemName: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: typography.fontWeights.bold,
    color: colors.text
  },
  itemMeta: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary
  },
  itemProgressSection: {
    gap: spacing.xs
  },
  itemProgressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  itemProgressLabel: {
    fontSize: 13,
    fontWeight: typography.fontWeights.medium,
    color: colors.textSecondary
  },
  itemProgressValue: {
    fontSize: 15,
    fontWeight: typography.fontWeights.bold,
    color: colors.text
  },
  itemProgressBarBackground: {
    height: 8,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.full,
    overflow: "hidden"
  },
  itemProgressBarFill: {
    height: "100%",
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary
  },
  itemFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  itemStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundSecondary
  },
  itemStatusBadgeWarning: {
    backgroundColor: colors.amberSoft
  },
  itemStatusBadgeDanger: {
    backgroundColor: colors.dangerSoft
  },
  itemStatusBadgeSuccess: {
    backgroundColor: colors.greenSoft
  },
  itemStatusBadgeText: {
    fontSize: 13,
    fontWeight: typography.fontWeights.semibold,
    color: colors.textSecondary
  },
  itemStatusBadgeTextWarning: {
    color: colors.amberDark
  },
  itemStatusBadgeTextDanger: {
    color: colors.dangerDark
  },
  itemStatusBadgeTextSuccess: {
    color: colors.greenDark
  },
  itemVarianceBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border
  },
  itemVarianceText: {
    fontSize: 13,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text
  }
});
