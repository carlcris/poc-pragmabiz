import { StyleSheet, Text, View } from "react-native";
import type { ReceivingInboxStage } from "@/contracts/receiving";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
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
      <View style={styles.circle} />
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
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
      {facts.length > 0 ? <Text style={styles.facts}>{facts.join(" · ")}</Text> : null}
      {action}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: spacing.base,
    borderRadius: 22,
    backgroundColor: colors.violetSoft,
    overflow: "hidden",
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 6,
  },
  circle: {
    position: "absolute",
    right: -40,
    top: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.violet,
    opacity: 0.12,
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
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  fill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.violet,
  },
  facts: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
});
