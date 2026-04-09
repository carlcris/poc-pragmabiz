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
  itemLabel: string;
  warehouseLabel: string;
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
  colItem: { width: "28%" },
  colWarehouse: { width: "18%" },
  colCategory: { width: "12%" },
  colStockSummary: { width: "24%" },
  colValuation: { width: "18%" },
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
  itemLabel,
  warehouseLabel,
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
  <Document>
    <Page size="A4" orientation="landscape" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <Text style={styles.meta}>
          {generatedAtLabel}: {new Date().toLocaleString()}
        </Text>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <View style={[styles.cell, styles.colItem]}>
            <Text style={styles.tableHeaderText}>{itemLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colWarehouse]}>
            <Text style={styles.tableHeaderText}>{warehouseLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colCategory]}>
            <Text style={styles.tableHeaderText}>{categoryLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colStockSummary]}>
            <Text style={styles.tableHeaderText}>Stock Summary</Text>
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
            <View style={[styles.cell, styles.colWarehouse]}>
              <Text style={styles.cellText}>{row.warehouseCode || noValueLabel}</Text>
              <Text style={styles.cellMuted}>{row.warehouseName || noValueLabel}</Text>
            </View>
            <View style={[styles.cell, styles.colCategory]}>
              <Text style={styles.cellText}>{row.category || noValueLabel}</Text>
            </View>
            <View style={[styles.cell, styles.colStockSummary]}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{qtyOnHandLabel}</Text>
                <Text style={styles.summaryValue}>{formatQty(row.currentStock)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{qtyAvailableLabel}</Text>
                <Text style={styles.summaryValue}>{formatQty(row.availableStock)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{qtyReservedLabel}</Text>
                <Text style={styles.summaryValue}>{formatQty(row.reservedStock)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{qtyInTransitLabel}</Text>
                <Text style={styles.summaryValue}>{formatQty(row.inTransit)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{statusLabel}</Text>
                <Text style={styles.summaryValue}>{statusLabels[row.status]}</Text>
              </View>
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
