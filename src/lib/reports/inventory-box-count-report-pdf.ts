import type { InventoryBoxCountReportPDFProps } from "@/components/reports/InventoryBoxCountReportPDF";
import type { InventoryBoxCountReportRow } from "@/types/inventory-box-count-report";
import { runReportPdfWorker } from "./report-pdf-worker";

export function getInventoryBoxCountReferenceSize(
  rows: readonly InventoryBoxCountReportRow[]
): number | null {
  if (rows.length === 0) return null;
  return rows.reduce((largest, row) => Math.max(largest, row.qtyPerPackingUnit), 0);
}

export function renderInventoryBoxCountReportPdf(
  props: InventoryBoxCountReportPDFProps,
  signal: AbortSignal
): Promise<Blob> {
  return runReportPdfWorker(
    () =>
      new Worker(new URL("./inventory-box-count-report-pdf.worker.ts", import.meta.url), {
        type: "module",
      }),
    props,
    signal
  );
}
