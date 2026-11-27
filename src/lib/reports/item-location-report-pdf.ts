import type { ItemLocationBatchReportPDFProps } from "@/components/reports/ItemLocationBatchReportPDF";
import { runReportPdfWorker } from "./report-pdf-worker";

export function renderItemLocationReportPdf(
  props: ItemLocationBatchReportPDFProps,
  signal: AbortSignal
): Promise<Blob> {
  return runReportPdfWorker(
    () =>
      new Worker(new URL("./item-location-report-pdf.worker.ts", import.meta.url), {
        type: "module",
      }),
    props,
    signal
  );
}
