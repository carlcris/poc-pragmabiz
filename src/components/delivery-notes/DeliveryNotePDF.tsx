import React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { DeliveryNote } from "@/types/delivery-note";

type DeliveryNotePDFProps = {
  deliveryNote: DeliveryNote;
  sourceLabel: string;
  sourceAddress?: string;
  destinationLabel: string;
  destinationAddress?: string;
  logoUrl?: string;
  companyName?: string;
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
    backgroundColor: "#ffffff",
  },
  // Header Section
  header: {
    marginBottom: 30,
    borderBottomWidth: 2,
    borderBottomColor: "#2563eb",
    paddingBottom: 15,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  brandBlock: {
    flexDirection: "row",
    alignItems: "center",
  },
  logo: {
    width: 50,
    height: 50,
    marginRight: 12,
  },
  companyInfo: {
    flexDirection: "column",
  },
  companyName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
    marginBottom: 2,
  },
  companyTagline: {
    fontSize: 8,
    color: "#6b7280",
  },
  documentTitle: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#2563eb",
    textAlign: "right",
  },
  documentSubtitle: {
    fontSize: 10,
    color: "#6b7280",
    textAlign: "right",
    marginTop: 4,
  },
  // Info Boxes
  infoSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 15,
  },
  infoBox: {
    flex: 1,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
    padding: 12,
  },
  infoBoxHeader: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  infoBoxText: {
    fontSize: 9,
    color: "#1a1a1a",
    marginBottom: 2,
    lineHeight: 1.4,
  },
  infoBoxTextBold: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
    marginBottom: 2,
  },
  // Document Details
  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#eff6ff",
    borderRadius: 4,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 9,
    color: "#6b7280",
    marginRight: 6,
  },
  detailValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
  },
  // Table
  tableContainer: {
    marginBottom: 20,
  },
  table: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 4,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#2563eb",
    borderBottomWidth: 1,
    borderBottomColor: "#1e40af",
    minHeight: 32,
    alignItems: "center",
  },
  tableHeaderText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    minHeight: 28,
    alignItems: "center",
  },
  tableRowAlt: {
    backgroundColor: "#f9fafb",
  },
  cellText: {
    fontSize: 9,
    color: "#374151",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  cellTextBold: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  // Column widths
  colNo: {
    width: "8%",
    borderRightWidth: 1,
    borderRightColor: "#e5e7eb",
  },
  colCode: {
    width: "20%",
    borderRightWidth: 1,
    borderRightColor: "#e5e7eb",
  },
  colDescription: {
    width: "42%",
    borderRightWidth: 1,
    borderRightColor: "#e5e7eb",
  },
  colUnit: {
    width: "15%",
    borderRightWidth: 1,
    borderRightColor: "#e5e7eb",
  },
  colQty: {
    width: "15%",
  },
  textCenter: {
    textAlign: "center",
  },
  textRight: {
    textAlign: "right",
  },
  // Summary Section
  summarySection: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 20,
  },
  summaryBox: {
    width: "35%",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
    padding: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 9,
    color: "#6b7280",
  },
  summaryValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
  },
  summaryTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
  },
  summaryTotalLabel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
  },
  summaryTotalValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#2563eb",
  },
  // Notes
  notesSection: {
    marginBottom: 25,
    padding: 12,
    backgroundColor: "#fef3c7",
    borderLeftWidth: 3,
    borderLeftColor: "#f59e0b",
    borderRadius: 4,
  },
  notesTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#92400e",
    marginBottom: 4,
  },
  notesText: {
    fontSize: 8,
    color: "#92400e",
    lineHeight: 1.4,
  },
  // Signatures
  signaturesSection: {
    marginTop: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 20,
  },
  signatureBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 4,
    padding: 12,
    minHeight: 80,
  },
  signatureLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#6b7280",
    marginBottom: 30,
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: "#374151",
    paddingTop: 4,
  },
  signatureText: {
    fontSize: 8,
    color: "#6b7280",
    textAlign: "center",
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 8,
    color: "#9ca3af",
  },
});

const formatDate = (value?: string | null) => {
  if (!value) return "--";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "--";
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toText = (value?: string | null) => value || "--";

export const DeliveryNotePDF: React.FC<DeliveryNotePDFProps> = ({
  deliveryNote,
  sourceLabel,
  sourceAddress,
  destinationLabel,
  destinationAddress,
  logoUrl,
  companyName = "ACHLERS INTEGRATED",
}) => {
  const rows = (deliveryNote.delivery_note_items || []).map((item, index) => {
    const itemRef = Array.isArray(item.items) ? item.items[0] : item.items;
    const uomRef = Array.isArray(item.units_of_measure) ? item.units_of_measure[0] : item.units_of_measure;

    return {
      no: index + 1,
      code: toText(itemRef?.item_code || item.item_id),
      description: toText(itemRef?.item_name || itemRef?.item_code),
      unit: toText(uomRef?.symbol || uomRef?.code || uomRef?.name),
      qty: toNumber(item.allocated_qty),
    };
  });

  const totalItems = rows.length;
  const totalQuantity = rows.reduce((sum, row) => sum + row.qty, 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.brandBlock}>
              {logoUrl ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image style={styles.logo} src={logoUrl} />
              ) : null}
              <View style={styles.companyInfo}>
                <Text style={styles.companyName}>{companyName}</Text>
                <Text style={styles.companyTagline}>Integrated Supply Chain Solutions</Text>
              </View>
            </View>
            <View>
              <Text style={styles.documentTitle}>DELIVERY NOTE</Text>
              <Text style={styles.documentSubtitle}>{deliveryNote.dn_no}</Text>
            </View>
          </View>
        </View>

        {/* Ship From/To Information */}
        <View style={styles.infoSection}>
          <View style={styles.infoBox}>
            <Text style={styles.infoBoxHeader}>Ship From</Text>
            <Text style={styles.infoBoxTextBold}>{toText(sourceLabel)}</Text>
            {sourceAddress && <Text style={styles.infoBoxText}>{sourceAddress}</Text>}
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoBoxHeader}>Ship To</Text>
            <Text style={styles.infoBoxTextBold}>{toText(destinationLabel)}</Text>
            {destinationAddress && <Text style={styles.infoBoxText}>{destinationAddress}</Text>}
          </View>
        </View>

        {/* Document Details */}
        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Delivery Date:</Text>
            <Text style={styles.detailValue}>
              {formatDate(deliveryNote.dispatched_at || deliveryNote.created_at)}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Status:</Text>
            <Text style={styles.detailValue}>{toText(deliveryNote.status).toUpperCase()}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Created:</Text>
            <Text style={styles.detailValue}>{formatDate(deliveryNote.created_at)}</Text>
          </View>
        </View>

        {/* Items Table */}
        <View style={styles.tableContainer}>
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <View style={styles.colNo}>
                <Text style={[styles.tableHeaderText, styles.textCenter]}>#</Text>
              </View>
              <View style={styles.colCode}>
                <Text style={styles.tableHeaderText}>Item Code</Text>
              </View>
              <View style={styles.colDescription}>
                <Text style={styles.tableHeaderText}>Description</Text>
              </View>
              <View style={styles.colUnit}>
                <Text style={[styles.tableHeaderText, styles.textCenter]}>Unit</Text>
              </View>
              <View style={styles.colQty}>
                <Text style={[styles.tableHeaderText, styles.textRight]}>Quantity</Text>
              </View>
            </View>

            {/* Table Rows */}
            {rows.map((row, index) => (
              <View
                key={`${row.code}-${index}`}
                style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <View style={styles.colNo}>
                  <Text style={[styles.cellText, styles.textCenter]}>{row.no}</Text>
                </View>
                <View style={styles.colCode}>
                  <Text style={styles.cellTextBold}>{row.code}</Text>
                </View>
                <View style={styles.colDescription}>
                  <Text style={styles.cellText}>{row.description}</Text>
                </View>
                <View style={styles.colUnit}>
                  <Text style={[styles.cellText, styles.textCenter]}>{row.unit}</Text>
                </View>
                <View style={styles.colQty}>
                  <Text style={[styles.cellTextBold, styles.textRight]}>
                    {row.qty.toFixed(2)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Summary */}
        <View style={styles.summarySection}>
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Items:</Text>
              <Text style={styles.summaryValue}>{totalItems}</Text>
            </View>
            <View style={styles.summaryTotal}>
              <Text style={styles.summaryTotalLabel}>Total Quantity:</Text>
              <Text style={styles.summaryTotalValue}>{totalQuantity.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Important Notes */}
        <View style={styles.notesSection}>
          <Text style={styles.notesTitle}>IMPORTANT NOTICE</Text>
          <Text style={styles.notesText}>
            Please inspect all items upon delivery and report any discrepancies immediately.
          </Text>
        </View>

        {/* Signatures */}
        <View style={styles.signaturesSection}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>PREPARED BY</Text>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureText}>Name & Signature</Text>
            </View>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>RECEIVED BY</Text>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureText}>Name & Signature</Text>
            </View>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>DATE</Text>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureText}>Date & Time</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Generated on {formatDateTime(new Date().toISOString())}
          </Text>
          <Text style={styles.footerText}>Page 1 of 1</Text>
        </View>
      </Page>
    </Document>
  );
};
