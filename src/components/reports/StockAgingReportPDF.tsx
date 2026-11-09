import React from "react";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type {
  StockAgingReportRow,
  StockAgingReportGroup,
  StockAgingGroupBy,
} from "@/types/stock-aging-report";

Font.register({
  family: "ArialUnicode",
  fonts: [
    { src: "/fonts/ArialUnicode.ttf", fontWeight: "normal" },
    { src: "/fonts/ArialUnicode.ttf", fontWeight: "bold" },
  ],
});

export type StockAgingReportPDFGroup = Omit<StockAgingReportGroup, "startIndex" | "rowCount"> & {
  rows: StockAgingReportRow[];
};

type StockAgingReportPDFProps = {
  title: string;
  subtitle: string;
  generatedAtLabel: string;
  warehouseLocationLabel: string;
  detailLabel: string;
  groupBy: StockAgingGroupBy;
  ageDaysLabel: string;
  ageDurationLabel: (years: number, months: number, days: number) => string;
  qtyOnHandLabel: string;
  qtyReservedLabel: string;
  qtyAvailableLabel: string;
  stockValueLabel: string;
  subtotalLabel: string;
  oldestAgeLabel: (value: number) => string;
  rowCountLabel: (count: number) => string;
  noValueLabel: string;
  groups: StockAgingReportPDFGroup[];
  pageLabel: (page: number, totalPages: number) => string;
};

// Bound each pagination/layout tree. React PDF otherwise repeatedly splits and
// measures the remaining rows of a single report-sized table on every page.
const MAX_LAYOUT_ROWS = 50;
type StockAgingLayoutGroup = StockAgingReportPDFGroup & {
  showSubtotal: boolean;
  totalRows: number;
};

export function partitionStockAgingPdfGroups(groups: StockAgingReportPDFGroup[]) {
  const pages: StockAgingLayoutGroup[][] = [];
  let page: StockAgingLayoutGroup[] = [];
  let rowCount = 0;
  for (const group of groups) {
    for (let offset = 0; offset < group.rows.length; ) {
      const rows = group.rows.slice(offset, offset + MAX_LAYOUT_ROWS - rowCount);
      offset += rows.length;
      page.push({
        ...group,
        rows,
        showSubtotal: offset === group.rows.length,
        totalRows: group.rows.length,
      });
      rowCount += rows.length;
      if (rowCount === MAX_LAYOUT_ROWS) {
        pages.push(page);
        page = [];
        rowCount = 0;
      }
    }
  }
  if (page.length || pages.length === 0) pages.push(page);
  return pages;
}

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
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontFamily: "ArialUnicode",
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
    minHeight: 36,
    alignItems: "center",
  },
  tableHeaderText: {
    color: "#111827",
    fontFamily: "ArialUnicode",
    fontSize: 9,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  groupHeader: {
    backgroundColor: "#f9fafb",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  groupTitle: {
    fontSize: 10,
    fontFamily: "ArialUnicode",
  },
  groupSubtitle: {
    fontSize: 9,
    color: "#4b5563",
    marginTop: 2,
  },
  row: {
    flexDirection: "row",
    minHeight: 36,
    alignItems: "stretch",
  },
  subtotalRow: {
    flexDirection: "row",
    backgroundColor: "#f9fafb",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    minHeight: 30,
    alignItems: "center",
  },
  cell: {
    paddingHorizontal: 6,
    paddingVertical: 7,
    justifyContent: "center",
  },
  cellText: {
    fontSize: 9,
  },
  cellMuted: {
    fontSize: 8,
    color: "#6b7280",
    marginTop: 2,
  },
  cellBold: {
    fontSize: 9,
    fontFamily: "ArialUnicode",
  },
  right: {
    textAlign: "right",
  },
  colLocation: { width: "24%" },
  colDetail: { width: "22%" },
  colAge: { width: "12%" },
  colQty: { width: "10%" },
  colValue: { width: "12%" },
  footer: {
    marginTop: 10,
    fontSize: 10,
    color: "#6b7280",
    textAlign: "right",
  },
});

export const StockAgingReportPDF = ({
  title,
  subtitle,
  generatedAtLabel,
  warehouseLocationLabel,
  detailLabel,
  groupBy,
  ageDaysLabel,
  ageDurationLabel,
  qtyOnHandLabel,
  qtyReservedLabel,
  qtyAvailableLabel,
  stockValueLabel,
  subtotalLabel,
  oldestAgeLabel,
  rowCountLabel,
  noValueLabel,
  groups,
  pageLabel,
}: StockAgingReportPDFProps) => (
  <Document title={title}>
    {partitionStockAgingPdfGroups(groups).map((pageGroups, index) => (
      <Page key={index} size="A4" orientation="landscape" style={styles.page}>
        {index === 0 && (
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
            <Text style={styles.meta}>
              {generatedAtLabel}: {new Date().toLocaleString()}
            </Text>
          </View>
        )}

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={[styles.cell, styles.colLocation]}>
              <Text style={styles.tableHeaderText}>{warehouseLocationLabel}</Text>
            </View>
            <View style={[styles.cell, styles.colDetail]}>
              <Text style={styles.tableHeaderText}>{detailLabel}</Text>
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
          </View>

          {pageGroups.map((group) => (
            <React.Fragment key={group.id}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>{group.title}</Text>
                {group.subtitle && <Text style={styles.groupSubtitle}>{group.subtitle}</Text>}
              </View>

              {group.rows.map((row) => (
                <View key={row.id} style={styles.row} wrap={false}>
                  <View style={[styles.cell, styles.colLocation]}>
                    <Text style={styles.cellText}>
                      {row.warehouseName || noValueLabel}
                    </Text>
                    <Text style={styles.cellMuted}>{row.locationPath || noValueLabel}</Text>
                  </View>
                  <View style={[styles.cell, styles.colDetail]}>
                    <Text style={styles.cellText}>
                      {groupBy === "batch"
                        ? row.itemName || row.itemCode || noValueLabel
                        : row.batchCode || noValueLabel}
                    </Text>
                    {groupBy === "batch" && (
                      <Text style={styles.cellMuted}>{row.itemCode || noValueLabel}</Text>
                    )}
                    <Text style={styles.cellMuted}>
                      {row.batchReceivedAt
                        ? new Date(row.batchReceivedAt).toLocaleString()
                        : noValueLabel}
                    </Text>
                  </View>
                  <View style={[styles.cell, styles.colAge]}>
                    <Text style={[styles.cellText, styles.right]}>{String(row.batchAgeDays)}</Text>
                    <Text style={[styles.cellMuted, styles.right]}>
                      {row.batchAgeDuration
                        ? ageDurationLabel(
                            row.batchAgeDuration.years,
                            row.batchAgeDuration.months,
                            row.batchAgeDuration.days
                          )
                        : noValueLabel}
                    </Text>
                  </View>
                  <View style={[styles.cell, styles.colQty]}>
                    <Text style={[styles.cellText, styles.right]}>{row.qtyOnHand.toFixed(2)}</Text>
                  </View>
                  <View style={[styles.cell, styles.colQty]}>
                    <Text style={[styles.cellText, styles.right]}>
                      {row.qtyReserved.toFixed(2)}
                    </Text>
                  </View>
                  <View style={[styles.cell, styles.colQty]}>
                    <Text style={[styles.cellText, styles.right]}>
                      {row.qtyAvailable.toFixed(2)}
                    </Text>
                  </View>
                  <View style={[styles.cell, styles.colValue]}>
                    <Text style={[styles.cellText, styles.right]}>{row.stockValue.toFixed(2)}</Text>
                  </View>
                </View>
              ))}

              {group.showSubtotal && (
                <View style={styles.subtotalRow} wrap={false}>
                  <View style={[styles.cell, styles.colLocation]}>
                    <Text style={styles.cellBold}>{subtotalLabel}</Text>
                    <Text style={styles.cellMuted}>{rowCountLabel(group.totalRows)}</Text>
                  </View>
                  <View style={[styles.cell, styles.colDetail]}>
                    <Text style={styles.cellBold}>{oldestAgeLabel(group.oldestAgeDays)}</Text>
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
                </View>
              )}
            </React.Fragment>
          ))}
        </View>

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) => pageLabel(pageNumber, totalPages)}
        />
      </Page>
    ))}
  </Document>
);
