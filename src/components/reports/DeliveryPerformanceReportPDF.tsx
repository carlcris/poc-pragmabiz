import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type {
  DeliveryPerformanceReportResponse,
  DeliveryPerformanceRow,
} from "@/hooks/useDeliveryPerformanceReport";

Font.register({
  family: "ArialUnicode",
  fonts: [
    { src: "/fonts/ArialUnicode.ttf", fontWeight: "normal" },
    { src: "/fonts/ArialUnicode.ttf", fontWeight: "bold" },
  ],
});

type DeliveryPerformanceReportPDFProps = {
  title: string;
  subtitle: string;
  generatedAtLabel: string;
  periodLabel: string;
  periodValue: string;
  totalDeliveriesLabel: string;
  onTimeRateLabel: string;
  averageTransitLabel: string;
  perfectDeliveryRateLabel: string;
  deliveryNoteLabel: string;
  routeLabel: string;
  dispatchedLabel: string;
  requiredLabel: string;
  receivedLabel: string;
  performanceLabel: string;
  transitLabel: string;
  quantityLabel: string;
  varianceLabel: string;
  dispatchedQuantityLabel: string;
  receivedQuantityLabel: string;
  hoursLabel: string;
  notAvailableLabel: string;
  onTimeLabel: string;
  lateLabel: string;
  inTransitLabel: string;
  discrepancyLabel: string;
  noDeliveriesLabel: string;
  pageSummary: string;
  locale: string;
  rows: DeliveryPerformanceRow[];
  summary: DeliveryPerformanceReportResponse["summary"];
};

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "ArialUnicode", color: "#111827" },
  header: { marginBottom: 12 },
  title: { fontSize: 22, marginBottom: 4 },
  subtitle: { fontSize: 12, color: "#6b7280", marginBottom: 6 },
  meta: { fontSize: 9, color: "#6b7280" },
  metrics: { flexDirection: "row", gap: 8, marginBottom: 12 },
  metric: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
    padding: 8,
  },
  metricLabel: { color: "#6b7280", fontSize: 8, marginBottom: 4 },
  metricValue: { fontSize: 15, fontWeight: "bold" },
  table: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 4, overflow: "hidden" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#e5e7eb",
    minHeight: 34,
    alignItems: "center",
  },
  row: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#e5e7eb", minHeight: 42 },
  cell: { paddingHorizontal: 4, paddingVertical: 6, justifyContent: "center" },
  headerText: { fontSize: 8, fontWeight: "bold" },
  cellText: { fontSize: 8 },
  muted: { fontSize: 7, color: "#6b7280", marginTop: 2 },
  right: { textAlign: "right" },
  statusOnTime: { color: "#15803d" },
  statusLate: { color: "#b91c1c" },
  statusInTransit: { color: "#1d4ed8" },
  discrepancy: { color: "#b45309", marginTop: 2 },
  footer: { marginTop: 10, fontSize: 9, color: "#6b7280", textAlign: "right" },
  wDelivery: { width: "11%" },
  wRoute: { width: "15%" },
  wTimestamp: { width: "15%" },
  wRequiredDate: { width: "12%" },
  wPerformance: { width: "11%" },
  wTransit: { width: "9%" },
  wQuantity: { width: "12%" },
});

const formatNumber = (locale: string, value: number, digits = 0) =>
  new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);

const formatDateTime = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const valueFor = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${valueFor("month")}/${valueFor("day")}/${valueFor("year")} ${valueFor(
    "hour"
  )}:${valueFor("minute")}:${valueFor("second")} ${valueFor("dayPeriod")}`;
};

const formatDate = (value: string | null) => {
  if (!value) return null;
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return null;
  return `${month}/${day}/${year}`;
};

export const DeliveryPerformanceReportPDF = ({
  title,
  subtitle,
  generatedAtLabel,
  periodLabel,
  periodValue,
  totalDeliveriesLabel,
  onTimeRateLabel,
  averageTransitLabel,
  perfectDeliveryRateLabel,
  deliveryNoteLabel,
  routeLabel,
  dispatchedLabel,
  requiredLabel,
  receivedLabel,
  performanceLabel,
  transitLabel,
  quantityLabel,
  varianceLabel,
  dispatchedQuantityLabel,
  receivedQuantityLabel,
  hoursLabel,
  notAvailableLabel,
  onTimeLabel,
  lateLabel,
  inTransitLabel,
  discrepancyLabel,
  noDeliveriesLabel,
  pageSummary,
  locale,
  rows,
  summary,
}: DeliveryPerformanceReportPDFProps) => {
  const performanceLabelFor = (row: DeliveryPerformanceRow) => {
    if (row.performanceStatus === "on_time") return onTimeLabel;
    if (row.performanceStatus === "late") return lateLabel;
    return inTransitLabel;
  };

  const performanceStyleFor = (row: DeliveryPerformanceRow) => {
    if (row.performanceStatus === "on_time") return styles.statusOnTime;
    if (row.performanceStatus === "late") return styles.statusLate;
    return styles.statusInTransit;
  };

  return (
    <Document title={title}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <Text style={styles.meta}>
            {periodLabel}: {periodValue} · {generatedAtLabel}:{" "}
            {formatDateTime(new Date().toISOString())}
          </Text>
        </View>

        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>{totalDeliveriesLabel}</Text>
            <Text style={styles.metricValue}>
              {formatNumber(locale, summary.totalDeliveries)}
            </Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>{onTimeRateLabel}</Text>
            <Text style={styles.metricValue}>
              {formatNumber(locale, summary.onTimeRatePct, 1)}%
            </Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>{averageTransitLabel}</Text>
            <Text style={styles.metricValue}>
              {formatNumber(locale, summary.averageTransitHours, 1)} {hoursLabel}
            </Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>{perfectDeliveryRateLabel}</Text>
            <Text style={styles.metricValue}>
              {formatNumber(locale, summary.perfectDeliveryRatePct, 1)}%
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={[styles.cell, styles.wDelivery]}>
              <Text style={styles.headerText}>{deliveryNoteLabel}</Text>
            </View>
            <View style={[styles.cell, styles.wRoute]}>
              <Text style={styles.headerText}>{routeLabel}</Text>
            </View>
            <View style={[styles.cell, styles.wTimestamp]}>
              <Text style={styles.headerText}>{dispatchedLabel}</Text>
            </View>
            <View style={[styles.cell, styles.wRequiredDate]}>
              <Text style={styles.headerText}>{requiredLabel}</Text>
            </View>
            <View style={[styles.cell, styles.wTimestamp]}>
              <Text style={styles.headerText}>{receivedLabel}</Text>
            </View>
            <View style={[styles.cell, styles.wPerformance]}>
              <Text style={styles.headerText}>{performanceLabel}</Text>
            </View>
            <View style={[styles.cell, styles.wTransit]}>
              <Text style={[styles.headerText, styles.right]}>{transitLabel}</Text>
            </View>
            <View style={[styles.cell, styles.wQuantity]}>
              <Text style={[styles.headerText, styles.right]}>{quantityLabel}</Text>
            </View>
          </View>

          {rows.length === 0 && (
            <View style={styles.row}>
              <View style={[styles.cell, { width: "100%" }]}>
                <Text style={[styles.cellText, styles.muted]}>{noDeliveriesLabel}</Text>
              </View>
            </View>
          )}

          {rows.map((row) => (
            <View key={row.id} style={styles.row}>
              <View style={[styles.cell, styles.wDelivery]}>
                <Text style={styles.cellText}>{row.dnNumber}</Text>
                <Text style={styles.muted}>{row.sourceWarehouseName}</Text>
              </View>
              <View style={[styles.cell, styles.wRoute]}>
                <Text style={styles.cellText}>{row.sourceBusinessUnitName}</Text>
                <Text style={styles.muted}>→ {row.destinationBusinessUnitName}</Text>
              </View>
              <View style={[styles.cell, styles.wTimestamp]}>
                <Text style={styles.cellText}>
                  {formatDateTime(row.dispatchedAt) || notAvailableLabel}
                </Text>
              </View>
              <View style={[styles.cell, styles.wRequiredDate]}>
                <Text style={styles.cellText}>
                  {formatDate(row.requiredDate) || notAvailableLabel}
                </Text>
              </View>
              <View style={[styles.cell, styles.wTimestamp]}>
                <Text style={styles.cellText}>
                  {formatDateTime(row.receivedAt) || notAvailableLabel}
                </Text>
              </View>
              <View style={[styles.cell, styles.wPerformance]}>
                <Text style={[styles.cellText, performanceStyleFor(row)]}>
                  {performanceLabelFor(row)}
                </Text>
                {row.hasDiscrepancy && (
                  <Text style={[styles.muted, styles.discrepancy]}>{discrepancyLabel}</Text>
                )}
              </View>
              <View style={[styles.cell, styles.wTransit]}>
                <Text style={[styles.cellText, styles.right]}>
                  {row.transitHours == null
                    ? notAvailableLabel
                    : `${formatNumber(locale, row.transitHours, 1)} ${hoursLabel}`}
                </Text>
              </View>
              <View style={[styles.cell, styles.wQuantity]}>
                <Text style={[styles.cellText, styles.right]}>
                  {dispatchedQuantityLabel}: {formatNumber(locale, row.dispatchedQty, 2)}
                </Text>
                <Text style={[styles.muted, styles.right]}>
                  {receivedQuantityLabel}: {formatNumber(locale, row.receivedQty, 2)}
                </Text>
                {row.varianceQty !== 0 && (
                  <Text style={[styles.muted, styles.right, styles.discrepancy]}>
                    {varianceLabel}: {formatNumber(locale, row.varianceQty, 2)}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>{pageSummary}</Text>
      </Page>
    </Document>
  );
};
