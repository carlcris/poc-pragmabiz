import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Card, ErrorState, LoadingState, Screen, StatusBadge } from "@/components/ui";
import {
  useLoadListReceiving,
  usePauseGrnReceiving,
  useStartGrnReceiving,
  useSubmitGrnReceiving,
  useUpdateGrnReceiving
} from "@/hooks/queries";
import { useAuthStore } from "@/stores/authStore";
import type { GrnLine, UpdateGrnLinePayload } from "@/contracts/receiving";
import { colors } from "@/theme/colors";
import { borderRadius, sizes, spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { formatDate } from "@/utils/format";
import {
  canAccessLoadListReceiving,
  canSaveGrnReceiving,
  canStartGrnReceiving,
  canSubmitGrnReceiving,
  hasResourcePermission
} from "@/utils/permissions";

type GrnLineDraft = Omit<UpdateGrnLinePayload, "id" | "numBoxes">;

const todayIsoDate = () => new Date().toISOString().split("T")[0];

const parseQuantity = (value: string) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const getInitialDraft = (item: GrnLine): GrnLineDraft => ({
  receivedQty: item.receivedQty,
  damagedQty: item.damagedQty,
  notes: item.notes || ""
});

export default function LoadListReceivingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((state) => state.session);
  const canViewReceiving = canAccessLoadListReceiving(session);
  const canViewGrn = hasResourcePermission(session, "goods_receipt_notes", "view");
  const canStartReceiving = canStartGrnReceiving(session);
  const canSaveReceiving = canSaveGrnReceiving(session);
  const canSubmitReceiving = canSubmitGrnReceiving(session);
  const [lineEdits, setLineEdits] = useState<Record<string, GrnLineDraft>>({});
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const detail = useLoadListReceiving(id, {
    enabled: canViewReceiving,
    includeGrn: canViewGrn
  });
  const loadList = detail.data?.loadList;
  const grn = detail.data?.grn;
  const updateGrn = useUpdateGrnReceiving(id, grn?.id || "");
  const startGrn = useStartGrnReceiving(id, grn?.id || "");
  const pauseGrn = usePauseGrnReceiving(id, grn?.id || "");
  const submitGrn = useSubmitGrnReceiving(id, grn?.id || "");
  const canStart = grn?.status === "draft" && canStartReceiving;
  const canPause = grn?.status === "receiving" && canStartReceiving;
  const canEdit = grn?.status === "receiving" && canSaveReceiving;
  const hasUnsavedChanges = Object.keys(lineEdits).length > 0;
  const busy = updateGrn.isPending || startGrn.isPending || pauseGrn.isPending || submitGrn.isPending;

  useEffect(() => {
    setLineEdits({});
    setActionError("");
    setActionMessage("");
  }, [grn?.id]);

  const getLineDraft = (item: GrnLine) => lineEdits[item.id] || getInitialDraft(item);

  const checkedItems = grn?.items.filter((item) => {
    const draft = getLineDraft(item);
    return draft.receivedQty > 0 || draft.damagedQty > 0;
  }).length || 0;
  const totalItems = grn?.items.length || 0;
  const progress = totalItems > 0 ? checkedItems / totalItems : 0;
  const hasReceivedQty = Boolean(grn?.items.some((item) => getLineDraft(item).receivedQty > 0));

  const handleLineChange = (
    item: GrnLine,
    field: keyof GrnLineDraft,
    value: number | string
  ) => {
    setActionError("");
    setActionMessage("");
    setLineEdits((current) => ({
      ...current,
      [item.id]: {
        ...getInitialDraft(item),
        ...current[item.id],
        [field]: value
      }
    }));
  };

  const buildUpdatePayload = () => {
    if (!grn) return [];
    return Object.entries(lineEdits).map(([lineId, draft]) => ({
      id: lineId,
      receivedQty: draft.receivedQty,
      damagedQty: draft.damagedQty,
      numBoxes: grn.items.find((item) => item.id === lineId)?.boxCount || 0,
      notes: draft.notes
    }));
  };

  const saveChanges = async (silent = false) => {
    if (!grn || !hasUnsavedChanges) return true;
    if (!canSaveReceiving) {
      setActionError("You do not have permission to save receiving quantities.");
      return false;
    }

    const items = buildUpdatePayload();
    if (items.length === 0) return true;

    try {
      await updateGrn.mutateAsync({
        receivingDate: grn.receivingDate || todayIsoDate(),
        items
      });
      setLineEdits({});
      if (!silent) {
        setActionMessage("Receiving quantities saved.");
      }
      return true;
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to save receiving quantities.");
      return false;
    }
  };

  const handleSubmit = async () => {
    setActionError("");
    setActionMessage("");

    if (!grn) return;
    if (!canSubmitReceiving) {
      setActionError("You do not have permission to submit this GRN.");
      return;
    }
    if (!hasReceivedQty) {
      setActionError("Enter a received quantity before submitting this GRN.");
      return;
    }

    const saved = await saveChanges(true);
    if (!saved) return;

    try {
      await submitGrn.mutateAsync();
      setActionMessage("GRN submitted to putaway.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to submit GRN.");
    }
  };

  const handleStartReceiving = async () => {
    setActionError("");
    setActionMessage("");

    if (!grn) return;
    if (!canStartReceiving) {
      setActionError("You do not have permission to start receiving.");
      return;
    }

    try {
      await startGrn.mutateAsync();
      setActionMessage("Receiving started.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to start receiving.");
    }
  };

  const handlePauseReceiving = async () => {
    setActionError("");
    setActionMessage("");

    if (!grn) return;
    if (!canStartReceiving) {
      setActionError("You do not have permission to pause receiving.");
      return;
    }

    const saved = await saveChanges(true);
    if (!saved) return;

    try {
      await pauseGrn.mutateAsync();
      setLineEdits({});
      setActionMessage("Receiving paused.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to pause receiving.");
    }
  };

  if (!canViewReceiving) {
    return (
      <Screen title="Load List" subtitle="Goods Receipt Note" back>
        <ErrorState message="You do not have permission to access receiving." />
      </Screen>
    );
  }

  return (
    <Screen title={loadList?.llNumber || "Load List"} subtitle="Goods Receipt Note" back>
      {detail.isLoading ? <LoadingState /> : null}
      {detail.error ? <ErrorState message="Unable to load load list receiving details." /> : null}

      {loadList ? (
        <>
          <Card style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={styles.summaryIcon}>
                <Ionicons name="cube-outline" size={24} color="#fff" />
              </View>
              <View style={styles.summaryTitleBlock}>
                <Text style={styles.summaryEyebrow}>Load List</Text>
                <Text style={styles.summaryTitle}>{loadList.llNumber}</Text>
              </View>
              <StatusBadge status={loadList.status} />
            </View>
            <View style={styles.detailGrid}>
              <DetailItem label="Supplier" value={loadList.supplierName} />
              <DetailItem label="Warehouse" value={loadList.warehouseName || "-"} />
              <DetailItem label="Arrived" value={formatDate(loadList.actualArrivalDate)} />
              <DetailItem label="ETA" value={formatDate(loadList.estimatedArrivalDate)} />
              {loadList.containerNumber ? (
                <DetailItem label="Container" value={loadList.containerNumber} />
              ) : null}
              {loadList.sealNumber ? <DetailItem label="Seal" value={loadList.sealNumber} /> : null}
            </View>
          </Card>

          {grn ? (
            <>
              <Card style={styles.progressCard}>
                <View style={styles.progressHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>Receiving Checklist</Text>
                    <Text style={styles.sectionSubtitle}>{grn.grnNumber}</Text>
                  </View>
                  <View style={styles.progressCount}>
                    <Text style={styles.progressCountText}>
                      {checkedItems}/{totalItems}
                    </Text>
                    <Text style={styles.progressCountLabel}>Items</Text>
                  </View>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                </View>
                <StatusBadge status={grn.status} />
              </Card>

              {canStart || canPause || canEdit ? (
                <Card style={styles.actionCard}>
                  <View style={styles.actionHeader}>
                    <View style={styles.actionTitleBlock}>
                      <Text style={styles.actionTitle}>
                        {canStart ? "Ready to receive" : "Receive items"}
                      </Text>
                      {canStart || canEdit ? (
                        <Text style={styles.actionSubtitle}>
                          {canStart
                            ? "Start receiving before entering quantities."
                            : "Save quantities, then submit to create putaway tasks."}
                        </Text>
                      ) : null}
                    </View>
                    {hasUnsavedChanges ? (
                      <Text style={styles.unsavedText}>Unsaved</Text>
                    ) : null}
                  </View>
                  {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
                  {actionMessage ? <Text style={styles.successText}>{actionMessage}</Text> : null}
                  {canStart ? (
                    <Pressable
                      onPress={() => void handleStartReceiving()}
                      disabled={busy}
                      style={({ pressed }) => [
                        styles.primaryButton,
                        busy && styles.buttonDisabled,
                        pressed && !busy ? styles.primaryButtonPressed : null
                      ]}
                    >
                      <Ionicons name="play-outline" size={18} color="#fff" />
                      <Text style={styles.primaryButtonText}>
                        {startGrn.isPending ? "Starting..." : "Start Receiving"}
                      </Text>
                    </Pressable>
                  ) : (
                    <View style={styles.actionButtons}>
                      {canPause ? (
                        <Pressable
                          onPress={() => void handlePauseReceiving()}
                          disabled={busy}
                          style={({ pressed }) => [
                            styles.secondaryButton,
                            busy && styles.buttonDisabled,
                            pressed && !busy ? styles.secondaryButtonPressed : null
                          ]}
                        >
                          <Ionicons name="pause-outline" size={18} color={colors.text} />
                          <Text style={styles.secondaryButtonText}>
                            {pauseGrn.isPending ? "Pausing..." : "Pause"}
                          </Text>
                        </Pressable>
                      ) : null}
                      {canEdit ? (
                        <Pressable
                          onPress={() => void saveChanges()}
                          disabled={!hasUnsavedChanges || busy}
                          style={({ pressed }) => [
                            styles.secondaryButton,
                            (!hasUnsavedChanges || busy) && styles.buttonDisabled,
                            pressed && hasUnsavedChanges && !busy
                              ? styles.secondaryButtonPressed
                              : null
                          ]}
                        >
                          <Ionicons name="save-outline" size={18} color={colors.text} />
                          <Text style={styles.secondaryButtonText}>
                            {updateGrn.isPending ? "Saving..." : "Save"}
                          </Text>
                        </Pressable>
                      ) : null}
                      {canSubmitReceiving ? (
                        <Pressable
                          onPress={() => void handleSubmit()}
                          disabled={busy || !hasReceivedQty}
                          style={({ pressed }) => [
                            styles.primaryButton,
                            (busy || !hasReceivedQty) && styles.buttonDisabled,
                            pressed && !busy && hasReceivedQty ? styles.primaryButtonPressed : null
                          ]}
                        >
                          <Ionicons name="paper-plane-outline" size={18} color="#fff" />
                          <Text style={styles.primaryButtonText}>
                            {submitGrn.isPending ? "Submitting..." : "Submit"}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  )}
                </Card>
              ) : null}

              <View style={styles.itemsSection}>
                {grn.items.map((item) => {
                  const draft = getLineDraft(item);
                  const hasEntry = draft.receivedQty > 0 || draft.damagedQty > 0;
                  const variance = hasEntry ? draft.receivedQty + draft.damagedQty - item.expectedQty : null;
                  const hasIssue = draft.damagedQty > 0 || (variance !== null && variance < 0);

                  return (
                    <Card
                      key={item.id}
                      style={[
                        styles.itemCard,
                        hasEntry && !hasIssue ? styles.itemCardReceived : null,
                        hasIssue ? styles.itemCardIssue : null
                      ]}
                    >
                      <View style={styles.itemHeader}>
                        <Ionicons
                          name={hasEntry ? "checkmark-circle-outline" : "ellipse-outline"}
                          size={24}
                          color={hasEntry ? colors.greenDark : colors.muted}
                        />
                        <View style={styles.itemTitleBlock}>
                          <Text style={styles.itemName} numberOfLines={2}>
                            {item.itemName}
                          </Text>
                          <Text style={styles.itemMeta}>{item.itemCode}</Text>
                          <Text style={styles.itemUnit}>{item.unitLabel}</Text>
                        </View>
                        <View style={styles.itemExpected}>
                          <Text style={styles.itemExpectedLabel}>Expected</Text>
                          <Text style={styles.itemExpectedValue}>{item.expectedQty}</Text>
                        </View>
                      </View>

                      <View style={styles.quantityGrid}>
                        {canEdit ? (
                          <>
                            <QuantityInput
                              label="Received"
                              value={draft.receivedQty}
                              tone="green"
                              disabled={busy}
                              onChange={(value) =>
                                handleLineChange(item, "receivedQty", parseQuantity(value))
                              }
                            />
                            <QuantityInput
                              label="Damaged"
                              value={draft.damagedQty}
                              tone="red"
                              disabled={busy}
                              onChange={(value) =>
                                handleLineChange(item, "damagedQty", parseQuantity(value))
                              }
                            />
                          </>
                        ) : (
                          <>
                            <QuantityBox label="Received" value={draft.receivedQty} tone="green" />
                            <QuantityBox label="Damaged" value={draft.damagedQty} tone="red" />
                          </>
                        )}
                      </View>

                      {variance !== null && variance !== 0 ? (
                        <Text style={[styles.variance, variance < 0 ? styles.varianceShort : null]}>
                          Variance {variance > 0 ? "+" : ""}
                          {variance}
                        </Text>
                      ) : null}
                    </Card>
                  );
                })}
              </View>
            </>
          ) : canViewGrn ? (
            <Card style={styles.emptyCard}>
              <Ionicons name="document-text-outline" size={48} color={colors.muted} />
              <Text style={styles.emptyTitle}>No GRN Found</Text>
              <Text style={styles.emptyText}>
                A goods receipt note has not been created for this load list yet.
              </Text>
            </Card>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const DetailItem = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.detailItem}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const QuantityBox = ({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "green" | "red" | "blue";
}) => (
  <View style={styles.quantityBox}>
    <Text
      style={[
        styles.quantityLabel,
        tone === "green" ? styles.quantityGreen : null,
        tone === "red" ? styles.quantityRed : null,
        tone === "blue" ? styles.quantityBlue : null
      ]}
    >
      {label}
    </Text>
    <Text style={styles.quantityValue}>{value}</Text>
  </View>
);

const QuantityInput = ({
  label,
  value,
  tone,
  disabled,
  onChange
}: {
  label: string;
  value: number;
  tone: "green" | "red" | "blue";
  disabled: boolean;
  onChange: (value: string) => void;
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.quantityBox, disabled ? styles.quantityBoxDisabled : null]}>
      <Text
        style={[
          styles.quantityLabel,
          tone === "green" ? styles.quantityGreen : null,
          tone === "red" ? styles.quantityRed : null,
          tone === "blue" ? styles.quantityBlue : null
        ]}
      >
        {label}
      </Text>
      <TextInput
        value={String(value)}
        editable={!disabled}
        keyboardType="decimal-pad"
        selectTextOnFocus
        onChangeText={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={[styles.quantityInput, isFocused ? styles.quantityInputFocused : null]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  summaryCard: {
    gap: spacing.base
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  summaryTitleBlock: {
    flex: 1
  },
  summaryEyebrow: {
    ...typography.bodySmall,
    color: colors.textSecondary
  },
  summaryTitle: {
    ...typography.title,
    color: colors.text
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  detailItem: {
    width: "47%",
    gap: spacing.xs
  },
  detailLabel: {
    ...typography.caption,
    color: colors.textSecondary
  },
  detailValue: {
    ...typography.bodySmall,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text
  },
  progressCard: {
    gap: spacing.md
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text
  },
  sectionSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs
  },
  progressCount: {
    alignItems: "flex-end"
  },
  progressCountText: {
    fontSize: 22,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary
  },
  progressCountLabel: {
    ...typography.caption,
    color: colors.textSecondary
  },
  progressTrack: {
    height: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.border,
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary
  },
  actionCard: {
    gap: spacing.md
  },
  actionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md
  },
  actionTitleBlock: {
    flex: 1
  },
  actionTitle: {
    ...typography.body,
    fontWeight: typography.fontWeights.bold,
    color: colors.text
  },
  actionSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs
  },
  unsavedText: {
    ...typography.caption,
    fontWeight: typography.fontWeights.bold,
    color: colors.amberDark
  },
  actionButtons: {
    flexDirection: "row",
    gap: spacing.sm
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  primaryButtonPressed: {
    backgroundColor: colors.primaryDark
  },
  primaryButtonText: {
    ...typography.bodySmall,
    fontWeight: typography.fontWeights.bold,
    color: "#fff"
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  secondaryButtonPressed: {
    backgroundColor: colors.faint
  },
  secondaryButtonText: {
    ...typography.bodySmall,
    fontWeight: typography.fontWeights.bold,
    color: colors.text
  },
  buttonDisabled: {
    opacity: 0.45
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.dangerDark,
    fontWeight: typography.fontWeights.semibold
  },
  successText: {
    ...typography.bodySmall,
    color: colors.greenDark,
    fontWeight: typography.fontWeights.semibold
  },
  itemsSection: {
    gap: spacing.md
  },
  itemCard: {
    gap: spacing.md
  },
  itemCardReceived: {
    borderColor: colors.green,
    backgroundColor: colors.greenSoft
  },
  itemCardIssue: {
    borderColor: colors.amber,
    backgroundColor: colors.amberSoft
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm
  },
  itemTitleBlock: {
    flex: 1
  },
  itemName: {
    ...typography.body,
    fontWeight: typography.fontWeights.bold,
    color: colors.text
  },
  itemMeta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs
  },
  itemUnit: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs
  },
  itemExpected: {
    alignItems: "flex-end",
    minWidth: 72
  },
  itemExpectedLabel: {
    ...typography.caption,
    color: colors.textSecondary
  },
  itemExpectedValue: {
    fontSize: 20,
    fontWeight: typography.fontWeights.bold,
    color: colors.text
  },
  quantityGrid: {
    flexDirection: "row",
    gap: spacing.sm
  },
  quantityBox: {
    flex: 1,
    borderRadius: borderRadius.md,
    backgroundColor: colors.faint,
    padding: spacing.sm,
    alignItems: "center"
  },
  quantityBoxDisabled: {
    opacity: 0.6
  },
  quantityLabel: {
    ...typography.caption,
    fontWeight: typography.fontWeights.semibold
  },
  quantityGreen: {
    color: colors.greenDark
  },
  quantityRed: {
    color: colors.dangerDark
  },
  quantityBlue: {
    color: colors.blueDark
  },
  quantityValue: {
    marginTop: spacing.xs,
    fontSize: 18,
    fontWeight: typography.fontWeights.bold,
    color: colors.text
  },
  quantityInput: {
    marginTop: spacing.sm,
    width: "100%",
    minHeight: sizes.input.base,
    borderRadius: borderRadius.base,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    textAlign: "center",
    fontSize: 20,
    fontWeight: typography.fontWeights.bold,
    color: colors.text
  },
  quantityInputFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  variance: {
    ...typography.bodySmall,
    color: colors.blueDark,
    fontWeight: typography.fontWeights.semibold
  },
  varianceShort: {
    color: colors.dangerDark
  },
  emptyCard: {
    minHeight: 240,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md
  },
  emptyTitle: {
    ...typography.title,
    color: colors.text
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: "center"
  }
});
