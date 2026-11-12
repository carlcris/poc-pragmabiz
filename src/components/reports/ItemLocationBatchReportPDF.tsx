import {
  itemLocationBatchGroupKey,
  type ItemLocationGroupSubtotal,
} from "@/lib/reports/item-location-report-groups";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ItemLocationBatchReportRow } from "@/hooks/useItemLocationBatchReport";

export const ITEM_LOCATION_REPORT_PAGE_MARGIN = 28;

export type ItemLocationBatchReportPDFProps = {
  title: string;
  subtitle: string;
  generatedAtLabel: string;
  generatedAt: string;
  itemLabel: string;
  warehouseLocationLabel: string;
  batchLabel: string;
  locationSkuLabel: string;
  onHandLabel: string;
  reservedLabel: string;
  availableLabel: string;
  noValueLabel: string;
  groupBy: "item" | "batch";
  noRowsLabel: string;
  subtotalLabel: string;
  groupSubtotals: Record<string, ItemLocationGroupSubtotal>;
  rows: ItemLocationBatchReportRow[];
};

const styles = StyleSheet.create({
  page: {
    padding: ITEM_LOCATION_REPORT_PAGE_MARGIN,
    fontSize: 10,
    fontFamily: "ArialUnicode",
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  header: { marginBottom: 14 },
  title: { fontSize: 24, marginBottom: 4 },
  subtitle: { fontSize: 13, color: "#6b7280", marginBottom: 6 },
  meta: { fontSize: 10, color: "#6b7280" },
  tableEnd: { borderBottomWidth: 1, borderColor: "#d1d5db" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#e5e7eb",
    minHeight: 36,
    alignItems: "center",
  },
  columnHeadings: { borderTopWidth: 1, borderTopColor: "#d1d5db" },
  row: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#e5e7eb", minHeight: 38 },
  cell: { paddingHorizontal: 4, paddingVertical: 7, justifyContent: "center" },
  headerText: { fontSize: 9 },
  cellText: { fontSize: 9 },
  muted: { fontSize: 8, color: "#6b7280", marginTop: 2 },
  right: { textAlign: "right" },
  wLocation: { width: "44%" },
  wSku: { width: "20%" },
  wQty: { width: "12%" },
  subtotal: {
    flexDirection: "row",
    backgroundColor: "#e5e7eb",
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
  },
  wSubtotalLabel: { width: "64%" },
  locationIndent: { paddingLeft: 36 },
  subgroup: { backgroundColor: "#f3f4f6", paddingLeft: 20, paddingVertical: 6 },
});

const qty = (value: number) => value.toFixed(2);

export const ItemLocationBatchReportPDF = ({
  title,
  subtitle,
  generatedAtLabel,
  generatedAt,
  itemLabel,
  warehouseLocationLabel,
  batchLabel,
  locationSkuLabel,
  onHandLabel,
  reservedLabel,
  availableLabel,
  noValueLabel,
  groupBy,
  noRowsLabel,
  subtotalLabel,
  groupSubtotals,
  rows,
  previousRow,
  showReportHeader = true,
  isLastJob = true,
}: ItemLocationBatchReportPDFProps & {
  previousRow?: ItemLocationBatchReportRow;
  showReportHeader?: boolean;
  isLastJob?: boolean;
}) => (
  <Document title={title}>
    <Page size="A4" orientation="landscape" style={styles.page}>
      {showReportHeader && (
        <View style={styles.header} wrap={false}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <Text style={styles.meta}>
            {generatedAtLabel}: {generatedAt}
          </Text>
        </View>
      )}

      <View style={[styles.tableHeader, styles.columnHeadings]} fixed>
        <View style={[styles.cell, styles.wLocation]}>
          <Text style={styles.headerText}>{warehouseLocationLabel}</Text>
        </View>
        <View style={[styles.cell, styles.wSku]}>
          <Text style={styles.headerText}>{locationSkuLabel}</Text>
        </View>
        <View style={[styles.cell, styles.wQty]}>
          <Text style={[styles.headerText, styles.right]}>{onHandLabel}</Text>
        </View>
        <View style={[styles.cell, styles.wQty]}>
          <Text style={[styles.headerText, styles.right]}>{reservedLabel}</Text>
        </View>
        <View style={[styles.cell, styles.wQty]}>
          <Text style={[styles.headerText, styles.right]}>{availableLabel}</Text>
        </View>
      </View>

      {rows.length === 0 && <Text style={styles.cell}>{noRowsLabel}</Text>}
      {rows.map((row, index) => {
        const previous = index === 0 ? previousRow : rows[index - 1];
        const itemChanged = previous?.itemId !== row.itemId;
        const batchChanged =
          !previous || itemLocationBatchGroupKey(previous) !== itemLocationBatchGroupKey(row);
        return (
          <View
            key={row.id}
            id={isLastJob ? undefined : String(index)}
            wrap={false}
            style={isLastJob && index === rows.length - 1 ? styles.tableEnd : undefined}
          >
            {(groupBy === "item" ? itemChanged : batchChanged) && (
              <View style={styles.tableHeader}>
                <Text style={styles.cell}>
                  {groupBy === "item"
                    ? `${itemLabel}: ${row.itemCode || noValueLabel} — ${row.itemName || noValueLabel}`
                    : `${batchLabel}: ${row.batchCode || noValueLabel}`}
                </Text>
              </View>
            )}
            {(itemChanged || batchChanged) && (
              <View style={styles.subgroup}>
                <Text style={styles.cellText}>
                  {groupBy === "batch"
                    ? `${row.itemCode || noValueLabel} — ${row.itemName || noValueLabel}`
                    : row.batchCode || noValueLabel}
                </Text>
              </View>
            )}
            <View style={styles.row}>
              <View style={[styles.cell, styles.wLocation, styles.locationIndent]}>
                <Text style={styles.cellText}>{row.warehouseCode || noValueLabel}</Text>
                <Text style={styles.muted}>{row.locationPath || noValueLabel}</Text>
              </View>
              <View style={[styles.cell, styles.wSku]}>
                <Text style={styles.cellText}>{row.batchLocationSku || noValueLabel}</Text>
              </View>
              <View style={[styles.cell, styles.wQty]}>
                <Text style={[styles.cellText, styles.right]}>{qty(row.qtyOnHand)}</Text>
              </View>
              <View style={[styles.cell, styles.wQty]}>
                <Text style={[styles.cellText, styles.right]}>{qty(row.qtyReserved)}</Text>
              </View>
              <View style={[styles.cell, styles.wQty]}>
                <Text style={[styles.cellText, styles.right]}>{qty(row.qtyAvailable)}</Text>
              </View>
            </View>
            {groupSubtotals[row.id] && (
              <View style={styles.subtotal}>
                <View style={[styles.cell, styles.wSubtotalLabel]}>
                  <Text style={styles.cellText}>{subtotalLabel}</Text>
                </View>
                <View style={[styles.cell, styles.wQty]}>
                  <Text style={[styles.cellText, styles.right]}>
                    {qty(groupSubtotals[row.id].qtyOnHand)}
                  </Text>
                </View>
                <View style={[styles.cell, styles.wQty]}>
                  <Text style={[styles.cellText, styles.right]}>
                    {qty(groupSubtotals[row.id].qtyReserved)}
                  </Text>
                </View>
                <View style={[styles.cell, styles.wQty]}>
                  <Text style={[styles.cellText, styles.right]}>
                    {qty(groupSubtotals[row.id].qtyAvailable)}
                  </Text>
                </View>
              </View>
            )}
          </View>
        );
      })}
    </Page>
  </Document>
);
