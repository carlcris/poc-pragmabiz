import React from "react";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type {
  AccountsReceivableAgingReportRow,
  AccountsReceivableAgingReportSummary,
} from "@/hooks/useAccountsReceivableAgingReport";

Font.register({
  family: "ArialUnicode",
  fonts: [
    { src: "/fonts/ArialUnicode.ttf", fontWeight: "normal" },
    { src: "/fonts/ArialUnicode.ttf", fontWeight: "bold" },
  ],
});

type AccountsReceivableAgingReportPDFProps = {
  title: string;
  subtitle: string;
  generatedAtLabel: string;
  asOfDateLabel: string;
  customerLabel: string;
  bucketLabel: string;
  allCustomersLabel: string;
  customersLabel: string;
  invoicesLabel: string;
  totalBalanceLabel: string;
  currentLabel: string;
  days1To30Label: string;
  days31To60Label: string;
  days61To90Label: string;
  days90PlusLabel: string;
  invoiceDateLabel: string;
  dueDateLabel: string;
  daysOverdueLabel: string;
  balanceLabel: string;
  pageSummary: string;
  asOfDateValue: string;
  customerValue: string | null;
  bucketValue: string;
  summary: AccountsReceivableAgingReportSummary;
  rows: AccountsReceivableAgingReportRow[];
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
    lineHeight: 1.25,
  },
  value: {
    fontSize: 9,
    fontFamily: "ArialUnicode",
    marginTop: 2,
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
    padding: 7,
  },
  summaryValue: {
    fontSize: 10,
    fontFamily: "ArialUnicode",
    lineHeight: 1.2,
    marginTop: 2,
  },
  table: {
    marginTop: 4,
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
    minHeight: 36,
    alignItems: "stretch",
  },
  cell: {
    paddingHorizontal: 4,
    paddingVertical: 6,
    justifyContent: "center",
  },
  headerText: {
    fontSize: 7,
    fontFamily: "ArialUnicode",
  },
  cellText: {
    fontSize: 7,
  },
  mutedText: {
    fontSize: 6.5,
    color: "#6b7280",
    marginTop: 2,
  },
  amountText: {
    width: "100%",
    fontSize: 7,
    textAlign: "right",
  },
  right: {
    textAlign: "right",
  },
  colCustomer: { width: "22%" },
  colDate: { width: "9%" },
  colDays: { width: "6%" },
  colBucket: { width: "9%" },
  colBalance: { width: "9%" },
  footer: {
    marginTop: 10,
    fontSize: 9,
    color: "#6b7280",
    textAlign: "right",
  },
});

const formatDate = (value: string) => new Date(value).toLocaleDateString();

const toPdfCurrency = (formatCurrency: (value: number) => string, value: number) =>
  formatCurrency(value).replace(/\u20b1\s*/g, "PHP ");

export const AccountsReceivableAgingReportPDF = ({
  title,
  subtitle,
  generatedAtLabel,
  asOfDateLabel,
  customerLabel,
  bucketLabel,
  allCustomersLabel,
  customersLabel,
  invoicesLabel,
  totalBalanceLabel,
  currentLabel,
  days1To30Label,
  days31To60Label,
  days61To90Label,
  days90PlusLabel,
  invoiceDateLabel,
  dueDateLabel,
  daysOverdueLabel,
  balanceLabel,
  pageSummary,
  asOfDateValue,
  customerValue,
  bucketValue,
  summary,
  rows,
  formatCurrency,
  formatNumber,
}: AccountsReceivableAgingReportPDFProps) => (
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
            <Text style={styles.label}>{asOfDateLabel}</Text>
            <Text style={styles.value}>{asOfDateValue}</Text>
          </View>
          <View style={styles.filterItem}>
            <Text style={styles.label}>{customerLabel}</Text>
            <Text style={styles.value}>{customerValue || allCustomersLabel}</Text>
          </View>
          <View style={styles.filterItem}>
            <Text style={styles.label}>{bucketLabel}</Text>
            <Text style={styles.value}>{bucketValue}</Text>
          </View>
        </View>
      </View>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.label}>{customersLabel}</Text>
          <Text style={styles.summaryValue}>{formatNumber(summary.customerCount)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.label}>{invoicesLabel}</Text>
          <Text style={styles.summaryValue}>{formatNumber(summary.invoiceCount)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.label}>{totalBalanceLabel}</Text>
          <Text style={styles.summaryValue}>
            {toPdfCurrency(formatCurrency, summary.totalBalance)}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.label}>{currentLabel}</Text>
          <Text style={styles.summaryValue}>{toPdfCurrency(formatCurrency, summary.current)}</Text>
        </View>
      </View>
      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.label}>{days1To30Label}</Text>
          <Text style={styles.summaryValue}>
            {toPdfCurrency(formatCurrency, summary.days1To30)}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.label}>{days31To60Label}</Text>
          <Text style={styles.summaryValue}>
            {toPdfCurrency(formatCurrency, summary.days31To60)}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.label}>{days61To90Label}</Text>
          <Text style={styles.summaryValue}>
            {toPdfCurrency(formatCurrency, summary.days61To90)}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.label}>{days90PlusLabel}</Text>
          <Text style={styles.summaryValue}>
            {toPdfCurrency(formatCurrency, summary.days90Plus)}
          </Text>
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <View style={[styles.cell, styles.colCustomer]}>
            <Text style={styles.headerText}>{customerLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colDate]}>
            <Text style={styles.headerText}>{invoiceDateLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colDate]}>
            <Text style={styles.headerText}>{dueDateLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colDays]}>
            <Text style={[styles.headerText, styles.right]}>{daysOverdueLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colBucket]}>
            <Text style={[styles.headerText, styles.right]}>{currentLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colBucket]}>
            <Text style={[styles.headerText, styles.right]}>{days1To30Label}</Text>
          </View>
          <View style={[styles.cell, styles.colBucket]}>
            <Text style={[styles.headerText, styles.right]}>{days31To60Label}</Text>
          </View>
          <View style={[styles.cell, styles.colBucket]}>
            <Text style={[styles.headerText, styles.right]}>{days61To90Label}</Text>
          </View>
          <View style={[styles.cell, styles.colBucket]}>
            <Text style={[styles.headerText, styles.right]}>{days90PlusLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colBalance]}>
            <Text style={[styles.headerText, styles.right]}>{balanceLabel}</Text>
          </View>
        </View>

        {rows.map((row) => (
          <View key={row.invoiceId} style={styles.row}>
            <View style={[styles.cell, styles.colCustomer]}>
              <Text style={styles.cellText}>{row.customerName}</Text>
              <Text style={styles.mutedText}>
                {row.customerCode} / {row.invoiceCode}
              </Text>
            </View>
            <View style={[styles.cell, styles.colDate]}>
              <Text style={styles.cellText}>{formatDate(row.invoiceDate)}</Text>
            </View>
            <View style={[styles.cell, styles.colDate]}>
              <Text style={styles.cellText}>{formatDate(row.dueDate)}</Text>
            </View>
            <View style={[styles.cell, styles.colDays]}>
              <Text style={[styles.cellText, styles.right]}>{formatNumber(row.daysOverdue)}</Text>
            </View>
            <View style={[styles.cell, styles.colBucket]}>
              <Text style={styles.amountText}>{toPdfCurrency(formatCurrency, row.current)}</Text>
            </View>
            <View style={[styles.cell, styles.colBucket]}>
              <Text style={styles.amountText}>{toPdfCurrency(formatCurrency, row.days1To30)}</Text>
            </View>
            <View style={[styles.cell, styles.colBucket]}>
              <Text style={styles.amountText}>{toPdfCurrency(formatCurrency, row.days31To60)}</Text>
            </View>
            <View style={[styles.cell, styles.colBucket]}>
              <Text style={styles.amountText}>{toPdfCurrency(formatCurrency, row.days61To90)}</Text>
            </View>
            <View style={[styles.cell, styles.colBucket]}>
              <Text style={styles.amountText}>{toPdfCurrency(formatCurrency, row.days90Plus)}</Text>
            </View>
            <View style={[styles.cell, styles.colBalance]}>
              <Text style={styles.amountText}>{toPdfCurrency(formatCurrency, row.balance)}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.footer}>{pageSummary}</Text>
    </Page>
  </Document>
);
