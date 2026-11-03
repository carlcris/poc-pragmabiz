import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ActionFooter } from "@/components/ActionFooter";
import { ActionFooterButton } from "@/components/ActionFooterButton";
import { ReceivingProgressSummary } from "@/components/receiving/ReceivingProgressSummary";
import { getLoadListStage } from "@/components/receiving/receiving-stages";
import { Card, ErrorState, LoadingState, Screen } from "@/components/ui";
import {
  useLoadListReceiving,
  usePauseGrnReceiving,
  useStartGrnReceiving,
  useSubmitGrnReceiving,
  useUpdateGrnReceiving,
} from "@/hooks/queries";
import { useScreenFocusState } from "@/hooks/useScreenFocusState";
import { useAuthStore } from "@/stores/authStore";
import type { GrnLine, UpdateGrnLinePayload } from "@/contracts/receiving";
import { colors } from "@/theme/colors";
import { borderRadius, spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { softShadow, primaryGlow } from "@/theme/elevation";
import { formatDate } from "@/utils/format";
import {
  canAccessLoadListReceiving,
  canSaveGrnReceiving,
  canStartGrnReceiving,
  canSubmitGrnReceiving,
  hasResourcePermission,
} from "@/utils/permissions";

type GrnLineDraft = Omit<UpdateGrnLinePayload, "id" | "numBoxes">;

type LineTab = "to_count" | "counted" | "variance";

const todayIsoDate = () => new Date().toISOString().split("T")[0];

const parseQuantity = (value: string) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const getInitialDraft = (item: GrnLine): GrnLineDraft => ({
  receivedQty: item.receivedQty,
  damagedQty: item.damagedQty,
  notes: item.notes || "",
});

const describeLineDraft = (item: GrnLine, draft: GrnLineDraft) => {
  const hasEntry = draft.receivedQty > 0 || draft.damagedQty > 0;
  const variance = hasEntry ? draft.receivedQty + draft.damagedQty - item.expectedQty : null;
  const hasIssue = draft.damagedQty > 0 || (variance !== null && variance !== 0);
  const issues = [
    variance !== null && variance < 0 ? `Short ${Math.abs(variance)}` : null,
    variance !== null && variance > 0 ? `Over ${variance}` : null,
    draft.damagedQty > 0 ? `${draft.damagedQty} damaged` : null,
  ].filter((issue): issue is string => issue !== null);

  return { hasEntry, hasIssue, issueText: issues.join(" · ") };
};

const LINE_TABS: { value: LineTab; label: string }[] = [
  { value: "to_count", label: "To count" },
  { value: "counted", label: "Counted" },
  { value: "variance", label: "Variance" },
];

export default function LoadListReceivingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isFocused = useScreenFocusState();
  const session = useAuthStore((state) => state.session);
  const canViewReceiving = canAccessLoadListReceiving(session);
  const canViewGrn = hasResourcePermission(session, "goods_receipt_notes", "view");
  const canStartReceiving = canStartGrnReceiving(session);
  const canSaveReceiving = canSaveGrnReceiving(session);
  const canSubmitReceiving = canSubmitGrnReceiving(session);
  const [lineEdits, setLineEdits] = useState<Record<string, GrnLineDraft>>({});
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [lineTab, setLineTab] = useState<LineTab | null>(null);
  const [expandedLineId, setExpandedLineId] = useState<string | null>(null);
  const detail = useLoadListReceiving(id, {
    enabled: canViewReceiving && isFocused,
    includeGrn: canViewGrn,
  });
  const refetchDetail = detail.refetch;
  const loadList = detail.data?.loadList;
  const grn = detail.data?.grn;
  const updateGrn = useUpdateGrnReceiving(id, grn?.id || "");
  const startGrn = useStartGrnReceiving(id, grn?.id || "");
  const pauseGrn = usePauseGrnReceiving(id, grn?.id || "");
  const submitGrn = useSubmitGrnReceiving(id, grn?.id || "");
  const canStart = (grn?.status === "draft" || grn?.status === "paused") && canStartReceiving;
  const canPause = grn?.status === "receiving" && canStartReceiving;
  const canEdit = grn?.status === "receiving" && canSaveReceiving;
  const hasUnsavedChanges = Object.keys(lineEdits).length > 0;
  const busy =
    updateGrn.isPending || startGrn.isPending || pauseGrn.isPending || submitGrn.isPending;

  const handleRefresh = useCallback(async () => {
    if (canViewReceiving) {
      await refetchDetail();
    }
  }, [canViewReceiving, refetchDetail]);

  useEffect(() => {
    setLineEdits({});
    setActionError("");
    setActionMessage("");
    setExpandedLineId(null);
  }, [grn?.id]);

  const getLineDraft = (item: GrnLine) => lineEdits[item.id] || getInitialDraft(item);

  const lines = (grn?.items || []).map((item) => {
    const draft = getLineDraft(item);
    return { item, draft, ...describeLineDraft(item, draft) };
  });
  const checkedItems = lines.filter((line) => line.hasEntry).length;
  const totalItems = lines.length;
  const remainingItems = totalItems - checkedItems;
  const varianceItems = lines.filter((line) => line.hasIssue).length;
  const hasReceivedQty = lines.some((line) => line.draft.receivedQty > 0);
  const activeTab: LineTab = lineTab ?? (remainingItems > 0 ? "to_count" : "counted");
  const tabCounts: Record<LineTab, number> = {
    to_count: remainingItems,
    counted: checkedItems,
    variance: varianceItems,
  };
  const visibleLines = lines.filter((line) => {
    if (line.item.id === expandedLineId) return true;
    if (activeTab === "to_count") return !line.hasEntry;
    if (activeTab === "counted") return line.hasEntry;
    return line.hasIssue;
  });

  const handleLineChange = (item: GrnLine, field: keyof GrnLineDraft, value: number | string) => {
    setActionError("");
    setActionMessage("");
    setLineEdits((current) => ({
      ...current,
      [item.id]: {
        ...getInitialDraft(item),
        ...current[item.id],
        [field]: value,
      },
    }));
  };

  const buildUpdatePayload = () => {
    if (!grn) return [];
    return Object.entries(lineEdits).map(([lineId, draft]) => ({
      id: lineId,
      receivedQty: draft.receivedQty,
      damagedQty: draft.damagedQty,
      numBoxes: grn.items.find((item) => item.id === lineId)?.boxCount || 0,
      notes: draft.notes,
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
        items,
      });
      setLineEdits({});
      if (!silent) {
        setActionMessage("Receiving quantities saved.");
      }
      return true;
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Failed to save receiving quantities."
      );
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

    try {
      await submitGrn.mutateAsync({
        receivingPatch: hasUnsavedChanges
          ? {
              receivingDate: grn.receivingDate || todayIsoDate(),
              items: buildUpdatePayload(),
            }
          : undefined,
      });
      setLineEdits({});
      setExpandedLineId(null);
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
      setExpandedLineId(null);
      setActionMessage("Receiving paused.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to pause receiving.");
    }
  };

  if (!canViewReceiving) {
    return (
      <Screen
        title="Load list"
        subtitle="Goods receipt"
        back
        onRefresh={handleRefresh}
        refreshing={detail.isRefetching}
      >
        <ErrorState message="You do not have permission to access receiving." />
      </Screen>
    );
  }

  const unsavedCount = Object.keys(lineEdits).length;
  const footerNote = actionError
    ? { text: actionError, tone: "error" as const }
    : actionMessage
      ? { text: actionMessage, tone: "success" as const }
      : canStart
        ? { text: "Start receiving before entering quantities.", tone: "neutral" as const }
        : hasUnsavedChanges
          ? {
              text: `Unsaved changes on ${unsavedCount} ${unsavedCount === 1 ? "line" : "lines"}`,
              tone: "warning" as const,
            }
          : !hasReceivedQty
            ? { text: "Enter a received quantity to submit.", tone: "neutral" as const }
            : null;

  const footer =
    grn && canStart ? (
      <ActionFooter note={footerNote?.text} noteTone={footerNote?.tone}>
        <ActionFooterButton
          label={startGrn.isPending ? "Starting..." : "Start receiving"}
          disabled={busy}
          onPress={() => void handleStartReceiving()}
        />
      </ActionFooter>
    ) : grn && canEdit ? (
      <ActionFooter note={footerNote?.text} noteTone={footerNote?.tone}>
        <ActionFooterButton
          label={updateGrn.isPending ? "Saving..." : "Save"}
          variant="secondary"
          disabled={!hasUnsavedChanges || busy}
          onPress={() => void saveChanges()}
        />
        {canSubmitReceiving ? (
          <ActionFooterButton
            label={
              submitGrn.isPending
                ? "Submitting..."
                : remainingItems > 0
                  ? `Submit · ${remainingItems} left`
                  : "Submit"
            }
            grow={1.4}
            disabled={busy || !hasReceivedQty}
            onPress={() => void handleSubmit()}
          />
        ) : null}
      </ActionFooter>
    ) : null;

  const facts = loadList
    ? [
        grn?.grnNumber ?? null,
        loadList.containerNumber ? `Container ${loadList.containerNumber}` : null,
        loadList.sealNumber ? `Seal ${loadList.sealNumber}` : null,
        loadList.actualArrivalDate
          ? `Arrived ${formatDate(loadList.actualArrivalDate)}`
          : `ETA ${formatDate(loadList.estimatedArrivalDate)}`,
      ].filter((fact): fact is string => fact !== null)
    : [];

  return (
    <Screen
      title={loadList?.llNumber || "Load list"}
      subtitle={loadList ? `Load list · ${loadList.supplierName}` : "Goods receipt"}
      back
      onRefresh={handleRefresh}
      refreshing={detail.isRefetching}
      footer={footer}
    >
      {detail.isLoading ? <LoadingState /> : null}
      {detail.error ? <ErrorState message="Unable to load load list receiving details." /> : null}

      {loadList ? (
        <>
          <ReceivingProgressSummary
            stage={getLoadListStage(loadList.status)}
            done={checkedItems}
            total={totalItems}
            unitLabel="lines counted"
            facts={facts}
            action={
              canPause ? (
                <Pressable
                  onPress={() => void handlePauseReceiving()}
                  disabled={busy}
                  accessibilityRole="button"
                  style={styles.pauseButton}
                >
                  <Ionicons name="pause-outline" size={16} color={colors.primaryDark} />
                  <Text style={styles.pauseText}>
                    {pauseGrn.isPending ? "Pausing..." : "Pause receiving"}
                  </Text>
                </Pressable>
              ) : null
            }
          />

          {!footer && (actionMessage || actionError) ? (
            <Text style={actionError ? styles.errorText : styles.successText}>
              {actionError || actionMessage}
            </Text>
          ) : null}

          {grn ? (
            <>
              <View style={styles.tabs} accessibilityRole="tablist">
                {LINE_TABS.map((tab) => {
                  const active = tab.value === activeTab;
                  return (
                    <Pressable
                      key={tab.value}
                      onPress={() => {
                        setLineTab(tab.value);
                        setExpandedLineId(null);
                      }}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                      style={[styles.tab, active ? styles.tabActive : null]}
                    >
                      <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>
                        {tab.label} · {tabCounts[tab.value]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {visibleLines.length === 0 ? (
                <Text style={styles.emptyLines}>
                  {activeTab === "to_count"
                    ? "Every line has been counted."
                    : activeTab === "counted"
                      ? "No lines counted yet."
                      : "No variances."}
                </Text>
              ) : (
                <View style={styles.lines}>
                  {visibleLines.map((line) => (
                    <LoadListLineRow
                      key={line.item.id}
                      item={line.item}
                      draft={line.draft}
                      hasEntry={line.hasEntry}
                      issueText={line.issueText}
                      expanded={line.item.id === expandedLineId}
                      canEdit={canEdit}
                      busy={busy}
                      onToggle={() =>
                        setExpandedLineId((current) =>
                          current === line.item.id ? null : line.item.id
                        )
                      }
                      onChange={(field, value) => handleLineChange(line.item, field, value)}
                    />
                  ))}
                </View>
              )}
            </>
          ) : canViewGrn ? (
            <Card style={styles.emptyCard}>
              <Ionicons name="document-text-outline" size={40} color={colors.textSecondary} />
              <Text style={styles.emptyTitle}>No GRN found</Text>
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

const LoadListLineRow = ({
  item,
  draft,
  hasEntry,
  issueText,
  expanded,
  canEdit,
  busy,
  onToggle,
  onChange,
}: {
  item: GrnLine;
  draft: GrnLineDraft;
  hasEntry: boolean;
  issueText: string;
  expanded: boolean;
  canEdit: boolean;
  busy: boolean;
  onToggle: () => void;
  onChange: (field: "receivedQty" | "damagedQty", value: number) => void;
}) => (
  <View style={[styles.line, expanded ? styles.lineExpanded : null]}>
    <View style={styles.lineHeader}>
      <View style={styles.lineTitleBlock}>
        <Text style={styles.lineName} numberOfLines={2}>
          {item.itemName}
        </Text>
        <Text style={styles.lineMeta}>
          {item.itemCode} · {item.unitLabel}
        </Text>
      </View>
      <View style={styles.lineValueBlock}>
        <Text style={styles.lineValueLabel}>EXPECTED</Text>
        <Text style={styles.lineValue}>{item.expectedQty}</Text>
      </View>
    </View>

    {expanded && canEdit ? (
      <>
        <View style={styles.stepperGrid}>
          <QuantityStepper
            label="Received"
            value={draft.receivedQty}
            disabled={busy}
            onChange={(value) => onChange("receivedQty", value)}
          />
          <QuantityStepper
            label="Damaged"
            value={draft.damagedQty}
            disabled={busy}
            onChange={(value) => onChange("damagedQty", value)}
          />
        </View>
        <View style={styles.lineFooter}>
          <Text style={issueText ? styles.issueText : styles.matchText}>
            {issueText || (hasEntry ? "Matches expected" : "Not counted yet")}
          </Text>
          <Pressable onPress={onToggle} accessibilityRole="button" style={styles.lineAction}>
            <Text style={styles.lineActionText}>Done</Text>
          </Pressable>
        </View>
      </>
    ) : (
      <View style={styles.lineFooter}>
        <Text
          style={issueText ? styles.issueText : hasEntry ? styles.matchText : styles.pendingText}
        >
          {hasEntry
            ? `${draft.receivedQty} received${issueText ? ` · ${issueText}` : ""}`
            : "Not counted yet"}
        </Text>
        {canEdit ? (
          <Pressable onPress={onToggle} accessibilityRole="button" style={styles.lineAction}>
            <Text style={styles.lineActionText}>{hasEntry ? "Edit" : "Count"}</Text>
          </Pressable>
        ) : null}
      </View>
    )}
  </View>
);

const QuantityStepper = ({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) => (
  <View style={styles.stepperField}>
    <Text style={styles.stepperLabel}>{label}</Text>
    <View style={[styles.stepper, disabled ? styles.stepperDisabled : null]}>
      <Pressable
        onPress={() => onChange(Math.max(value - 1, 0))}
        disabled={disabled || value <= 0}
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${label.toLowerCase()}`}
        style={styles.stepperButton}
      >
        <Ionicons name="remove" size={20} color={colors.primaryDark} />
      </Pressable>
      <TextInput
        value={String(value)}
        editable={!disabled}
        keyboardType="decimal-pad"
        selectTextOnFocus
        accessibilityLabel={label}
        onChangeText={(text) => onChange(parseQuantity(text))}
        style={styles.stepperInput}
      />
      <Pressable
        onPress={() => onChange(value + 1)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label.toLowerCase()}`}
        style={styles.stepperButton}
      >
        <Ionicons name="add" size={20} color={colors.primaryDark} />
      </Pressable>
    </View>
  </View>
);

const styles = StyleSheet.create({
  pauseButton: {
    alignSelf: "flex-start",
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
  },
  pauseText: {
    fontSize: 13,
    fontWeight: typography.fontWeights.medium,
    color: colors.primaryDark,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: typography.fontWeights.semibold,
    color: colors.dangerDark,
  },
  successText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: typography.fontWeights.semibold,
    color: colors.statusSuccess,
  },
  tabs: {
    flexDirection: "row",
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    ...softShadow,
  },
  tab: {
    flex: 1,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.full,
  },
  tabActive: {
    backgroundColor: colors.primary,
    ...primaryGlow,
  },
  tabText: {
    fontSize: 13,
    fontWeight: typography.fontWeights.medium,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.surface,
  },
  emptyLines: {
    paddingVertical: spacing.lg,
    textAlign: "center",
    fontSize: 14,
    color: colors.textSecondary,
  },
  lines: {
    gap: 10,
  },
  line: {
    gap: spacing.md,
    padding: spacing.base,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surface,
    ...softShadow,
  },
  lineExpanded: {
    borderWidth: 2,
    borderColor: colors.violet,
  },
  lineHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  lineTitleBlock: {
    flex: 1,
    gap: 2,
  },
  lineName: {
    ...typography.titleSmall,
    fontSize: 15,
    color: colors.text,
  },
  lineMeta: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  lineValueBlock: {
    alignItems: "flex-end",
  },
  lineValueLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: typography.fontWeights.medium,
    color: colors.textSecondary,
  },
  lineValue: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  lineFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  issueText: {
    flex: 1,
    fontSize: 13,
    fontWeight: typography.fontWeights.semibold,
    color: colors.statusWarning,
  },
  matchText: {
    flex: 1,
    fontSize: 13,
    fontWeight: typography.fontWeights.semibold,
    color: colors.statusSuccess,
  },
  pendingText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
  },
  lineAction: {
    minHeight: 40,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.full,
    backgroundColor: colors.violetSoft,
  },
  lineActionText: {
    fontSize: 14,
    fontWeight: typography.fontWeights.medium,
    color: colors.primaryDark,
  },
  stepperGrid: {
    flexDirection: "row",
    gap: spacing.md,
  },
  stepperField: {
    flex: 1,
    gap: spacing.xs,
  },
  stepperLabel: {
    fontSize: 12,
    fontWeight: typography.fontWeights.medium,
    color: colors.textSecondary,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.background,
    paddingHorizontal: 6,
  },
  stepperDisabled: {
    opacity: 0.5,
  },
  stepperButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.violetSoft,
    borderRadius: 18,
  },
  stepperInput: {
    flex: 1,
    minWidth: 0,
    height: 48,
    textAlign: "center",
    fontSize: 18,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  emptyCard: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyTitle: {
    ...typography.titleSmall,
    color: colors.text,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
