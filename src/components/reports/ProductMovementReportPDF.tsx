import React from "react";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ProductMovementReportRow } from "@/hooks/useProductMovementReport";

Font.register({
  family: "ArialUnicode",
  fonts: [
    { src: "/fonts/ArialUnicode.ttf", fontWeight: "normal" },
    { src: "/fonts/ArialUnicode.ttf", fontWeight: "bold" },
  ],
});

type ProductMovementReportPDFProps = {
  title: string;
  subtitle: string;
  generatedAtLabel: string;
  periodLabel: string;
  categoryLabel: string;
  searchLabel: string;
  allCategoriesLabel: string;
  noValueLabel: string;
  rankLabel: string;
  itemLabel: string;
  categoryColumnLabel: string;
  soldQtyLabel: string;
  revenueLabel: string;
  velocityLabel: string;
  stockLabel: string;
  stockValueLabel: string;
  daysCoverLabel: string;
  lastSoldLabel: string;
  totalProductsLabel: string;
  totalQtySoldLabel: string;
  totalRevenueLabel: string;
  stockValueAtRiskLabel: string;
  averageVelocityLabel: string;
  pageSummary: string;
  periodValue: string;
  categoryValue: string | null;
  searchValue: string | null;
  totalProductsValue: string;
  totalQtySoldValue: string;
  totalRevenueValue: string;
  stockValueAtRiskValue: string;
  averageVelocityValue: string;
  rows: ProductMovementReportRow[];
  formatCurrency: (value: number) => string;
  formatNumber: (value: number, digits?: number) => string;
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
  },
  title: {
    fontSize: 23,
    fontFamily: "ArialUnicode",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 6,
  },
  meta: {
    fontSize: 9,
    color: "#6b7280",
  },
  filtersBox: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
    padding: 9,
    backgroundColor: "#f9fafb",
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterItem: {
    width: "33%",
  },
  label: {
    fontSize: 8,
    color: "#6b7280",
    marginBottom: 2,
    lineHeight: 1.25,
  },
  value: {
    fontSize: 9,
    fontFamily: "ArialUnicode",
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
    padding: 8,
  },
  summaryValue: {
    fontSize: 11,
    fontFamily: "ArialUnicode",
    lineHeight: 1.2,
  },
  table: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 4,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    minHeight: 32,
    alignItems: "center",
    backgroundColor: "#e5e7eb",
  },
  row: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    minHeight: 34,
    alignItems: "stretch",
  },
  cell: {
    paddingHorizontal: 4,
    paddingVertical: 6,
    justifyContent: "center",
  },
  headerText: {
    fontSize: 7.5,
    fontFamily: "ArialUnicode",
  },
  cellText: {
    fontSize: 7.5,
  },
  mutedText: {
    fontSize: 6.5,
    color: "#6b7280",
    marginTop: 2,
  },
  amountText: {
    width: "100%",
    fontSize: 7.5,
    textAlign: "right",
  },
  right: {
    textAlign: "right",
  },
  colRank: { width: "5%" },
  colItem: { width: "20%" },
  colCategory: { width: "11%" },
  colQty: { width: "10%" },
  colRevenue: { width: "12%" },
  colVelocity: { width: "10%" },
  colStock: { width: "9%" },
  colStockValue: { width: "12%" },
  colCover: { width: "6%" },
  colLastSold: { width: "5%" },
  footer: {
    marginTop: 10,
    fontSize: 9,
    color: "#6b7280",
    textAlign: "right",
  },
});

const formatDate = (value: string | null, noValueLabel: string) => {
  if (!value) return noValueLabel;
  return new Date(value).toLocaleDateString();
};

const toPdfCurrency = (formatCurrency: (value: number) => string, value: number) =>
  formatCurrency(value).replace(/\u20b1\s*/g, "PHP ");

const toPdfCurrencyText = (value: string) => value.replace(/\u20b1\s*/g, "PHP ");

export const ProductMovementReportPDF = ({
  title,
  subtitle,
  generatedAtLabel,
  periodLabel,
  categoryLabel,
  searchLabel,
  allCategoriesLabel,
  noValueLabel,
  rankLabel,
  itemLabel,
  categoryColumnLabel,
  soldQtyLabel,
  revenueLabel,
  velocityLabel,
  stockLabel,
  stockValueLabel,
  daysCoverLabel,
  lastSoldLabel,
  totalProductsLabel,
  totalQtySoldLabel,
  totalRevenueLabel,
  stockValueAtRiskLabel,
  averageVelocityLabel,
  pageSummary,
  periodValue,
  categoryValue,
  searchValue,
  totalProductsValue,
  totalQtySoldValue,
  totalRevenueValue,
  stockValueAtRiskValue,
  averageVelocityValue,
  rows,
  formatCurrency,
  formatNumber,
}: ProductMovementReportPDFProps) => (
  <Document title={title}>
    <Page size="A4" orientation="landscape" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <Text style={styles.meta}>
          {generatedAtLabel}: {new Date().toLocaleString()}
        </Text>
      </View>

      <View style={styles.filtersBox}>
        <View style={styles.filterRow}>
          <View style={styles.filterItem}>
            <Text style={styles.label}>{periodLabel}</Text>
            <Text style={styles.value}>{periodValue}</Text>
          </View>
          <View style={styles.filterItem}>
            <Text style={styles.label}>{categoryLabel}</Text>
            <Text style={styles.value}>{categoryValue || allCategoriesLabel}</Text>
          </View>
          <View style={styles.filterItem}>
            <Text style={styles.label}>{searchLabel}</Text>
            <Text style={styles.value}>{searchValue || noValueLabel}</Text>
          </View>
        </View>
      </View>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.label}>{totalProductsLabel}</Text>
          <Text style={styles.summaryValue}>{totalProductsValue}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.label}>{totalQtySoldLabel}</Text>
          <Text style={styles.summaryValue}>{totalQtySoldValue}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.label}>{totalRevenueLabel}</Text>
          <Text style={styles.summaryValue}>{toPdfCurrencyText(totalRevenueValue)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.label}>{stockValueAtRiskLabel}</Text>
          <Text style={styles.summaryValue}>{toPdfCurrencyText(stockValueAtRiskValue)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.label}>{averageVelocityLabel}</Text>
          <Text style={styles.summaryValue}>{averageVelocityValue}</Text>
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <View style={[styles.cell, styles.colRank]}>
            <Text style={[styles.headerText, styles.right]}>{rankLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colItem]}>
            <Text style={styles.headerText}>{itemLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colCategory]}>
            <Text style={styles.headerText}>{categoryColumnLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colQty]}>
            <Text style={[styles.headerText, styles.right]}>{soldQtyLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colRevenue]}>
            <Text style={[styles.headerText, styles.right]}>{revenueLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colVelocity]}>
            <Text style={[styles.headerText, styles.right]}>{velocityLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colStock]}>
            <Text style={[styles.headerText, styles.right]}>{stockLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colStockValue]}>
            <Text style={[styles.headerText, styles.right]}>{stockValueLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colCover]}>
            <Text style={[styles.headerText, styles.right]}>{daysCoverLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colLastSold]}>
            <Text style={styles.headerText}>{lastSoldLabel}</Text>
          </View>
        </View>

        {rows.map((row) => (
          <View key={row.itemId} style={styles.row}>
            <View style={[styles.cell, styles.colRank]}>
              <Text style={[styles.cellText, styles.right]}>{formatNumber(row.movementRank)}</Text>
            </View>
            <View style={[styles.cell, styles.colItem]}>
              <Text style={styles.cellText}>{row.itemName}</Text>
              <Text style={styles.mutedText}>{row.itemCode}</Text>
            </View>
            <View style={[styles.cell, styles.colCategory]}>
              <Text style={styles.cellText}>{row.categoryName || noValueLabel}</Text>
            </View>
            <View style={[styles.cell, styles.colQty]}>
              <Text style={styles.amountText}>{formatNumber(row.quantitySold, 2)}</Text>
            </View>
            <View style={[styles.cell, styles.colRevenue]}>
              <Text style={styles.amountText}>{toPdfCurrency(formatCurrency, row.revenue)}</Text>
            </View>
            <View style={[styles.cell, styles.colVelocity]}>
              <Text style={styles.amountText}>{formatNumber(row.averageDailyQuantity, 2)}</Text>
            </View>
            <View style={[styles.cell, styles.colStock]}>
              <Text style={styles.amountText}>{formatNumber(row.currentStock, 2)}</Text>
            </View>
            <View style={[styles.cell, styles.colStockValue]}>
              <Text style={styles.amountText}>{toPdfCurrency(formatCurrency, row.stockValue)}</Text>
            </View>
            <View style={[styles.cell, styles.colCover]}>
              <Text style={styles.amountText}>
                {row.daysOfCover == null ? noValueLabel : formatNumber(row.daysOfCover, 0)}
              </Text>
            </View>
            <View style={[styles.cell, styles.colLastSold]}>
              <Text style={styles.cellText}>{formatDate(row.lastSoldAt, noValueLabel)}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.footer}>{pageSummary}</Text>
    </Page>
  </Document>
);
