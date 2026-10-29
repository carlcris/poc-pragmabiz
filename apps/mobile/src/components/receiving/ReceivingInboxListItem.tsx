import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReceivingInboxRow } from "@/contracts/receiving";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
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
  isFirst,
  onPress,
}: {
  row: ReceivingInboxRow;
  isFirst: boolean;
  onPress?: () => void;
}) => {
  const { meta, value, detail, progress } = describeRow(row);
  const kindLabel = row.kind === "load_list" ? "Load list" : "Delivery note";

  const content = (
    <>
      <View style={styles.mainRow}>
        {row.kind === "load_list" ? (
          <MaterialCommunityIcons name="truck-outline" size={22} color={colors.textSecondary} />
        ) : (
          <MaterialCommunityIcons name="swap-horizontal" size={22} color={colors.textSecondary} />
        )}
        <View style={styles.titleBlock}>
          <Text style={styles.code}>{row.code}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        <View style={styles.valueBlock}>
          <Text style={styles.value}>{value}</Text>
          <Text style={styles.detail}>{detail}</Text>
        </View>
        {onPress ? (
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        ) : (
          <View style={styles.chevronSpacer} />
        )}
      </View>
      {progress !== null ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      ) : null}
    </>
  );

  const rowStyle = [styles.row, isFirst ? null : styles.rowDivider];

  if (!onPress) {
    return (
      <View
        style={rowStyle}
        accessible
        accessibilityLabel={`${kindLabel} ${row.code}, ${meta}, ${value} ${detail}`}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${kindLabel} ${row.code}, ${meta}, ${value} ${detail}`}
      style={({ pressed }) => [...rowStyle, pressed ? styles.rowPressed : null]}
    >
      {content}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    minHeight: 68,
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.md,
    gap: spacing.sm,
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowPressed: {
    backgroundColor: colors.primarySoft,
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  code: {
    ...typography.titleSmall,
    color: colors.text,
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  valueBlock: {
    alignItems: "flex-end",
    gap: 2,
  },
  value: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  detail: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  chevronSpacer: {
    width: 20,
  },
  progressTrack: {
    height: 4,
    marginLeft: 34,
    marginRight: 32,
    borderRadius: 2,
    backgroundColor: colors.warningTrack,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.statusWarning,
  },
});
