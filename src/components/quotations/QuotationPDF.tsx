import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Quotation } from "@/types/quotation";

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

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontSize: 11,
    fontFamily: "ArialUnicode",
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  header: {
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
  },
  title: {
    fontSize: 28,
    fontFamily: "ArialUnicode",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "#6b7280",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    marginTop: 8,
  },
  metaCol: {
    flex: 1,
    gap: 3,
  },
  metaRight: {
    textAlign: "right",
  },
  label: {
    color: "#6b7280",
    fontSize: 10,
  },
  value: {
    fontSize: 11,
  },
  section: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "ArialUnicode",
    marginBottom: 6,
  },
  lineCard: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 4,
    marginBottom: 10,
    overflow: "hidden",
  },
  lineHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  lineItem: {
    width: "41%",
    paddingRight: 8,
  },
  lineQty: {
    width: "11%",
    textAlign: "right",
  },
  linePrice: {
    width: "13%",
    textAlign: "right",
  },
  lineRate: {
    width: "8%",
    textAlign: "right",
  },
  lineTotal: {
    width: "19%",
    textAlign: "right",
    fontFamily: "ArialUnicode",
  },
  muted: {
    color: "#6b7280",
    fontSize: 9,
    marginTop: 2,
  },
  detailGrid: {
    flexDirection: "row",
    padding: 8,
  },
  detailBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
    padding: 7,
    marginRight: 8,
  },
  detailBoxLast: {
    marginRight: 0,
  },
  detailTitle: {
    fontSize: 11,
    fontFamily: "ArialUnicode",
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  componentsTable: {
    marginHorizontal: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
  },
  tableRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  th: {
    fontSize: 10,
    fontFamily: "ArialUnicode",
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  td: {
    fontSize: 10,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  colType: { width: "11%" },
  colItem: { width: "37%" },
  colQty: { width: "10%", textAlign: "right" },
  colUnit: { width: "8%", textAlign: "center" },
  colMoney: { width: "12%", textAlign: "right" },
  totals: {
    marginTop: 10,
    marginLeft: "auto",
    width: 220,
    gap: 4,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  grandTotal: {
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    fontSize: 14,
    fontFamily: "ArialUnicode",
  },
  terms: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
  },
});

const formatMoney = (value: number) => `PHP ${formatAmount(value)}`;

const formatAmount = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const formatNumber = (value: number | undefined) =>
  new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value && Number.isFinite(value) ? value : 0);

const formatDate = (value: string) => new Date(value).toLocaleDateString("en-PH");

const serviceModeLabel = (value: string) => {
  if (value === "per_frame") return "Per frame";
  if (value === "per_order") return "Per order";
  if (value === "size_based") return "By frame size";
  if (value === "service_type") return "By service type";
  if (value === "manual") return "Manual";
  return value;
};

export const QuotationPDF = ({ quotation, generatedAt }: QuotationPDFProps) => (
  <Document title={`Quotation ${quotation.quotationNumber}`}>
    <Page size="A4" orientation="landscape" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Quotation</Text>
        <Text style={styles.subtitle}>{quotation.quotationNumber}</Text>
        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.label}>Customer</Text>
            <Text style={styles.value}>{quotation.customerName || "-"}</Text>
            <Text style={styles.muted}>{quotation.customerEmail || ""}</Text>
          </View>
          <View style={[styles.metaCol, styles.metaRight]}>
            <Text style={styles.value}>Date: {formatDate(quotation.quotationDate)}</Text>
            <Text style={styles.value}>Valid until: {formatDate(quotation.validUntil)}</Text>
            <Text style={styles.muted}>Generated: {generatedAt}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Line Items</Text>
        {quotation.lineItems.map((item, index) => {
          const config = item.frameConfiguration;
          const components = item.frameComponents || [];
          const moldingComponent = components.find(
            (component) => component.componentType === "molding"
          );

          return (
            <View key={`${item.id}-${index}`} style={styles.lineCard}>
              <View style={styles.lineHeader}>
                <View style={styles.lineItem}>
                  <Text style={styles.value}>{item.itemName || item.description}</Text>
                  <Text style={styles.muted}>{item.itemCode || ""}</Text>
                </View>
                <Text style={styles.lineQty}>
                  {formatNumber(item.quantity)} {item.uomCode || item.uomName || ""}
                </Text>
                <Text style={styles.linePrice}>{formatAmount(item.unitPrice)}</Text>
                <Text style={styles.lineRate}>{formatNumber(item.discount)}%</Text>
                <Text style={styles.lineRate}>{formatNumber(item.taxRate)}%</Text>
                <Text style={styles.lineTotal}>{formatMoney(item.lineTotal)}</Text>
              </View>

              {config && (
                <>
                  <View style={styles.detailGrid}>
                    <View style={styles.detailBox}>
                      <Text style={styles.detailTitle}>Frame Size</Text>
                      <View style={styles.detailRow}>
                        <Text style={styles.label}>Width</Text>
                        <Text>{formatNumber(config.width)}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.label}>Height</Text>
                        <Text>{formatNumber(config.height)}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.label}>Allowance</Text>
                        <Text>{formatNumber(config.fixedAllowance)}</Text>
                      </View>
                    </View>
                    <View style={styles.detailBox}>
                      <Text style={styles.detailTitle}>Molding</Text>
                      <Text style={styles.value}>
                        {config.moldingItemCode || moldingComponent?.itemCode || "-"}
                      </Text>
                      <Text style={styles.muted}>
                        {config.moldingItemName || moldingComponent?.itemName || ""}
                      </Text>
                      <View style={styles.detailRow}>
                        <Text style={styles.label}>Stick length</Text>
                        <Text>{formatNumber(config.moldingStickLength)}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.label}>Sticks</Text>
                        <Text>{formatNumber(config.moldingSticksRequired)}</Text>
                      </View>
                    </View>
                    <View style={[styles.detailBox, styles.detailBoxLast]}>
                      <Text style={styles.detailTitle}>Service</Text>
                      <View style={styles.detailRow}>
                        <Text style={styles.label}>Mode</Text>
                        <Text>{serviceModeLabel(config.serviceFeeMode)}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.label}>Fee</Text>
                        <Text>{formatMoney(config.serviceFeeAmount)}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.label}>Total</Text>
                        <Text>{formatMoney(config.totalServiceFee)}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.componentsTable}>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.th, styles.colType]}>Type</Text>
                      <Text style={[styles.th, styles.colItem]}>Item</Text>
                      <Text style={[styles.th, styles.colQty]}>Qty/Frame</Text>
                      <Text style={[styles.th, styles.colQty]}>Total Qty</Text>
                      <Text style={[styles.th, styles.colUnit]}>Unit</Text>
                      <Text style={[styles.th, styles.colMoney]}>Rate</Text>
                      <Text style={[styles.th, styles.colMoney]}>Amount</Text>
                    </View>
                    {components.map((component) => (
                      <View key={component.id || component.itemId} style={styles.tableRow}>
                        <Text style={[styles.td, styles.colType]}>{component.componentType}</Text>
                        <View style={[styles.td, styles.colItem]}>
                          <Text>
                            {component.itemCode || "-"} {component.itemName || ""}
                          </Text>
                          {component.description ? (
                            <Text style={styles.muted}>{component.description}</Text>
                          ) : null}
                        </View>
                        <Text style={[styles.td, styles.colQty]}>
                          {formatNumber(component.qtyPerFrame)}
                        </Text>
                        <Text style={[styles.td, styles.colQty]}>
                          {formatNumber(component.totalQuantity)}
                        </Text>
                        <Text style={[styles.td, styles.colUnit]}>{component.uomCode || ""}</Text>
                        <Text style={[styles.td, styles.colMoney]}>
                          {formatAmount(component.unitRate)}
                        </Text>
                        <Text style={[styles.td, styles.colMoney]}>
                          {formatAmount(component.totalAmount)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.totals}>
        <View style={styles.totalRow}>
          <Text>Subtotal</Text>
          <Text>{formatMoney(quotation.subtotal)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text>Discount</Text>
          <Text>-{formatMoney(quotation.totalDiscount)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text>Tax</Text>
          <Text>{formatMoney(quotation.totalTax)}</Text>
        </View>
        <View style={[styles.totalRow, styles.grandTotal]}>
          <Text>Total</Text>
          <Text>{formatMoney(quotation.totalAmount)}</Text>
        </View>
      </View>

      {(quotation.terms || quotation.notes) && (
        <View style={styles.terms}>
          {quotation.terms ? (
            <>
              <Text style={styles.sectionTitle}>Terms and Conditions</Text>
              <Text>{quotation.terms}</Text>
            </>
          ) : null}
          {quotation.notes ? (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Notes</Text>
              <Text>{quotation.notes}</Text>
            </>
          ) : null}
        </View>
      )}
    </Page>
  </Document>
);
