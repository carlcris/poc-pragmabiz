import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  formatLineDiscount,
  invoiceRows,
  showsComponentBreakdown,
  type InvoiceRow,
} from "@/lib/framing/invoicePresenter";
import { showsPrintedTerms } from "@/lib/quotations/printedTerms";
import { quotationTotals } from "@/lib/quotations/quotation-totals";
import type { Quotation, QuotationLineItem } from "@/types/quotation";

Font.register({
  family: "ArialUnicode",
  fonts: [
    { src: "/fonts/ArialUnicode.ttf", fontWeight: "normal" },
    { src: "/fonts/ArialUnicode.ttf", fontWeight: "bold" },
  ],
});

type QuotationPDFProps = {
  quotation: Quotation;
  generatedAt: string;
};

const colors = {
  ink: "#172033",
  navy: "#203A5F",
  slate: "#667085",
  border: "#D8DEE8",
  surface: "#F7F9FC",
  white: "#FFFFFF",
  discount: "#B54708",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 26,
    paddingBottom: 40,
    paddingHorizontal: 24,
    fontSize: 9.5,
    fontFamily: "ArialUnicode",
    color: colors.ink,
    backgroundColor: colors.white,
  },
  accentBar: {
    height: 5,
    marginBottom: 17,
    backgroundColor: colors.navy,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  title: {
    fontSize: 24,
    fontFamily: "ArialUnicode",
    fontWeight: "bold",
    color: colors.navy,
  },
  quotationNumber: {
    marginTop: 4,
    fontSize: 11,
    color: colors.slate,
    letterSpacing: 0.4,
  },
  headerMeta: {
    width: 170,
    gap: 5,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
  },
  metaLabel: {
    color: colors.slate,
  },
  metaValue: {
    fontFamily: "ArialUnicode",
    fontWeight: "bold",
    textAlign: "right",
  },
  customerPanel: {
    flexDirection: "row",
    marginBottom: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  customerDetails: {
    width: "100%",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  customerLabel: {
    marginBottom: 4,
    fontSize: 8,
    color: colors.slate,
    letterSpacing: 0.7,
  },
  customerName: {
    fontSize: 12,
    fontFamily: "ArialUnicode",
    fontWeight: "bold",
    color: colors.ink,
  },
  customerEmail: {
    marginTop: 3,
    color: colors.slate,
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 7,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "ArialUnicode",
    fontWeight: "bold",
    color: colors.navy,
  },
  table: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 22,
    backgroundColor: colors.navy,
  },
  tableHeaderCell: {
    paddingVertical: 4,
    paddingHorizontal: 7,
    fontSize: 8.5,
    fontFamily: "ArialUnicode",
    fontWeight: "bold",
    color: colors.white,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 22,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lineItemRow: {
    minHeight: 26,
  },
  lineItemCell: {
    fontFamily: "ArialUnicode",
    fontWeight: "bold",
  },
  lastTableRow: {
    borderBottomWidth: 0,
  },
  tableCell: {
    paddingVertical: 4,
    paddingHorizontal: 7,
    fontSize: 9,
  },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 26,
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  groupIdentity: {
    width: "86%",
    paddingRight: 10,
  },
  groupName: {
    fontSize: 10,
    fontFamily: "ArialUnicode",
    fontWeight: "bold",
    color: colors.ink,
  },
  groupCode: {
    marginTop: 2,
    fontSize: 8,
    color: colors.slate,
  },
  groupTotal: {
    width: "14%",
    textAlign: "right",
    fontFamily: "ArialUnicode",
    fontWeight: "bold",
    color: colors.ink,
  },
  sizeRow: {
    backgroundColor: colors.surface,
  },
  sizeDescription: {
    fontFamily: "ArialUnicode",
    fontWeight: "bold",
    color: colors.navy,
  },
  description: {
    lineHeight: 1.25,
  },
  lineItemDescription: {
    fontFamily: "ArialUnicode",
    fontWeight: "bold",
  },
  componentDescription: {
    paddingLeft: 10,
  },
  detail: {
    marginTop: 2,
    fontSize: 7.8,
    color: colors.slate,
  },
  money: {
    textAlign: "right",
  },
  amount: {
    textAlign: "right",
    fontFamily: "ArialUnicode",
    fontWeight: "bold",
  },
  discount: {
    textAlign: "right",
    color: colors.discount,
  },
  // The breakdown is its own small table beneath the line it belongs to. Kept
  // deliberately light — a grey heading strip and plain rows, no border and no
  // box. A bordered panel reads as a competing table and fights the outer one;
  // the heading alone is enough to say "different columns, different subject".
  componentPanel: {
    marginLeft: 24,
  },
  // Closes the group at FULL width, back at the outer table's left edge. The
  // last component's own divider stops at the 24pt inset, so the boundary
  // between a frame's parts and the next line item had a gap in it.
  componentPanelClose: {
    marginBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  componentPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 16,
    backgroundColor: colors.surface,
  },
  componentPanelHeaderCell: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    fontSize: 7,
    color: colors.slate,
  },
  componentRowLast: {
    borderBottomWidth: 0,
  },
  colQty: { width: "7%", textAlign: "right" },
  colUnit: { width: "8%", textAlign: "center" },
  colDescription: { width: "46%" },
  colUnitPrice: { width: "13%", textAlign: "right" },
  colDiscount: { width: "12%", textAlign: "right" },
  colAmount: { width: "14%", textAlign: "right" },
  summarySection: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
  },
  totals: {
    width: 235,
    borderTopWidth: 3,
    borderTopColor: colors.navy,
    paddingTop: 5,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 1.5,
  },
  totalLabel: {
    color: colors.slate,
  },
  totalValue: {
    fontFamily: "ArialUnicode",
    fontWeight: "bold",
  },
  discountValue: {
    fontFamily: "ArialUnicode",
    fontWeight: "bold",
    color: colors.discount,
  },
  grandTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 3,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    fontSize: 12,
    fontFamily: "ArialUnicode",
    fontWeight: "bold",
    color: colors.navy,
  },
  terms: {
    marginTop: 18,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  termsTitle: {
    marginBottom: 4,
    fontSize: 9,
    fontFamily: "ArialUnicode",
    fontWeight: "bold",
    color: colors.navy,
  },
  termsText: {
    fontSize: 8.5,
    lineHeight: 1.35,
    color: colors.slate,
  },
  notesTitle: {
    marginTop: 9,
  },
  footer: {
    position: "absolute",
    right: 24,
    bottom: 18,
    left: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    fontSize: 7.5,
    color: colors.slate,
  },
});

const formatAmount = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const formatMoney = (value: number) => `PHP ${formatAmount(value)}`;

const formatNumber = (value: number | undefined) =>
  new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value && Number.isFinite(value) ? value : 0);

const formatDate = (value: string) => new Date(value).toLocaleDateString("en-PH");

function QuotationTableRow({ row, isLast }: { row: InvoiceRow; isLast: boolean }) {
  const rowStyles = [
    styles.tableRow,
    ...(row.kind === "summary" ? [styles.lineItemRow] : []),
    ...(row.kind === "sizeHeading" ? [styles.sizeRow] : []),
    ...(isLast ? [styles.lastTableRow] : []),
  ];
  const descriptionStyles = [
    styles.description,
    ...(row.kind === "summary" ? [styles.lineItemDescription] : []),
    ...(row.kind === "component" ? [styles.componentDescription] : []),
    ...(row.kind === "sizeHeading" ? [styles.sizeDescription] : []),
  ];

  return (
    <View style={rowStyles} wrap={false}>
      <Text
        style={[
          styles.tableCell,
          styles.colQty,
          ...(row.kind === "summary" ? [styles.lineItemCell] : []),
        ]}
      >
        {formatNumber(row.quantity)}
      </Text>
      <Text
        style={[
          styles.tableCell,
          styles.colUnit,
          ...(row.kind === "summary" ? [styles.lineItemCell] : []),
        ]}
      >
        {row.unit}
      </Text>
      <View style={[styles.tableCell, styles.colDescription]}>
        <Text style={descriptionStyles}>{row.description}</Text>
        {row.detail ? <Text style={styles.detail}>{row.detail}</Text> : null}
      </View>
      <Text
        style={[
          styles.tableCell,
          styles.colUnitPrice,
          styles.money,
          ...(row.kind === "summary" ? [styles.lineItemCell] : []),
        ]}
      >
        {row.kind === "sizeHeading" ? "" : formatAmount(row.unitPrice)}
      </Text>
      <Text
        style={[
          styles.tableCell,
          styles.colDiscount,
          styles.discount,
          ...(row.kind === "summary" ? [styles.lineItemCell] : []),
        ]}
      >
        {row.kind === "sizeHeading"
          ? ""
          : formatLineDiscount(row.discountAmount, row.discountRate, formatAmount)}
      </Text>
      <Text
        style={[
          styles.tableCell,
          styles.colAmount,
          styles.amount,
          ...(row.kind === "summary" ? [styles.lineItemCell] : []),
        ]}
      >
        {row.kind === "sizeHeading" ? "" : formatAmount(row.amount)}
      </Text>
    </View>
  );
}

function QuotationLineGroup({ item }: { item: QuotationLineItem }) {
  return (
    <View style={styles.groupRow} wrap={false}>
      <View style={styles.groupIdentity}>
        <Text style={styles.groupName}>{item.itemName || item.description || "-"}</Text>
        {item.itemCode ? <Text style={styles.groupCode}>{item.itemCode}</Text> : null}
      </View>
      <Text style={styles.groupTotal}>{formatMoney(item.lineTotal)}</Text>
    </View>
  );
}

export const QuotationPDF = ({ quotation, generatedAt }: QuotationPDFProps) => {
  const showTerms = showsPrintedTerms(quotation);
  const totals = quotationTotals(quotation.lineItems);

  const printableLines = quotation.lineItems.map((item) => {
    const rows = invoiceRows(item);
    const componentsOnly =
      showsComponentBreakdown(item.frameConfiguration) &&
      rows.some((row) => row.kind === "component") &&
      rows.every((row) => row.kind !== "summary");

    return { item, rows, componentsOnly };
  });

  return (
    <Document title={`Quotation ${quotation.quotationNumber}`}>
      <Page size="A4" orientation="portrait" style={styles.page}>
        <View style={styles.accentBar} />

        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Quotation</Text>
            <Text style={styles.quotationNumber}>{quotation.quotationNumber}</Text>
          </View>
          <View style={styles.headerMeta}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date</Text>
              <Text style={styles.metaValue}>{formatDate(quotation.quotationDate)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Valid until</Text>
              <Text style={styles.metaValue}>{formatDate(quotation.validUntil)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.customerPanel}>
          <View style={styles.customerDetails}>
            <Text style={styles.customerLabel}>Customer</Text>
            <Text style={styles.customerName}>{quotation.customerName || "-"}</Text>
            {quotation.customerEmail ? (
              <Text style={styles.customerEmail}>{quotation.customerEmail}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Line Items</Text>
        </View>

        <View style={styles.table}>
          {/* `fixed` repeats it on every page — rows continuing onto page 2
              under no column labels leave the reader guessing which figure is
              the rate and which the amount. */}
          <View style={styles.tableHeader} wrap={false} fixed>
            <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
            <Text style={[styles.tableHeaderCell, styles.colUnit]}>Unit</Text>
            <Text style={[styles.tableHeaderCell, styles.colDescription]}>Description</Text>
            <Text style={[styles.tableHeaderCell, styles.colUnitPrice]}>Unit Price</Text>
            <Text style={[styles.tableHeaderCell, styles.colDiscount]}>Disc.</Text>
            <Text style={[styles.tableHeaderCell, styles.colAmount]}>Amount</Text>
          </View>

          {printableLines.map(({ item, rows, componentsOnly }, lineIndex) => {
            // The line's own row stays in the outer table; its parts move into
            // a small table of their own beneath it, so the NEXT line item is
            // plainly a sibling rather than one more component.
            const ownRow = rows.find((row) => row.kind === "summary");
            const parts = rows.filter((row) => row.kind !== "summary");
            const isLastLine = lineIndex === printableLines.length - 1;

            return (
              // Enough of the block must fit for it to make sense where it
              // starts: a "Chop & Join" header alone at the foot of a page
              // reads as a frame with no parts. 64pt is its header (26), the
              // heading strip (16) and one component row (22) — reserving more
              // pushed whole blocks to the next page and left a half-empty one
              // behind.
              <View key={item.id}>
                {componentsOnly ? <QuotationLineGroup item={item} /> : null}
                {ownRow ? (
                  <QuotationTableRow row={ownRow} isLast={isLastLine && parts.length === 0} />
                ) : null}
                {parts.length > 0 ? (
                  // The closing rule lives on this wrapper, at full width, so
                  // it meets the outer table's edges; the panel inside it stays
                  // inset.
                  <View style={styles.componentPanelClose}>
                    <View style={styles.componentPanel}>
                      {/* The enclosing block already reserves room for this and
                        its first rows, so no guard of its own. */}
                      <View style={styles.componentPanelHeader} wrap={false}>
                        <Text style={[styles.componentPanelHeaderCell, styles.colQty]}>Qty</Text>
                        <Text style={[styles.componentPanelHeaderCell, styles.colUnit]}>Unit</Text>
                        <Text style={[styles.componentPanelHeaderCell, styles.colDescription]}>
                          Component
                        </Text>
                        <Text style={[styles.componentPanelHeaderCell, styles.colUnitPrice]}>
                          Rate
                        </Text>
                        <Text style={[styles.componentPanelHeaderCell, styles.colDiscount]}>
                          Disc.
                        </Text>
                        <Text style={[styles.componentPanelHeaderCell, styles.colAmount]}>
                          Amount
                        </Text>
                      </View>
                      {parts.map((row, index) => (
                        <QuotationTableRow
                          key={row.key}
                          row={row}
                          // The full-width rule below closes the group, so the
                          // last row drops its own inset one.
                          isLast={index === parts.length - 1}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* One unit: split across a page break, Subtotal is stranded at the
            foot of one page and reads as the amount owed. */}
        <View style={styles.summarySection} wrap={false}>
          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{formatMoney(totals.subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount</Text>
              <Text style={styles.discountValue}>-{formatMoney(totals.totalDiscount)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax</Text>
              <Text style={styles.totalValue}>{formatMoney(totals.totalTax)}</Text>
            </View>
            <View style={styles.grandTotal}>
              <Text>Total</Text>
              <Text>{formatMoney(totals.totalAmount)}</Text>
            </View>
          </View>
        </View>

        {showTerms || quotation.notes ? (
          <View style={styles.terms} wrap={false}>
            {showTerms ? (
              <>
                <Text style={styles.termsTitle}>Terms and Conditions</Text>
                <Text style={styles.termsText}>{quotation.terms}</Text>
              </>
            ) : null}
            {quotation.notes ? (
              <>
                <Text style={[styles.termsTitle, styles.notesTitle]}>Notes</Text>
                <Text style={styles.termsText}>{quotation.notes}</Text>
              </>
            ) : null}
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text>
            {quotation.quotationNumber} - Generated {generatedAt}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};
