import { StyleSheet, Text, View } from "react-native";
import type { ReceivingInboxStage } from "@/contracts/receiving";
import { colors } from "@/theme/colors";
import { borderRadius, spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { RECEIVING_INBOX_STAGE_COLORS, RECEIVING_INBOX_STAGE_LABELS } from "./receiving-stages";

const formatQty = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");

export const ReceivingProgressSummary = ({
  stage,
  done,
  total,
  unitLabel,
  facts,
  action,
}: {
  stage: ReceivingInboxStage | null;
  done: number;
  total: number;
  unitLabel: string;
  facts: string[];
  action?: React.ReactNode;
}) => {
  const progress = total > 0 ? Math.min(done / total, 1) : 0;
  const stageColor = stage ? RECEIVING_INBOX_STAGE_COLORS[stage] : colors.statusNeutral;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        {stage ? (
          <View style={styles.stage}>
            <View style={[styles.stageDot, { backgroundColor: stageColor }]} />
            <Text style={[styles.stageText, { color: stageColor }]}>
              {RECEIVING_INBOX_STAGE_LABELS[stage]}
            </Text>
          </View>
        ) : (
          <View />
        )}
        <Text style={styles.count}>
          {formatQty(done)} / {formatQty(total)} <Text style={styles.countUnit}>{unitLabel}</Text>
        </Text>
      </View>
      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityLabel={unitLabel}
        accessibilityValue={{ min: 0, max: total, now: done }}
      >
        <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: stageColor }]} />
      </View>
      {facts.length > 0 ? <Text style={styles.facts}>{facts.join(" · ")}</Text> : null}
      {action}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.base,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  stage: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  stageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stageText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: typography.fontWeights.semibold,
  },
  count: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  countUnit: {
    fontWeight: typography.fontWeights.regular,
    color: colors.textSecondary,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.backgroundSecondary,
    overflow: "hidden",
  },
  fill: {
    height: 6,
    borderRadius: 3,
  },
  facts: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
});
