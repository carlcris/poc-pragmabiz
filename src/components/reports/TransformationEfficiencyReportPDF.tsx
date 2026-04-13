import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { TransformationEfficiencyGroupRow } from "@/hooks/useTransformationEfficiencyReport";

Font.register({
  family: "ArialUnicode",
  fonts: [
    { src: "/fonts/ArialUnicode.ttf", fontWeight: "normal" },
    { src: "/fonts/ArialUnicode.ttf", fontWeight: "bold" },
  ],
});

type TransformationEfficiencyReportPDFProps = {
  title: string;
  subtitle: string;
  generatedAtLabel: string;
  groupLabel: string;
  ordersLabel: string;
  yieldLabel: string;
  wasteLabel: string;
  planLabel: string;
  avgCycleLabel: string;
  varianceLabel: string;
  noValueLabel: string;
  pageSummary: string;
  rows: TransformationEfficiencyGroupRow[];
};

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 10, fontFamily: "ArialUnicode", color: "#111827" },
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
  wGroup: { width: "26%" },
  wQty: { width: "9%" },
  wMetric: { width: "11%" },
});

const num = (value: number, digits = 1) => value.toFixed(digits);

export const TransformationEfficiencyReportPDF = ({
  title,
  subtitle,
  generatedAtLabel,
  groupLabel,
  ordersLabel,
  yieldLabel,
  wasteLabel,
  planLabel,
  avgCycleLabel,
  varianceLabel,
  noValueLabel,
  pageSummary,
  rows,
}: TransformationEfficiencyReportPDFProps) => (
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
          <View style={[styles.cell, styles.wGroup]}><Text style={styles.headerText}>{groupLabel}</Text></View>
          <View style={[styles.cell, styles.wQty]}><Text style={[styles.headerText, styles.right]}>{ordersLabel}</Text></View>
          <View style={[styles.cell, styles.wMetric]}><Text style={[styles.headerText, styles.right]}>{yieldLabel}</Text></View>
          <View style={[styles.cell, styles.wMetric]}><Text style={[styles.headerText, styles.right]}>{wasteLabel}</Text></View>
          <View style={[styles.cell, styles.wMetric]}><Text style={[styles.headerText, styles.right]}>{planLabel}</Text></View>
          <View style={[styles.cell, styles.wMetric]}><Text style={[styles.headerText, styles.right]}>{avgCycleLabel}</Text></View>
          <View style={[styles.cell, styles.wMetric]}><Text style={[styles.headerText, styles.right]}>{varianceLabel}</Text></View>
        </View>

        {rows.map((row) => (
          <View key={row.key} style={styles.row}>
            <View style={[styles.cell, styles.wGroup]}>
              <Text style={styles.cellText}>
                {row.templateCode || row.warehouseCode || noValueLabel}
              </Text>
              <Text style={styles.muted}>
                {row.templateName || row.warehouseName || noValueLabel}
              </Text>
            </View>
            <View style={[styles.cell, styles.wQty]}><Text style={[styles.cellText, styles.right]}>{num(row.orderCount, 0)}</Text></View>
            <View style={[styles.cell, styles.wMetric]}><Text style={[styles.cellText, styles.right]}>{num(row.yieldPct)}%</Text></View>
            <View style={[styles.cell, styles.wMetric]}><Text style={[styles.cellText, styles.right]}>{num(row.wasteRatePct)}%</Text></View>
            <View style={[styles.cell, styles.wMetric]}><Text style={[styles.cellText, styles.right]}>{num(row.planAdherencePct)}%</Text></View>
            <View style={[styles.cell, styles.wMetric]}><Text style={[styles.cellText, styles.right]}>{num(row.averageCycleSeconds / 60)}</Text></View>
            <View style={[styles.cell, styles.wMetric]}><Text style={[styles.cellText, styles.right]}>{num(row.totalCostVariance)}</Text></View>
          </View>
        ))}
      </View>

      <Text style={styles.footer}>{pageSummary}</Text>
    </Page>
  </Document>
);
