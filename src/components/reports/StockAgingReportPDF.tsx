import React from "react";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { StockAgingReportRow } from "@/hooks/useStockAgingReport";

Font.register({
  family: "ArialUnicode",
  fonts: [
    { src: "/fonts/ArialUnicode.ttf", fontWeight: "normal" },
    { src: "/fonts/ArialUnicode.ttf", fontWeight: "bold" },
  ],
});

type StockAgingReportPDFGroup = {
  itemId: string;
  itemName: string;
  itemCode: string | null;
  itemSku: string | null;
  category: string;
  rows: StockAgingReportRow[];
  subtotalQtyOnHand: number;
  subtotalQtyReserved: number;
  subtotalQtyAvailable: number;
  subtotalStockValue: number;
  oldestAgeDays: number;
};

type StockAgingReportPDFProps = {
  title: string;
  subtitle: string;
  generatedAtLabel: string;
  warehouseLocationLabel: string;
  batchLabel: string;
  ageDaysLabel: string;
  qtyOnHandLabel: string;
  qtyReservedLabel: string;
  qtyAvailableLabel: string;
  stockValueLabel: string;
  updatedAtLabel: string;
  itemSubtotalLabel: string;
  noValueLabel: string;
  groups: StockAgingReportPDFGroup[];
  currentPage: number;
  totalPages: number;
  totalRows: number;
};

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 9,
    fontFamily: "ArialUnicode",
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  header: {
    marginBottom: 14,
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontFamily: "ArialUnicode",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: "#6b7280",
    marginBottom: 6,
  },
  meta: {
    fontSize: 8,
    color: "#6b7280",
  },
  filtersBox: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
    padding: 10,
    backgroundColor: "#f9fafb",
  },
  filtersTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterItem: {
    width: "48%",
    marginBottom: 4,
  },
  filterLabel: {
    fontSize: 8,
    color: "#6b7280",
  },
  filterValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
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
    minHeight: 28,
    alignItems: "center",
  },
  tableHeaderText: {
    color: "#111827",
    fontFamily: "ArialUnicode",
    fontSize: 8,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  groupHeader: {
    backgroundColor: "#f9fafb",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  groupTitle: {
    fontSize: 9,
    fontFamily: "ArialUnicode",
  },
  groupSubtitle: {
    fontSize: 8,
    color: "#4b5563",
    marginTop: 2,
  },
  row: {
    flexDirection: "row",
    minHeight: 28,
    alignItems: "stretch",
  },
  subtotalRow: {
    flexDirection: "row",
    backgroundColor: "#f9fafb",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    minHeight: 24,
    alignItems: "center",
  },
  cell: {
    paddingHorizontal: 6,
    paddingVertical: 5,
    justifyContent: "center",
  },
  cellText: {
    fontSize: 8,
  },
  cellMuted: {
    fontSize: 7,
    color: "#6b7280",
    marginTop: 2,
  },
  cellBold: {
    fontSize: 8,
    fontFamily: "ArialUnicode",
  },
  right: {
    textAlign: "right",
  },
  colLocation: { width: "24%" },
  colBatch: { width: "18%" },
  colAge: { width: "8%" },
  colQty: { width: "10%" },
  colValue: { width: "12%" },
  colUpdated: { width: "18%" },
  footer: {
    marginTop: 10,
    fontSize: 8,
    color: "#6b7280",
    textAlign: "right",
  },
});

export const StockAgingReportPDF = ({
  title,
  subtitle,
  generatedAtLabel,
  warehouseLocationLabel,
  batchLabel,
  ageDaysLabel,
  qtyOnHandLabel,
  qtyReservedLabel,
  qtyAvailableLabel,
  stockValueLabel,
  updatedAtLabel,
  itemSubtotalLabel,
  noValueLabel,
  groups,
  currentPage,
  totalPages,
  totalRows,
}: StockAgingReportPDFProps) => (
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
          <View style={[styles.cell, styles.colLocation]}>
            <Text style={styles.tableHeaderText}>{warehouseLocationLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colBatch]}>
            <Text style={styles.tableHeaderText}>{batchLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colAge]}>
            <Text style={[styles.tableHeaderText, styles.right]}>{ageDaysLabel}</Text>
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
          <View style={[styles.cell, styles.colValue]}>
            <Text style={[styles.tableHeaderText, styles.right]}>{stockValueLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colUpdated]}>
            <Text style={styles.tableHeaderText}>{updatedAtLabel}</Text>
          </View>
        </View>

        {groups.map((group) => (
          <React.Fragment key={group.itemId}>
            <View style={styles.groupHeader}>
              <Text style={styles.groupTitle}>{group.itemName}</Text>
              <Text style={styles.groupSubtitle}>
                {group.itemCode || noValueLabel}
                {group.itemSku ? ` • ${group.itemSku}` : ""}
                {group.category ? ` • ${group.category}` : ""}
              </Text>
            </View>

            {group.rows.map((row) => (
              <View key={row.id} style={styles.row}>
                <View style={[styles.cell, styles.colLocation]}>
                  <Text style={styles.cellText}>
                    {(row.warehouseCode || noValueLabel) +
                      " - " +
                      (row.warehouseName || noValueLabel)}
                  </Text>
                  <Text style={styles.cellMuted}>
                    {(row.locationCode || noValueLabel) +
                      " - " +
                      (row.locationName || noValueLabel)}
                  </Text>
                </View>
                <View style={[styles.cell, styles.colBatch]}>
                  <Text style={styles.cellText}>{row.batchCode || noValueLabel}</Text>
                  <Text style={styles.cellMuted}>
                    {row.batchReceivedAt ? new Date(row.batchReceivedAt).toLocaleString() : noValueLabel}
                  </Text>
                </View>
                <View style={[styles.cell, styles.colAge]}>
                  <Text style={[styles.cellText, styles.right]}>{String(row.batchAgeDays)}</Text>
                </View>
                <View style={[styles.cell, styles.colQty]}>
                  <Text style={[styles.cellText, styles.right]}>{row.qtyOnHand.toFixed(2)}</Text>
                </View>
                <View style={[styles.cell, styles.colQty]}>
                  <Text style={[styles.cellText, styles.right]}>{row.qtyReserved.toFixed(2)}</Text>
                </View>
                <View style={[styles.cell, styles.colQty]}>
                  <Text style={[styles.cellText, styles.right]}>{row.qtyAvailable.toFixed(2)}</Text>
                </View>
                <View style={[styles.cell, styles.colValue]}>
                  <Text style={[styles.cellText, styles.right]}>{row.stockValue.toFixed(2)}</Text>
                </View>
                <View style={[styles.cell, styles.colUpdated]}>
                  <Text style={styles.cellText}>{new Date(row.updatedAt).toLocaleString()}</Text>
                </View>
              </View>
            ))}

            <View style={styles.subtotalRow}>
              <View style={[styles.cell, styles.colLocation]}>
                <Text style={styles.cellBold}>{itemSubtotalLabel}</Text>
              </View>
              <View style={[styles.cell, styles.colBatch]}>
                <Text style={styles.cellBold}>Oldest: {group.oldestAgeDays}d</Text>
              </View>
              <View style={[styles.cell, styles.colAge]}>
                <Text style={styles.cellText}></Text>
              </View>
              <View style={[styles.cell, styles.colQty]}>
                <Text style={[styles.cellBold, styles.right]}>
                  {group.subtotalQtyOnHand.toFixed(2)}
                </Text>
              </View>
              <View style={[styles.cell, styles.colQty]}>
                <Text style={[styles.cellBold, styles.right]}>
                  {group.subtotalQtyReserved.toFixed(2)}
                </Text>
              </View>
              <View style={[styles.cell, styles.colQty]}>
                <Text style={[styles.cellBold, styles.right]}>
                  {group.subtotalQtyAvailable.toFixed(2)}
                </Text>
              </View>
              <View style={[styles.cell, styles.colValue]}>
                <Text style={[styles.cellBold, styles.right]}>
                  {group.subtotalStockValue.toFixed(2)}
                </Text>
              </View>
              <View style={[styles.cell, styles.colUpdated]}>
                <Text style={styles.cellBold}>
                  {group.rows.length} {group.rows.length === 1 ? "batch" : "batches"}
                </Text>
              </View>
            </View>
          </React.Fragment>
        ))}
      </View>

      <Text style={styles.footer}>
        Page {currentPage} of {totalPages} • {totalRows} {totalRows === 1 ? "batch" : "batches"}
      </Text>
    </Page>
  </Document>
);
