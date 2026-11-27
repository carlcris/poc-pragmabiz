import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { InventoryBoxCountReportRow } from "@/types/inventory-box-count-report";

export const INVENTORY_BOX_COUNT_PAGE_MARGIN = 28;

export type InventoryBoxCountReportPDFProps = {
  title: string;
  categoryName: string;
  businessUnitName: string;
  packingUnitSummary: string;
  generatedAtLine: string;
  totalFullPackingUnits: number;
  totalItems: number;
  itemsWithoutPackingUnitSize: number;
  locale: string;
  rows: InventoryBoxCountReportRow[];
  labels: {
    category: string;
    businessUnit: string;
    packingUnit: string;
    sortedByItemName: string;
    totalFullPackingUnits: string;
    reportedItems: string;
    excludedItems: string;
    fullPackingUnitsNote: string;
    item: string;
    onHand: string;
    fullPackingUnits: string;
    looseUnits: string;
    empty: string;
  };
};

const TEXT = "#111827";
const MUTED = "#4b5563";
const RULE = "#d1d5db";
const WARNING = "#b45309";

const styles = StyleSheet.create({
  page: {
    paddingTop: INVENTORY_BOX_COUNT_PAGE_MARGIN,
    paddingHorizontal: INVENTORY_BOX_COUNT_PAGE_MARGIN,
    // Leaves room for the fixed footer and the page number stamped after assembly.
    paddingBottom: INVENTORY_BOX_COUNT_PAGE_MARGIN + 12,
    fontFamily: "ArialUnicode",
    fontSize: 10,
    color: TEXT,
    backgroundColor: "#ffffff",
  },
  reportHeader: { marginBottom: 12 },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 24,
    paddingBottom: 8,
    marginBottom: 10,
    borderBottomWidth: 1.5,
    borderColor: TEXT,
  },
  title: { fontSize: 21, marginBottom: 6 },
  titleScope: { flex: 1, minWidth: 0 },
  scope: { flexDirection: "row", flexWrap: "wrap", columnGap: 20, rowGap: 3, fontSize: 10.5 },
  scopeItem: { flexDirection: "row", flexShrink: 1, gap: 4 },
  muted: { color: MUTED },
  meta: { alignItems: "flex-end", gap: 3, fontSize: 9, color: MUTED },
  summary: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: RULE,
  },
  metric: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    justifyContent: "space-between",
    gap: 2,
    minWidth: 110,
  },
  metricDivider: { borderLeftWidth: 1, borderColor: RULE },
  metricLabel: { fontSize: 9, color: MUTED },
  primaryValue: { fontSize: 22 },
  secondaryValue: { fontSize: 16 },
  warning: { color: WARNING },
  summaryNote: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    fontSize: 9,
    color: MUTED,
  },
  columnHeadings: {
    flexDirection: "row",
    backgroundColor: "#e5e7eb",
    borderBottomWidth: 1,
    borderColor: "#9ca3af",
  },
  heading: { paddingHorizontal: 7, paddingVertical: 6, fontSize: 9.5 },
  fullPackingUnitsHeading: { backgroundColor: RULE },
  row: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#e5e7eb" },
  cell: { paddingHorizontal: 7, paddingVertical: 6 },
  itemCode: { fontSize: 9, color: MUTED, marginTop: 2 },
  quantity: { textAlign: "right" },
  unit: { fontSize: 9, color: "#6b7280" },
  fullPackingUnitsCell: { backgroundColor: "#f9fafb", fontSize: 11 },
  empty: { paddingHorizontal: 7, paddingVertical: 8, color: MUTED },
  item: { width: "52%" },
  onHand: { width: "16%" },
  fullPackingUnits: { width: "16%" },
  looseUnits: { width: "16%" },
  footer: {
    position: "absolute",
    left: INVENTORY_BOX_COUNT_PAGE_MARGIN,
    right: INVENTORY_BOX_COUNT_PAGE_MARGIN,
    bottom: 12,
    paddingTop: 5,
    paddingRight: 65,
    borderTopWidth: 1,
    borderColor: RULE,
    fontSize: 9,
    color: MUTED,
  },
});

export function InventoryBoxCountReportPDF({
  title,
  categoryName,
  businessUnitName,
  packingUnitSummary,
  generatedAtLine,
  totalFullPackingUnits,
  totalItems,
  itemsWithoutPackingUnitSize,
  locale,
  rows,
  labels,
  showReportHeader = true,
  isLastJob = true,
}: InventoryBoxCountReportPDFProps & { showReportHeader?: boolean; isLastJob?: boolean }) {
  const quantities = new Intl.NumberFormat(locale, { maximumFractionDigits: 4 });
  const wholeNumbers = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const renderQuantity = (value: number, unit: string | null) => (
    <>
      {quantities.format(value)}
      {unit && <Text style={styles.unit}>{` ${unit}`}</Text>}
    </>
  );

  return (
    <Document title={title}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {showReportHeader && (
          <View style={styles.reportHeader} wrap={false}>
            <View style={styles.titleRow}>
              <View style={styles.titleScope}>
                <Text style={styles.title}>{title}</Text>
                <View style={styles.scope}>
                  <View style={styles.scopeItem}>
                    <Text style={styles.muted}>{labels.category}</Text>
                    <Text>{categoryName}</Text>
                  </View>
                  <View style={styles.scopeItem}>
                    <Text style={styles.muted}>{labels.businessUnit}</Text>
                    <Text>{businessUnitName}</Text>
                  </View>
                  <View style={styles.scopeItem}>
                    <Text style={styles.muted}>{labels.packingUnit}</Text>
                    <Text>{packingUnitSummary}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.meta}>
                <Text>{generatedAtLine}</Text>
                <Text>{labels.sortedByItemName}</Text>
              </View>
            </View>
            <View style={styles.summary}>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>{labels.totalFullPackingUnits}</Text>
                <Text style={styles.primaryValue}>
                  {wholeNumbers.format(totalFullPackingUnits)}
                </Text>
              </View>
              <View style={[styles.metric, styles.metricDivider]}>
                <Text style={styles.metricLabel}>{labels.reportedItems}</Text>
                <Text style={styles.secondaryValue}>{wholeNumbers.format(totalItems)}</Text>
              </View>
              <View style={[styles.metric, styles.metricDivider]}>
                <Text style={styles.metricLabel}>{labels.excludedItems}</Text>
                <Text
                  style={
                    itemsWithoutPackingUnitSize > 0
                      ? [styles.secondaryValue, styles.warning]
                      : styles.secondaryValue
                  }
                >
                  {wholeNumbers.format(itemsWithoutPackingUnitSize)}
                </Text>
              </View>
              <View style={[styles.summaryNote, styles.metricDivider]}>
                <Text>{labels.fullPackingUnitsNote}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.columnHeadings} fixed>
          <Text style={[styles.heading, styles.item]}>{labels.item}</Text>
          <Text style={[styles.heading, styles.onHand, styles.quantity]}>{labels.onHand}</Text>
          <Text
            style={[
              styles.heading,
              styles.fullPackingUnits,
              styles.quantity,
              styles.fullPackingUnitsHeading,
            ]}
          >
            {labels.fullPackingUnits}
          </Text>
          <Text style={[styles.heading, styles.looseUnits, styles.quantity]}>
            {labels.looseUnits}
          </Text>
        </View>

        {rows.length === 0 && <Text style={styles.empty}>{labels.empty}</Text>}
        {rows.map((row, index) => (
          <View
            key={row.itemId}
            id={isLastJob ? undefined : String(index)}
            style={styles.row}
            wrap={false}
          >
            <View style={[styles.cell, styles.item]}>
              <Text>{row.itemName}</Text>
              <Text style={styles.itemCode}>{row.itemCode}</Text>
            </View>
            <Text style={[styles.cell, styles.onHand, styles.quantity]}>
              {renderQuantity(row.onHand, row.baseUnit)}
            </Text>
            <Text
              style={[
                styles.cell,
                styles.fullPackingUnits,
                styles.quantity,
                styles.fullPackingUnitsCell,
              ]}
            >
              {wholeNumbers.format(row.fullPackingUnits)}
            </Text>
            <Text style={[styles.cell, styles.looseUnits, styles.quantity]}>
              {renderQuantity(row.looseUnits, row.baseUnit)}
            </Text>
          </View>
        ))}

        <Text style={styles.footer} fixed>
          {[title, categoryName, businessUnitName, packingUnitSummary].join(" · ")}
        </Text>
      </Page>
    </Document>
  );
}
