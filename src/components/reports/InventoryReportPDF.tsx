import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { InventoryReportRow, InventoryStockStatus } from "@/hooks/useInventoryReport";

Font.register({
  family: "ArialUnicode",
  fonts: [
    { src: "/fonts/ArialUnicode.ttf", fontWeight: "normal" },
    { src: "/fonts/ArialUnicode.ttf", fontWeight: "bold" },
  ],
});

type InventoryReportPDFProps = {
  title: string;
  subtitle: string;
  generatedAtLabel: string;
  warehouseValueLabel: string;
  itemLabel: string;
  categoryLabel: string;
  qtyOnHandLabel: string;
  qtyReservedLabel: string;
  qtyAvailableLabel: string;
  qtyInTransitLabel: string;
  statusLabel: string;
  unitCostLabel: string;
  stockValueLabel: string;
  noValueLabel: string;
  pageSummary: string;
  statusLabels: Record<InventoryStockStatus, string>;
  rows: InventoryReportRow[];
};

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 11,
    fontFamily: "ArialUnicode",
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  header: {
    marginBottom: 14,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontFamily: "ArialUnicode",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: "#6b7280",
    marginBottom: 6,
  },
  meta: {
    fontSize: 11,
    color: "#6b7280",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    marginTop: 8,
  },
  metaLeft: {
    flex: 1,
    fontSize: 11,
    color: "#374151",
  },
  metaRight: {
    flex: 1,
    fontSize: 11,
    color: "#6b7280",
    textAlign: "right",
  },
  table: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 4,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#e5e7eb",
    minHeight: 40,
    alignItems: "center",
  },
  tableHeaderText: {
    color: "#111827",
    fontFamily: "ArialUnicode",
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    minHeight: 68,
    alignItems: "stretch",
  },
  cell: {
    paddingHorizontal: 6,
    paddingVertical: 10,
    justifyContent: "center",
  },
  cellText: {
    fontSize: 10,
  },
  cellMuted: {
    fontSize: 9,
    color: "#6b7280",
    marginTop: 2,
  },
  summaryLabel: {
    fontSize: 9,
    color: "#6b7280",
  },
  summaryValue: {
    fontSize: 10,
    fontFamily: "ArialUnicode",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 3,
  },
  right: {
    textAlign: "right",
  },
  colItem: { width: "22%" },
  colCategory: { width: "10%" },
  colQty: { width: "8.5%" },
  colStatus: { width: "12%" },
  colValuation: { width: "22%" },
  footer: {
    marginTop: 10,
    fontSize: 11,
    color: "#6b7280",
    textAlign: "right",
  },
});

const formatQty = (value: number) => value.toFixed(2);
const formatMoney = (value: number) => value.toFixed(2);

export const InventoryReportPDF = ({
  title,
  subtitle,
  generatedAtLabel,
  warehouseValueLabel,
  itemLabel,
  categoryLabel,
  qtyOnHandLabel,
  qtyReservedLabel,
  qtyAvailableLabel,
  qtyInTransitLabel,
  statusLabel,
  unitCostLabel,
  stockValueLabel,
  noValueLabel,
  pageSummary,
  statusLabels,
  rows,
}: InventoryReportPDFProps) => (
  <Document title={title}>
    <Page size="A4" orientation="landscape" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaLeft}>{warehouseValueLabel}</Text>
          <Text style={styles.metaRight}>
            {generatedAtLabel}: {new Date().toLocaleString()}
          </Text>
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <View style={[styles.cell, styles.colItem]}>
            <Text style={styles.tableHeaderText}>{itemLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colCategory]}>
            <Text style={styles.tableHeaderText}>{categoryLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colQty]}>
            <Text style={[styles.tableHeaderText, styles.right]}>{qtyOnHandLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colQty]}>
            <Text style={[styles.tableHeaderText, styles.right]}>{qtyReservedLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colQty]}>
            <Text style={[styles.tableHeaderText, styles.right]}>{qtyAvailableLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colQty]}>
            <Text style={[styles.tableHeaderText, styles.right]}>{qtyInTransitLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colStatus]}>
            <Text style={styles.tableHeaderText}>{statusLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colValuation]}>
            <Text style={styles.tableHeaderText}>Valuation</Text>
          </View>
        </View>

        {rows.map((row) => (
          <View key={row.id} style={styles.row}>
            <View style={[styles.cell, styles.colItem]}>
              <Text style={styles.cellText}>{row.itemName || noValueLabel}</Text>
              <Text style={styles.cellMuted}>
                {row.itemCode || noValueLabel}
                {row.uom ? ` • ${row.uom}` : ""}
              </Text>
            </View>
            <View style={[styles.cell, styles.colCategory]}>
              <Text style={styles.cellText}>{row.category || noValueLabel}</Text>
            </View>
            <View style={[styles.cell, styles.colQty]}>
              <Text style={[styles.cellText, styles.right]}>{formatQty(row.currentStock)}</Text>
            </View>
            <View style={[styles.cell, styles.colQty]}>
              <Text style={[styles.cellText, styles.right]}>{formatQty(row.reservedStock)}</Text>
            </View>
            <View style={[styles.cell, styles.colQty]}>
              <Text style={[styles.cellText, styles.right]}>{formatQty(row.availableStock)}</Text>
            </View>
            <View style={[styles.cell, styles.colQty]}>
              <Text style={[styles.cellText, styles.right]}>{formatQty(row.inTransit)}</Text>
            </View>
            <View style={[styles.cell, styles.colStatus]}>
              <Text style={styles.cellText}>{statusLabels[row.status]}</Text>
            </View>
            <View style={[styles.cell, styles.colValuation]}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{unitCostLabel}</Text>
                <Text style={styles.summaryValue}>{formatMoney(row.unitCost)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{stockValueLabel}</Text>
                <Text style={styles.summaryValue}>{formatMoney(row.stockValue)}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.footer}>{pageSummary}</Text>
    </Page>
  </Document>
);
