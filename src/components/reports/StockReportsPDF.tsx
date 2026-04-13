import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { StockMovementData, StockValuationData } from "@/hooks/useStockReports";

Font.register({
  family: "ArialUnicode",
  fonts: [
    { src: "/fonts/ArialUnicode.ttf", fontWeight: "normal" },
    { src: "/fonts/ArialUnicode.ttf", fontWeight: "bold" },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 10,
    fontFamily: "ArialUnicode",
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  header: {
    marginBottom: 14,
  },
  title: {
    fontSize: 24,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 6,
  },
  meta: {
    fontSize: 10,
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
    minHeight: 36,
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    minHeight: 38,
    alignItems: "stretch",
  },
  cell: {
    paddingHorizontal: 4,
    paddingVertical: 7,
    justifyContent: "center",
  },
  headerText: {
    fontSize: 9,
  },
  cellText: {
    fontSize: 9,
  },
  muted: {
    fontSize: 8,
    color: "#6b7280",
    marginTop: 2,
  },
  right: {
    textAlign: "right",
  },
  footer: {
    marginTop: 10,
    textAlign: "right",
    fontSize: 10,
    color: "#6b7280",
  },
  wItem: { width: "20%" },
  wWarehouse: { width: "16%" },
  wCategory: { width: "12%" },
  wUom: { width: "8%" },
  wQty: { width: "9%" },
  wValue: { width: "10%" },
  wTxn: { width: "7%" },
});

const qty = (value: number) => value.toFixed(2);
const money = (value: number) => value.toFixed(2);

type StockMovementReportPDFProps = {
  title: string;
  subtitle: string;
  generatedAtLabel: string;
  itemLabel: string;
  warehouseLabel: string;
  inQtyLabel: string;
  outQtyLabel: string;
  netLabel: string;
  inValueLabel: string;
  outValueLabel: string;
  netValueLabel: string;
  transactionsLabel: string;
  noValueLabel: string;
  pageSummary: string;
  rows: StockMovementData[];
};

export const StockMovementReportPDF = ({
  title,
  subtitle,
  generatedAtLabel,
  itemLabel,
  warehouseLabel,
  inQtyLabel,
  outQtyLabel,
  netLabel,
  inValueLabel,
  outValueLabel,
  netValueLabel,
  transactionsLabel,
  noValueLabel,
  pageSummary,
  rows,
}: StockMovementReportPDFProps) => (
  <Document title={title}>
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
          <View style={[styles.cell, styles.wItem]}>
            <Text style={styles.headerText}>{itemLabel}</Text>
          </View>
          <View style={[styles.cell, styles.wWarehouse]}>
            <Text style={styles.headerText}>{warehouseLabel}</Text>
          </View>
          <View style={[styles.cell, styles.wQty]}>
            <Text style={[styles.headerText, styles.right]}>{inQtyLabel}</Text>
          </View>
          <View style={[styles.cell, styles.wQty]}>
            <Text style={[styles.headerText, styles.right]}>{outQtyLabel}</Text>
          </View>
          <View style={[styles.cell, styles.wQty]}>
            <Text style={[styles.headerText, styles.right]}>{netLabel}</Text>
          </View>
          <View style={[styles.cell, styles.wValue]}>
            <Text style={[styles.headerText, styles.right]}>{inValueLabel}</Text>
          </View>
          <View style={[styles.cell, styles.wValue]}>
            <Text style={[styles.headerText, styles.right]}>{outValueLabel}</Text>
          </View>
          <View style={[styles.cell, styles.wValue]}>
            <Text style={[styles.headerText, styles.right]}>{netValueLabel}</Text>
          </View>
          <View style={[styles.cell, styles.wTxn]}>
            <Text style={[styles.headerText, styles.right]}>{transactionsLabel}</Text>
          </View>
        </View>

        {rows.map((row, index) => (
          <View key={`${row.itemId}-${row.warehouseId}-${index}`} style={styles.row}>
            <View style={[styles.cell, styles.wItem]}>
              <Text style={styles.cellText}>{row.itemCode || noValueLabel}</Text>
              <Text style={styles.muted}>{row.itemName || noValueLabel}</Text>
            </View>
            <View style={[styles.cell, styles.wWarehouse]}>
              <Text style={styles.cellText}>{row.warehouseCode || noValueLabel}</Text>
              <Text style={styles.muted}>{row.warehouseName || noValueLabel}</Text>
            </View>
            <View style={[styles.cell, styles.wQty]}>
              <Text style={[styles.cellText, styles.right]}>{qty(row.totalIn)}</Text>
            </View>
            <View style={[styles.cell, styles.wQty]}>
              <Text style={[styles.cellText, styles.right]}>{qty(row.totalOut)}</Text>
            </View>
            <View style={[styles.cell, styles.wQty]}>
              <Text style={[styles.cellText, styles.right]}>{qty(row.netMovement)}</Text>
            </View>
            <View style={[styles.cell, styles.wValue]}>
              <Text style={[styles.cellText, styles.right]}>{money(row.totalInValue)}</Text>
            </View>
            <View style={[styles.cell, styles.wValue]}>
              <Text style={[styles.cellText, styles.right]}>{money(row.totalOutValue)}</Text>
            </View>
            <View style={[styles.cell, styles.wValue]}>
              <Text style={[styles.cellText, styles.right]}>{money(row.netValue)}</Text>
            </View>
            <View style={[styles.cell, styles.wTxn]}>
              <Text style={[styles.cellText, styles.right]}>{row.transactionCount}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.footer}>{pageSummary}</Text>
    </Page>
  </Document>
);

type StockValuationReportPDFProps = {
  title: string;
  subtitle: string;
  generatedAtLabel: string;
  itemLabel: string;
  warehouseLabel: string;
  categoryLabel: string;
  qtyOnHandLabel: string;
  unitCostLabel: string;
  totalValueLabel: string;
  noValueLabel: string;
  pageSummary: string;
  rows: StockValuationData[];
};

export const StockValuationReportPDF = ({
  title,
  subtitle,
  generatedAtLabel,
  itemLabel,
  warehouseLabel,
  categoryLabel,
  qtyOnHandLabel,
  unitCostLabel,
  totalValueLabel,
  noValueLabel,
  pageSummary,
  rows,
}: StockValuationReportPDFProps) => (
  <Document title={title}>
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
          <View style={[styles.cell, styles.wItem]}>
            <Text style={styles.headerText}>{itemLabel}</Text>
          </View>
          <View style={[styles.cell, styles.wWarehouse]}>
            <Text style={styles.headerText}>{warehouseLabel}</Text>
          </View>
          <View style={[styles.cell, styles.wCategory]}>
            <Text style={styles.headerText}>{categoryLabel}</Text>
          </View>
          <View style={[styles.cell, styles.wQty]}>
            <Text style={[styles.headerText, styles.right]}>{qtyOnHandLabel}</Text>
          </View>
          <View style={[styles.cell, styles.wValue]}>
            <Text style={[styles.headerText, styles.right]}>{unitCostLabel}</Text>
          </View>
          <View style={[styles.cell, styles.wValue]}>
            <Text style={[styles.headerText, styles.right]}>{totalValueLabel}</Text>
          </View>
        </View>

        {rows.map((row, index) => (
          <View key={`${row.groupKey}-${index}`} style={styles.row}>
            <View style={[styles.cell, styles.wItem]}>
              <Text style={styles.cellText}>{row.itemCode || noValueLabel}</Text>
              <Text style={styles.muted}>{row.itemName || row.groupName || noValueLabel}</Text>
            </View>
            <View style={[styles.cell, styles.wWarehouse]}>
              <Text style={styles.cellText}>{row.warehouseCode || noValueLabel}</Text>
              <Text style={styles.muted}>{row.warehouseName || noValueLabel}</Text>
            </View>
            <View style={[styles.cell, styles.wCategory]}>
              <Text style={styles.cellText}>{row.category || noValueLabel}</Text>
            </View>
            <View style={[styles.cell, styles.wQty]}>
              <Text style={[styles.cellText, styles.right]}>{qty(row.totalQuantity)}</Text>
            </View>
            <View style={[styles.cell, styles.wValue]}>
              <Text style={[styles.cellText, styles.right]}>{money(row.averageRate)}</Text>
            </View>
            <View style={[styles.cell, styles.wValue]}>
              <Text style={[styles.cellText, styles.right]}>{money(row.totalValue)}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.footer}>{pageSummary}</Text>
    </Page>
  </Document>
);
