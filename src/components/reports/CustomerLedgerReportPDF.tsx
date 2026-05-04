import React from "react";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CustomerLedgerEntry, CustomerLedgerSummary } from "@/types/customer";

Font.register({
  family: "ArialUnicode",
  fonts: [
    { src: "/fonts/ArialUnicode.ttf", fontWeight: "normal" },
    { src: "/fonts/ArialUnicode.ttf", fontWeight: "bold" },
  ],
});

type CustomerLedgerReportPDFProps = {
  title: string;
  subtitle: string;
  generatedAtLabel: string;
  customerLabel: string;
  periodLabel: string;
  sourceLabel: string;
  openingBalanceLabel: string;
  periodDebitsLabel: string;
  periodCreditsLabel: string;
  closingBalanceLabel: string;
  dateLabel: string;
  documentLabel: string;
  typeLabel: string;
  descriptionLabel: string;
  debitLabel: string;
  creditLabel: string;
  balanceLabel: string;
  noValueLabel: string;
  pageSummary: string;
  customerValue: string;
  periodValue: string;
  sourceValue: string;
  summary: CustomerLedgerSummary;
  rows: CustomerLedgerEntry[];
  formatCurrency: (value: number) => string;
};

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
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterItem: {
    width: "32%",
  },
  filterLabel: {
    fontSize: 8,
    color: "#6b7280",
  },
  filterValue: {
    fontSize: 9,
    fontFamily: "ArialUnicode",
    marginTop: 2,
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
  summaryLabel: {
    fontSize: 8,
    color: "#6b7280",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 11,
    fontFamily: "ArialUnicode",
  },
  amountText: {
    width: "100%",
    fontSize: 8,
    fontFamily: "ArialUnicode",
    textAlign: "right",
  },
  summaryAmountText: {
    width: "100%",
    fontSize: 11,
    fontFamily: "ArialUnicode",
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
    minHeight: 34,
    alignItems: "center",
  },
  tableHeaderText: {
    color: "#111827",
    fontFamily: "ArialUnicode",
    fontSize: 8,
    paddingHorizontal: 5,
    paddingVertical: 7,
  },
  row: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    minHeight: 34,
    alignItems: "stretch",
  },
  cell: {
    paddingHorizontal: 5,
    paddingVertical: 6,
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
  right: {
    textAlign: "right",
  },
  colDate: { width: "11%" },
  colDocument: { width: "14%" },
  colType: { width: "9%" },
  colDescription: { width: "30%" },
  colAmount: { width: "12%" },
  footer: {
    marginTop: 10,
    fontSize: 10,
    color: "#6b7280",
    textAlign: "right",
  },
});

const formatDate = (value: string) => new Date(value).toLocaleDateString();

const toPdfCurrency = (formatCurrency: (value: number) => string, value: number) =>
  formatCurrency(value).replace(/\u20b1\s*/g, "PHP ");

export const CustomerLedgerReportPDF = ({
  title,
  subtitle,
  generatedAtLabel,
  customerLabel,
  periodLabel,
  sourceLabel,
  openingBalanceLabel,
  periodDebitsLabel,
  periodCreditsLabel,
  closingBalanceLabel,
  dateLabel,
  documentLabel,
  typeLabel,
  descriptionLabel,
  debitLabel,
  creditLabel,
  balanceLabel,
  noValueLabel,
  pageSummary,
  customerValue,
  periodValue,
  sourceValue,
  summary,
  rows,
  formatCurrency,
}: CustomerLedgerReportPDFProps) => (
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
            <Text style={styles.filterLabel}>{customerLabel}</Text>
            <Text style={styles.filterValue}>{customerValue}</Text>
          </View>
          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>{periodLabel}</Text>
            <Text style={styles.filterValue}>{periodValue}</Text>
          </View>
          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>{sourceLabel}</Text>
            <Text style={styles.filterValue}>{sourceValue}</Text>
          </View>
        </View>
      </View>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{openingBalanceLabel}</Text>
          <Text style={styles.summaryAmountText}>
            {toPdfCurrency(formatCurrency, summary.openingBalance)}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{periodDebitsLabel}</Text>
          <Text style={styles.summaryAmountText}>
            {toPdfCurrency(formatCurrency, summary.periodDebits)}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{periodCreditsLabel}</Text>
          <Text style={styles.summaryAmountText}>
            {toPdfCurrency(formatCurrency, summary.periodCredits)}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{closingBalanceLabel}</Text>
          <Text style={styles.summaryAmountText}>
            {toPdfCurrency(formatCurrency, summary.closingBalance)}
          </Text>
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <View style={[styles.cell, styles.colDate]}>
            <Text style={styles.tableHeaderText}>{dateLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colDocument]}>
            <Text style={styles.tableHeaderText}>{documentLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colType]}>
            <Text style={styles.tableHeaderText}>{typeLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colDescription]}>
            <Text style={styles.tableHeaderText}>{descriptionLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colAmount]}>
            <Text style={[styles.tableHeaderText, styles.right]}>{debitLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colAmount]}>
            <Text style={[styles.tableHeaderText, styles.right]}>{creditLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colAmount]}>
            <Text style={[styles.tableHeaderText, styles.right]}>{balanceLabel}</Text>
          </View>
        </View>

        {rows.map((row) => (
          <View key={row.id} style={styles.row}>
            <View style={[styles.cell, styles.colDate]}>
              <Text style={styles.cellText}>{formatDate(row.eventAt)}</Text>
            </View>
            <View style={[styles.cell, styles.colDocument]}>
              <Text style={styles.cellText}>{row.documentNumber || noValueLabel}</Text>
              <Text style={styles.cellMuted}>{row.paymentMethod || noValueLabel}</Text>
            </View>
            <View style={[styles.cell, styles.colType]}>
              <Text style={styles.cellText}>{row.sourceType.toUpperCase()}</Text>
            </View>
            <View style={[styles.cell, styles.colDescription]}>
              <Text style={styles.cellText}>{row.description || noValueLabel}</Text>
              {row.reference ? <Text style={styles.cellMuted}>{row.reference}</Text> : null}
            </View>
            <View style={[styles.cell, styles.colAmount]}>
              <Text style={styles.amountText}>
                {row.debit > 0 ? toPdfCurrency(formatCurrency, row.debit) : noValueLabel}
              </Text>
            </View>
            <View style={[styles.cell, styles.colAmount]}>
              <Text style={styles.amountText}>
                {row.credit > 0 ? toPdfCurrency(formatCurrency, row.credit) : noValueLabel}
              </Text>
            </View>
            <View style={[styles.cell, styles.colAmount]}>
              <Text style={styles.amountText}>
                {toPdfCurrency(formatCurrency, row.runningBalance)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.footer}>{pageSummary}</Text>
    </Page>
  </Document>
);
