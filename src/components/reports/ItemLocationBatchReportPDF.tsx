import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ItemLocationBatchReportRow } from "@/hooks/useItemLocationBatchReport";

Font.register({
  family: "ArialUnicode",
  fonts: [
    { src: "/fonts/ArialUnicode.ttf", fontWeight: "normal" },
    { src: "/fonts/ArialUnicode.ttf", fontWeight: "bold" },
  ],
});

type ItemLocationBatchReportPDFProps = {
  title: string;
  subtitle: string;
  generatedAtLabel: string;
  itemLabel: string;
  warehouseLocationLabel: string;
  batchLabel: string;
  locationSkuLabel: string;
  onHandLabel: string;
  reservedLabel: string;
  availableLabel: string;
  updatedLabel: string;
  noValueLabel: string;
  pageSummary: string;
  rows: ItemLocationBatchReportRow[];
};

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 10,
    fontFamily: "ArialUnicode",
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  header: { marginBottom: 14 },
  title: { fontSize: 24, marginBottom: 4 },
  subtitle: { fontSize: 13, color: "#6b7280", marginBottom: 6 },
  meta: { fontSize: 10, color: "#6b7280" },
  table: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 4, overflow: "hidden" },
  tableHeader: { flexDirection: "row", backgroundColor: "#e5e7eb", minHeight: 36, alignItems: "center" },
  row: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#e5e7eb", minHeight: 38 },
  cell: { paddingHorizontal: 4, paddingVertical: 7, justifyContent: "center" },
  headerText: { fontSize: 9 },
  cellText: { fontSize: 9 },
  muted: { fontSize: 8, color: "#6b7280", marginTop: 2 },
  right: { textAlign: "right" },
  footer: { marginTop: 10, fontSize: 10, color: "#6b7280", textAlign: "right" },
  wItem: { width: "18%" },
  wLocation: { width: "18%" },
  wBatch: { width: "13%" },
  wSku: { width: "12%" },
  wQty: { width: "9%" },
  wUpdated: { width: "12%" },
});

const qty = (value: number) => value.toFixed(2);

export const ItemLocationBatchReportPDF = ({
  title,
  subtitle,
  generatedAtLabel,
  itemLabel,
  warehouseLocationLabel,
  batchLabel,
  locationSkuLabel,
  onHandLabel,
  reservedLabel,
  availableLabel,
  updatedLabel,
  noValueLabel,
  pageSummary,
  rows,
}: ItemLocationBatchReportPDFProps) => (
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
          <View style={[styles.cell, styles.wItem]}><Text style={styles.headerText}>{itemLabel}</Text></View>
          <View style={[styles.cell, styles.wLocation]}><Text style={styles.headerText}>{warehouseLocationLabel}</Text></View>
          <View style={[styles.cell, styles.wBatch]}><Text style={styles.headerText}>{batchLabel}</Text></View>
          <View style={[styles.cell, styles.wSku]}><Text style={styles.headerText}>{locationSkuLabel}</Text></View>
          <View style={[styles.cell, styles.wQty]}><Text style={[styles.headerText, styles.right]}>{onHandLabel}</Text></View>
          <View style={[styles.cell, styles.wQty]}><Text style={[styles.headerText, styles.right]}>{reservedLabel}</Text></View>
          <View style={[styles.cell, styles.wQty]}><Text style={[styles.headerText, styles.right]}>{availableLabel}</Text></View>
          <View style={[styles.cell, styles.wUpdated]}><Text style={styles.headerText}>{updatedLabel}</Text></View>
        </View>

        {rows.map((row) => (
          <View key={row.id} style={styles.row}>
            <View style={[styles.cell, styles.wItem]}>
              <Text style={styles.cellText}>{row.itemCode || noValueLabel}</Text>
              <Text style={styles.muted}>{row.itemName || noValueLabel}</Text>
            </View>
            <View style={[styles.cell, styles.wLocation]}>
              <Text style={styles.cellText}>{row.warehouseCode || noValueLabel}</Text>
              <Text style={styles.muted}>{row.locationCode || noValueLabel}</Text>
            </View>
            <View style={[styles.cell, styles.wBatch]}>
              <Text style={styles.cellText}>{row.batchCode || noValueLabel}</Text>
              <Text style={styles.muted}>
                {row.batchAgeDays !== null ? `${row.batchAgeDays}d` : noValueLabel}
              </Text>
            </View>
            <View style={[styles.cell, styles.wSku]}>
              <Text style={styles.cellText}>{row.batchLocationSku || noValueLabel}</Text>
            </View>
            <View style={[styles.cell, styles.wQty]}>
              <Text style={[styles.cellText, styles.right]}>{qty(row.qtyOnHand)}</Text>
            </View>
            <View style={[styles.cell, styles.wQty]}>
              <Text style={[styles.cellText, styles.right]}>{qty(row.qtyReserved)}</Text>
            </View>
            <View style={[styles.cell, styles.wQty]}>
              <Text style={[styles.cellText, styles.right]}>{qty(row.qtyAvailable)}</Text>
            </View>
            <View style={[styles.cell, styles.wUpdated]}>
              <Text style={styles.cellText}>
                {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : noValueLabel}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.footer}>{pageSummary}</Text>
    </Page>
  </Document>
);
