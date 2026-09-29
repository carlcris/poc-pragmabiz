import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { Invoice } from "@/types/invoice";
import { formatLineDiscount, salesDocumentRows } from "@/lib/framing/invoicePresenter";

// Define styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  invoiceNumber: {
    fontSize: 12,
    color: "#666",
  },
  qrCodeContainer: {
    width: 100,
    height: 100,
    marginLeft: 20,
  },
  qrCode: {
    width: 100,
    height: 100,
  },
  qrCodeLabel: {
    fontSize: 8,
    color: "#666",
    textAlign: "center",
    marginTop: 4,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  column: {
    flex: 1,
  },
  label: {
    fontSize: 9,
    color: "#666",
    marginBottom: 2,
  },
  value: {
    fontSize: 10,
    color: "#000",
  },
  table: {
    marginTop: 10,
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderBottomWidth: 2,
    borderBottomColor: "#000",
    padding: 8,
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    padding: 8,
  },
  sizeHeadingRow: {
    backgroundColor: "#f8f8f8",
  },
  tableCell: {
    fontSize: 9,
  },
  itemCol: {
    flex: 3,
  },
  qtyCol: {
    flex: 1,
    textAlign: "right",
  },
  unitCol: {
    flex: 1.2,
    textAlign: "center",
  },
  priceCol: {
    flex: 1.5,
    textAlign: "right",
  },
  discountCol: {
    flex: 1,
    textAlign: "right",
  },
  taxCol: {
    flex: 1,
    textAlign: "right",
  },
  totalCol: {
    flex: 1.5,
    textAlign: "right",
  },
  totalsSection: {
    marginTop: 20,
    alignItems: "flex-end",
  },
  totalsTable: {
    width: 250,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 5,
  },
  totalLabel: {
    fontSize: 10,
    color: "#666",
  },
  totalValue: {
    fontSize: 10,
    fontWeight: "bold",
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
    paddingHorizontal: 5,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#d0d0d0",
  },
  grandTotalLabel: {
    fontSize: 12,
    fontWeight: "bold",
  },
  grandTotalValue: {
    fontSize: 12,
    fontWeight: "bold",
  },
  footer: {
    marginTop: 30,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  notes: {
    fontSize: 9,
    color: "#666",
    lineHeight: 1.4,
  },
  statusBadge: {
    position: "absolute",
    top: 40,
    right: 40,
    padding: 8,
    backgroundColor: "#e3f2fd",
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#1976d2",
  },
  amountDueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 5,
  },
  amountDueLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#e05a1c",
  },
  amountDueValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#e05a1c",
  },
});

interface InvoicePDFProps {
  invoice: Invoice;
  currencySymbol: string;
  qrCodeDataUrl?: string;
}

export const InvoicePDF: React.FC<InvoicePDFProps> = ({
  invoice,
  currencySymbol,
  qrCodeDataUrl,
}) => {
  const formatCurrency = (amount: number) => {
    // Handle peso symbol rendering issue in PDF
    const symbol = currencySymbol === "₱" ? "PHP " : currencySymbol;
    return `${symbol}${Math.abs(amount).toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return { bg: "#e8f5e9", color: "#2e7d32" };
      case "partially_paid":
        return { bg: "#fff3e0", color: "#f57c00" };
      case "sent":
        return { bg: "#e3f2fd", color: "#1976d2" };
      case "overdue":
        return { bg: "#ffebee", color: "#c62828" };
      default:
        return { bg: "#f5f5f5", color: "#616161" };
    }
  };

  const statusColors = getStatusColor(invoice.status);
  const lineRows = invoice.lineItems.flatMap(salesDocumentRows);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
          <Text style={[styles.statusText, { color: statusColors.color }]}>
            {invoice.status.toUpperCase().replace("_", " ")}
          </Text>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>Invoice #{invoice.invoiceNumber}</Text>
          </View>
          {qrCodeDataUrl && (
            <View style={styles.qrCodeContainer}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image style={styles.qrCode} src={qrCodeDataUrl} />
              <Text style={styles.qrCodeLabel}>Scan for details</Text>
            </View>
          )}
        </View>

        {/* Invoice Details and Customer Info */}
        <View style={styles.row}>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Bill To:</Text>
            <Text style={styles.value}>{invoice.customerName}</Text>
            <Text style={[styles.value, { fontSize: 9, color: "#666" }]}>
              {invoice.customerEmail}
            </Text>
            {invoice.billingAddress && (
              <>
                <Text style={[styles.value, { fontSize: 9, marginTop: 5 }]}>
                  {invoice.billingAddress}
                </Text>
                {invoice.billingCity && (
                  <Text style={[styles.value, { fontSize: 9 }]}>
                    {invoice.billingCity}, {invoice.billingState} {invoice.billingPostalCode}
                  </Text>
                )}
                {invoice.billingCountry && (
                  <Text style={[styles.value, { fontSize: 9 }]}>{invoice.billingCountry}</Text>
                )}
              </>
            )}
          </View>

          <View style={styles.column}>
            <View style={{ marginBottom: 8 }}>
              <Text style={styles.label}>Invoice Date:</Text>
              <Text style={styles.value}>{formatDate(invoice.invoiceDate)}</Text>
            </View>
            <View style={{ marginBottom: 8 }}>
              <Text style={styles.label}>Due Date:</Text>
              <Text style={styles.value}>{formatDate(invoice.dueDate)}</Text>
            </View>
            {invoice.salesOrderNumber && (
              <View>
                <Text style={styles.label}>Sales Order:</Text>
                <Text style={styles.value}>{invoice.salesOrderNumber}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Line Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, styles.itemCol]}>Description</Text>
            <Text style={[styles.tableCell, styles.qtyCol]}>Qty</Text>
            <Text style={[styles.tableCell, styles.unitCol]}>Unit</Text>
            <Text style={[styles.tableCell, styles.priceCol]}>Selling Price</Text>
            <Text style={[styles.tableCell, styles.discountCol]}>Discount</Text>
            <Text style={[styles.tableCell, styles.taxCol]}>Tax%</Text>
            <Text style={[styles.tableCell, styles.totalCol]}>Total</Text>
          </View>

          {lineRows.map((row) => (
            <View
              key={row.key}
              style={[
                styles.tableRow,
                ...(row.kind === "sizeHeading" ? [styles.sizeHeadingRow] : []),
              ]}
            >
              <View style={styles.itemCol}>
                <Text
                  style={[
                    styles.tableCell,
                    ...(row.kind === "sizeHeading" ? [{ fontWeight: "bold" }] : []),
                  ]}
                >
                  {row.description}
                </Text>
                {row.detail && (
                  <Text style={[styles.tableCell, { fontSize: 8, color: "#666", marginTop: 2 }]}>
                    {row.detail}
                  </Text>
                )}
              </View>
              <Text style={[styles.tableCell, styles.qtyCol]}>{row.quantity}</Text>
              <Text style={[styles.tableCell, styles.unitCol]}>{row.unit || "-"}</Text>
              <Text style={[styles.tableCell, styles.priceCol]}>
                {row.kind === "sizeHeading" ? "" : formatCurrency(row.unitPrice)}
              </Text>
              <Text style={[styles.tableCell, styles.discountCol]}>
                {row.kind === "sizeHeading"
                  ? ""
                  : formatLineDiscount(row.discountAmount, row.discountRate, formatCurrency)}
              </Text>
              <Text style={[styles.tableCell, styles.taxCol]}>
                {row.kind !== "sizeHeading" && row.taxRate ? `${row.taxRate}%` : ""}
              </Text>
              <Text style={[styles.tableCell, styles.totalCol]}>
                {row.kind === "sizeHeading" ? "" : formatCurrency(row.amount)}
              </Text>
            </View>
          ))}
        </View>

        {/* One summary carrying the totals and what is still owed. `wrap={false}`
            keeps the block whole: split across a page break it stranded the
            grand total from the figures that produce it. */}
        <View style={styles.totalsSection} wrap={false}>
          <View style={styles.totalsTable}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal:</Text>
              <Text style={styles.totalValue}>{formatCurrency(invoice.subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount:</Text>
              <Text style={[styles.totalValue, { color: "#c62828" }]}>
                {formatCurrency(invoice.totalDiscount)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax:</Text>
              <Text style={styles.totalValue}>{formatCurrency(invoice.totalTax)}</Text>
            </View>
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total Amount:</Text>
              <Text style={styles.grandTotalValue}>{formatCurrency(invoice.totalAmount)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Amount Paid:</Text>
              <Text style={[styles.totalValue, { color: "#2e7d32" }]}>
                {formatCurrency(invoice.amountPaid)}
              </Text>
            </View>
            <View style={styles.amountDueRow}>
              <Text style={styles.amountDueLabel}>Amount Due:</Text>
              <Text style={styles.amountDueValue}>{formatCurrency(invoice.amountDue)}</Text>
            </View>
          </View>
        </View>

        {/* Footer Notes */}
        {invoice.notes && (
          <View style={styles.footer} wrap={false}>
            <Text style={[styles.sectionTitle, { fontSize: 10 }]}>Notes:</Text>
            <Text style={styles.notes}>{invoice.notes}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
};
