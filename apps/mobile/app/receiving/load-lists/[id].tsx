import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Card, ErrorState, LoadingState, Screen, StatusBadge } from "@/components/ui";
import { useLoadListReceiving } from "@/hooks/queries";
import { colors } from "@/theme/colors";
import { borderRadius, spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { formatDate } from "@/utils/format";

export default function LoadListReceivingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useLoadListReceiving(id);
  const loadList = detail.data?.loadList;
  const grn = detail.data?.grn;
  const checkedItems = grn?.items.filter((item) => item.receivedQty > 0 || item.damagedQty > 0).length || 0;
  const totalItems = grn?.items.length || 0;
  const progress = totalItems > 0 ? checkedItems / totalItems : 0;

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

              <View style={styles.itemsSection}>
                {grn.items.map((item) => {
                  const hasEntry = item.receivedQty > 0 || item.damagedQty > 0;
                  const variance = hasEntry ? item.receivedQty + item.damagedQty - item.expectedQty : null;
                  const hasIssue = item.damagedQty > 0 || (variance !== null && variance < 0);

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
                        <QuantityBox label="Received" value={item.receivedQty} tone="green" />
                        <QuantityBox label="Damaged" value={item.damagedQty} tone="red" />
                        <QuantityBox label="Boxes" value={item.boxCount} tone="blue" />
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
          ) : (
            <Card style={styles.emptyCard}>
              <Ionicons name="document-text-outline" size={48} color={colors.muted} />
              <Text style={styles.emptyTitle}>No GRN Found</Text>
              <Text style={styles.emptyText}>
                A goods receipt note has not been created for this load list yet.
              </Text>
            </Card>
          )}
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    alignItems: "center"
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
