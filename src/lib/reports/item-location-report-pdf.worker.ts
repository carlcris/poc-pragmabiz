import { Font } from "@react-pdf/renderer";
import { buildItemLocationReportPdf } from "./build-item-location-report-pdf";
import type { ItemLocationBatchReportPDFProps } from "@/components/reports/ItemLocationBatchReportPDF";
import type { ReportPdfWorkerRequest } from "./report-pdf-worker";

self.onmessage = async (
  event: MessageEvent<ReportPdfWorkerRequest<ItemLocationBatchReportPDFProps>>
) => {
  try {
    // Worker URLs point at a bundled chunk, so font URLs must be absolute.
    Font.register({
      family: "ArialUnicode",
      fonts: [
        { src: event.data.fontUrl, fontWeight: "normal" },
        { src: event.data.fontUrl, fontWeight: "bold" },
      ],
    });
    const blob = await buildItemLocationReportPdf(event.data.props);
    self.postMessage({ blob });
  } catch {
    self.postMessage({ error: "REPORT_PDF_FAILED" });
  }
};
