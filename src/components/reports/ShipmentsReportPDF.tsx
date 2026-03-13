import React from "react";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ShipmentsReportRow } from "@/hooks/useShipmentsReport";

Font.register({
  family: "ArialUnicode",
  fonts: [
    { src: "/fonts/ArialUnicode.ttf", fontWeight: "normal" },
    { src: "/fonts/ArialUnicode.ttf", fontWeight: "bold" },
  ],
});

type ShipmentsReportPDFProps = {
  title: string;
  subtitle: string;
  generatedAtLabel: string;
  loadListLabel: string;
  supplierLabel: string;
  containerSealLabel: string;
  shipmentStageLabel: string;
  etaLabel: string;
  actualArrivalLabel: string;
  quantityLabel: string;
  valueLabel: string;
  noValueLabel: string;
  loadingLabel: string;
  inTransitLabel: string;
  arrivedLabel: string;
  pageSummary: string;
  rows: ShipmentsReportRow[];
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
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontFamily: "ArialUnicode",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: "#6b7280",
    marginBottom: 6,
  },
  meta: {
    fontSize: 8,
    color: "#6b7280",
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
    minHeight: 28,
    alignItems: "center",
  },
  tableHeaderText: {
    color: "#111827",
    fontFamily: "ArialUnicode",
    fontSize: 8,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  row: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    minHeight: 30,
    alignItems: "stretch",
  },
  cell: {
    paddingHorizontal: 6,
    paddingVertical: 5,
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
  colLoadList: { width: "16%" },
  colSupplier: { width: "18%" },
  colContainer: { width: "16%" },
  colStage: { width: "10%" },
  colDate: { width: "12%" },
  colQty: { width: "10%" },
  colValue: { width: "12%" },
  footer: {
    marginTop: 10,
    fontSize: 8,
    color: "#6b7280",
    textAlign: "right",
  },
});

const getStageLabel = (
  value: ShipmentsReportRow["shipmentStage"],
  labels: { loading: string; inTransit: string; arrived: string }
) => {
  if (value === "incoming") return labels.loading;
  if (value === "in_transit") return labels.inTransit;
  return labels.arrived;
};

export const ShipmentsReportPDF = ({
  title,
  subtitle,
  generatedAtLabel,
  loadListLabel,
  supplierLabel,
  containerSealLabel,
  shipmentStageLabel,
  etaLabel,
  actualArrivalLabel,
  quantityLabel,
  valueLabel,
  noValueLabel,
  loadingLabel,
  inTransitLabel,
  arrivedLabel,
  pageSummary,
  rows,
}: ShipmentsReportPDFProps) => (
  <Document>
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
          <View style={[styles.cell, styles.colLoadList]}>
            <Text style={styles.tableHeaderText}>{loadListLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colSupplier]}>
            <Text style={styles.tableHeaderText}>{supplierLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colContainer]}>
            <Text style={styles.tableHeaderText}>{containerSealLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colStage]}>
            <Text style={styles.tableHeaderText}>{shipmentStageLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colDate]}>
            <Text style={styles.tableHeaderText}>{etaLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colDate]}>
            <Text style={styles.tableHeaderText}>{actualArrivalLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colQty]}>
            <Text style={[styles.tableHeaderText, styles.right]}>{quantityLabel}</Text>
          </View>
          <View style={[styles.cell, styles.colValue]}>
            <Text style={[styles.tableHeaderText, styles.right]}>{valueLabel}</Text>
          </View>
        </View>

        {rows.map((row) => (
          <View key={row.id} style={styles.row}>
            <View style={[styles.cell, styles.colLoadList]}>
              <Text style={styles.cellText}>{row.llNumber || noValueLabel}</Text>
              <Text style={styles.cellMuted}>{row.supplierLlNumber || noValueLabel}</Text>
            </View>
            <View style={[styles.cell, styles.colSupplier]}>
              <Text style={styles.cellText}>{row.supplierName || noValueLabel}</Text>
              <Text style={styles.cellMuted}>{row.supplierCode || noValueLabel}</Text>
            </View>
            <View style={[styles.cell, styles.colContainer]}>
              <Text style={styles.cellText}>{row.containerNumber || noValueLabel}</Text>
              <Text style={styles.cellMuted}>{row.sealNumber || noValueLabel}</Text>
            </View>
            <View style={[styles.cell, styles.colStage]}>
              <Text style={styles.cellText}>
                {getStageLabel(row.shipmentStage, {
                  loading: loadingLabel,
                  inTransit: inTransitLabel,
                  arrived: arrivedLabel,
                })}
              </Text>
            </View>
            <View style={[styles.cell, styles.colDate]}>
              <Text style={styles.cellText}>
                {row.estimatedArrivalDate
                  ? new Date(row.estimatedArrivalDate).toLocaleDateString()
                  : noValueLabel}
              </Text>
            </View>
            <View style={[styles.cell, styles.colDate]}>
              <Text style={styles.cellText}>
                {row.actualArrivalDate
                  ? new Date(row.actualArrivalDate).toLocaleDateString()
                  : noValueLabel}
              </Text>
            </View>
            <View style={[styles.cell, styles.colQty]}>
              <Text style={[styles.cellText, styles.right]}>{row.totalQuantity.toFixed(2)}</Text>
            </View>
            <View style={[styles.cell, styles.colValue]}>
              <Text style={[styles.cellText, styles.right]}>{row.totalValue.toFixed(2)}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.footer}>{pageSummary}</Text>
    </Page>
  </Document>
);
