import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ExpiredBatchRow, ExpiredBatchesGroupBy } from "@/types/expired-batches-report";

Font.register({ family: "ArialUnicode", src: "/fonts/ArialUnicode.ttf" });
export type ExpiredBatchesLabels = {
  title: string;
  subtotal: string;
  generatedAt: string;
  empty: string;
  item: string;
  batch: string;
  warehouse: string;
  expiration: string;
  daysExpired: string;
  onHand: string;
  reserved: string;
  available: string;
  unit: string;
};
const styles = StyleSheet.create({
  page: { padding: 24, fontFamily: "ArialUnicode", fontSize: 8 },
  title: { fontSize: 24, marginBottom: 4 },
  subtitle: { fontSize: 13, marginBottom: 6, color: "#6b7280" },
  meta: { fontSize: 10, marginBottom: 14, color: "#6b7280" },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#dddddd",
    paddingVertical: 6,
  },
  header: { backgroundColor: "#eeeeee" },
  group: { padding: 8, backgroundColor: "#f9fafb", marginTop: 8, fontSize: 10 },
  subtotal: { backgroundColor: "#f9fafb", borderBottomWidth: 1, borderBottomColor: "#d1d5db" },
  detail: { width: "36%", paddingRight: 5 },
  groupHeading: { paddingLeft: 0 },
  nestedDetail: { paddingLeft: 12 },
  warehouse: { width: "15%", paddingRight: 5 },
  date: { width: "11%" },
  number: { width: "7%", textAlign: "right", paddingRight: 3 },
  unit: { width: "8%", paddingLeft: 3 },
  footer: { position: "absolute", bottom: 12, right: 24, color: "#666666" },
});
export function ExpiredBatchesReportPDF({
  rows,
  labels,
  subtitle,
  locale,
  groupBy,
}: {
  rows: ExpiredBatchRow[];
  labels: ExpiredBatchesLabels;
  subtitle: string;
  locale: string;
  groupBy: ExpiredBatchesGroupBy;
}) {
  // Aggregate per base unit so batch groups spanning different items never mix units.
  const subtotals = new Map<
    string,
    Map<string, { onHand: number; reserved: number; available: number }>
  >();
  for (const row of rows) {
    const group = subtotals.get(row.groupKey) ?? new Map();
    const unit = row.unit || "—";
    const total = group.get(unit) ?? { onHand: 0, reserved: 0, available: 0 };
    total.onHand += row.qtyOnHand;
    total.reserved += row.qtyReserved;
    total.available += row.qtyAvailable;
    group.set(unit, total);
    subtotals.set(row.groupKey, group);
  }
  const pages = Array.from({ length: Math.max(1, Math.ceil(rows.length / 10)) }, (_, index) =>
    rows.slice(index * 10, (index + 1) * 10)
  );
  const number = (value: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
  return (
    <Document title={labels.title}>
      {pages.map((page, index) => (
        <Page key={index} size="A4" orientation="landscape" style={styles.page}>
          {index === 0 ? (
            <View>
              <Text style={styles.title}>{labels.title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
              <Text style={styles.meta}>
                {labels.generatedAt}: {new Date().toLocaleString(locale)}
              </Text>
            </View>
          ) : null}
          <View style={[styles.row, styles.header]} fixed>
            <Text style={styles.detail}>{groupBy === "item" ? labels.batch : labels.item}</Text>
            <Text style={styles.warehouse}>{labels.warehouse}</Text>
            <Text style={styles.date}>{labels.expiration}</Text>
            <Text style={styles.number}>{labels.daysExpired}</Text>
            <Text style={styles.number}>{labels.onHand}</Text>
            <Text style={styles.number}>{labels.reserved}</Text>
            <Text style={styles.number}>{labels.available}</Text>
            <Text style={styles.unit}>{labels.unit}</Text>
          </View>
          {page.map((row, rowIndex) => (
            <View key={row.id} wrap={false}>
              {rowIndex === 0 || page[rowIndex - 1].groupKey !== row.groupKey ? (
                <Text style={[styles.group, styles.groupHeading]}>{row.groupLabel}</Text>
              ) : null}
              <View style={styles.row}>
                <Text style={[styles.detail, styles.nestedDetail]}>
                  {groupBy === "item" ? row.batchCode : `${row.itemCode}\n${row.itemName}`}
                </Text>
                <Text style={styles.warehouse}>{row.warehouse}</Text>
                <Text style={styles.date}>{row.expirationDate}</Text>
                <Text style={styles.number}>{row.daysExpired}</Text>
                <Text style={styles.number}>{number(row.qtyOnHand)}</Text>
                <Text style={styles.number}>{number(row.qtyReserved)}</Text>
                <Text style={styles.number}>{number(row.qtyAvailable)}</Text>
                <Text style={styles.unit}>{row.unit || "—"}</Text>
              </View>
              {rows[index * 10 + rowIndex + 1]?.groupKey !== row.groupKey
                ? Array.from(subtotals.get(row.groupKey) ?? []).map(([unit, total]) => (
                    <View key={unit} style={[styles.row, styles.subtotal]}>
                      <Text style={styles.detail}>{labels.subtotal}</Text>
                      <Text style={styles.warehouse} />
                      <Text style={styles.date} />
                      <Text style={styles.number} />
                      <Text style={styles.number}>{number(total.onHand)}</Text>
                      <Text style={styles.number}>{number(total.reserved)}</Text>
                      <Text style={styles.number}>{number(total.available)}</Text>
                      <Text style={styles.unit}>{unit}</Text>
                    </View>
                  ))
                : null}
            </View>
          ))}
          {rows.length === 0 ? <Text style={styles.group}>{labels.empty}</Text> : null}
          <Text
            style={styles.footer}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
            fixed
          />
        </Page>
      ))}
    </Document>
  );
}
