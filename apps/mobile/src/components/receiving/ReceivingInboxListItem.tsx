import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReceivingInboxRow } from "@/contracts/receiving";
import { colors } from "@/theme/colors";
import { borderRadius, spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { softShadow } from "@/theme/elevation";
import { formatDate } from "@/utils/format";

const formatQty = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");

const describeRow = (row: ReceivingInboxRow) => {
  const isLoadList = row.kind === "load_list";
  const meta = isLoadList
    ? row.counterpartyName || "Supplier not set"
    : `Transfer from ${row.counterpartyName || "another branch"}`;

  if (row.stage === "in_progress" && row.doneQty !== null && row.totalQty !== null) {
    return {
      meta,
      value: `${formatQty(row.doneQty)} / ${formatQty(row.totalQty)}`,
      detail: isLoadList ? "lines counted" : "units scanned",
      progress: row.totalQty > 0 ? Math.min(row.doneQty / row.totalQty, 1) : 0,
    };
  }

  if (row.stage === "expected") {
    return {
      meta,
      value: row.expectedAt ? `ETA ${formatDate(row.expectedAt)}` : "No ETA",
      detail: "Opens on arrival",
      progress: null,
    };
  }

  if (row.stage === "completed") {
    return {
      meta,
      value: row.completedAt ? formatDate(row.completedAt) : "-",
      detail: "Received",
      progress: null,
    };
  }

  return isLoadList
    ? {
        meta,
        value: String(row.lineCount),
        detail: row.lineCount === 1 ? "line" : "lines",
        progress: null,
      }
    : {
        meta,
        value: formatQty(row.totalQty ?? 0),
        detail: row.totalQty === 1 ? "unit" : "units",
        progress: null,
      };
};

export const ReceivingInboxListItem = ({
  row,
  onPress,
}: {
  row: ReceivingInboxRow;
  onPress?: () => void;
}) => {
  const { meta, value, detail, progress } = describeRow(row);
  const isLoadList = row.kind === "load_list";
  const kindLabel = isLoadList ? "Load list" : "Delivery note";

  const content = (
    <>
      <View style={styles.mainRow}>
        <View style={[styles.kindTile, isLoadList ? styles.loadListTile : styles.deliveryNoteTile]}>
          <MaterialCommunityIcons
            name={isLoadList ? "truck-outline" : "swap-horizontal"}
            size={22}
            color={isLoadList ? colors.primaryDark : colors.statusInfo}
          />
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.code} numberOfLines={1}>
            {row.code}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        <View style={styles.valueBlock}>
          <Text style={styles.value}>{value}</Text>
          <Text style={styles.detail}>{detail}</Text>
        </View>
        {onPress ? (
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        ) : null}
      </View>
      {progress !== null ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      ) : null}
    </>
  );

  const accessibilityLabel = `${kindLabel} ${row.code}, ${meta}, ${value} ${detail}`;

  if (!onPress) {
    return (
      <View style={styles.row} accessible accessibilityLabel={accessibilityLabel}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
    >
      {content}
    </Pressable>
  );
};

// Kind tile width plus the row gap, so progress aligns with the title text.
const TEXT_INSET = 44 + spacing.md;

const styles = StyleSheet.create({
  row: {
    minHeight: 72,
    padding: 14,
    gap: 10,
    justifyContent: "center",
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surface,
    ...softShadow,
  },
  rowPressed: {
    opacity: 0.7,
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  kindTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  loadListTile: {
    backgroundColor: colors.violetSoft,
  },
  deliveryNoteTile: {
    backgroundColor: colors.blueSoft,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  code: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  valueBlock: {
    alignItems: "flex-end",
    gap: 1,
  },
  value: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  detail: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  progressTrack: {
    height: 6,
    marginLeft: TEXT_INSET,
    borderRadius: 3,
    backgroundColor: colors.violetFaint,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.violet,
  },
});
