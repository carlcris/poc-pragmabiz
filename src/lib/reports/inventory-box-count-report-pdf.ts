import type { InventoryBoxCountReportPDFProps } from "@/components/reports/InventoryBoxCountReportPDF";
import { runReportPdfWorker } from "./report-pdf-worker";

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
