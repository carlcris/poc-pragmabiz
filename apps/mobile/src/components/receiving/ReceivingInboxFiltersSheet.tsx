import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type {
  ReceivingInboxKindFilter,
  ReceivingInboxStageCount,
  ReceivingInboxStageFilter,
} from "@/contracts/receiving";
import { colors } from "@/theme/colors";
import { borderRadius, spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import {
  RECEIVING_INBOX_KIND_FILTERS,
  RECEIVING_INBOX_STAGE_FILTERS,
  countReceivingInbox,
} from "./receiving-stages";

export const ReceivingInboxFiltersSheet = ({
  visible,
  stage,
  kind,
  stageCounts,
  showKindFilter,
  onApply,
  onClose,
}: {
  visible: boolean;
  stage: ReceivingInboxStageFilter;
  kind: ReceivingInboxKindFilter;
  stageCounts: ReceivingInboxStageCount[];
  showKindFilter: boolean;
  onApply: (stage: ReceivingInboxStageFilter, kind: ReceivingInboxKindFilter) => void;
  onClose: () => void;
}) => {
  const [draftStage, setDraftStage] = useState(stage);
  const [draftKind, setDraftKind] = useState(kind);

  useEffect(() => {
    if (visible) {
      setDraftStage(stage);
      setDraftKind(kind);
    }
  }, [kind, stage, visible]);

  const resultCount = countReceivingInbox(stageCounts, draftStage, draftKind);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close filters"
        />
        <SafeAreaView edges={["bottom"]} style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              Filter incoming
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close filters"
              style={styles.closeButton}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          {showKindFilter ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Document type</Text>
              <View style={styles.segmented}>
                {RECEIVING_INBOX_KIND_FILTERS.map((option) => {
                  const active = option.value === draftKind;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setDraftKind(option.value)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={[styles.segment, active ? styles.segmentActive : null]}
                    >
                      <Text style={[styles.segmentText, active ? styles.segmentTextActive : null]}>
                        {option.label} ·{" "}
                        {countReceivingInbox(stageCounts, draftStage, option.value)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Stage</Text>
            {RECEIVING_INBOX_STAGE_FILTERS.map((option, index) => {
              const active = option.value === draftStage;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setDraftStage(option.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  style={[styles.stageOption, index > 0 ? styles.stageOptionDivider : null]}
                >
                  <Ionicons
                    name={active ? "radio-button-on" : "radio-button-off"}
                    size={22}
                    color={active ? colors.primaryDark : colors.textSecondary}
                  />
                  <View style={styles.stageText}>
                    <Text style={styles.stageLabel}>{option.label}</Text>
                    <Text style={styles.stageHint}>{option.hint}</Text>
                  </View>
                  <Text style={styles.stageCount}>
                    {countReceivingInbox(stageCounts, option.value, draftKind)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.footer}>
            <Pressable
              onPress={() => {
                setDraftStage("to_receive");
                setDraftKind("all");
              }}
              accessibilityRole="button"
              style={styles.resetButton}
            >
              <Text style={styles.resetText}>Reset</Text>
            </Pressable>
            <Pressable
              onPress={() => onApply(draftStage, draftKind)}
              accessibilityRole="button"
              style={styles.applyButton}
            >
              <Text style={styles.applyText}>
                Show {resultCount} {resultCount === 1 ? "result" : "results"}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.base,
    gap: spacing.base,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textDisabled,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  closeButton: {
    width: 44,
    height: 44,
    marginRight: -spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.full,
  },
  section: {
    gap: spacing.xs,
  },
  sectionLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: typography.fontWeights.semibold,
    color: colors.statusNeutral,
    marginBottom: spacing.xs,
  },
  segmented: {
    flexDirection: "row",
    gap: 3,
    padding: 3,
    borderRadius: borderRadius.md,
    backgroundColor: colors.backgroundSecondary,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: spacing.xs,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  segmentActive: {
    backgroundColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: typography.fontWeights.semibold,
    color: colors.textSecondary,
    textAlign: "center",
  },
  segmentTextActive: {
    color: colors.text,
  },
  stageOption: {
    minHeight: 52,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  stageOptionDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  stageText: {
    flex: 1,
    gap: 1,
  },
  stageLabel: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
  },
  stageHint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  stageCount: {
    minWidth: 28,
    textAlign: "right",
    fontSize: 15,
    fontWeight: typography.fontWeights.semibold,
    color: colors.statusNeutral,
    fontVariant: ["tabular-nums"],
  },
  footer: {
    flexDirection: "row",
    gap: spacing.md,
  },
  resetButton: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetText: {
    fontSize: 15,
    fontWeight: typography.fontWeights.semibold,
    color: colors.statusNeutral,
  },
  applyButton: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryDark,
  },
  applyText: {
    fontSize: 15,
    fontWeight: typography.fontWeights.semibold,
    color: colors.surface,
  },
});
