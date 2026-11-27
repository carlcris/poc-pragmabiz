import { Font } from "@react-pdf/renderer";
import type { InventoryBoxCountReportPDFProps } from "@/components/reports/InventoryBoxCountReportPDF";
import { buildInventoryBoxCountReportPdf } from "./build-inventory-box-count-report-pdf";
import type { ReportPdfWorkerRequest } from "./report-pdf-worker";

self.onmessage = async (
  event: MessageEvent<ReportPdfWorkerRequest<InventoryBoxCountReportPDFProps>>
) => {
  try {
    const { props, fontUrl } = event.data;
    Font.register({ family: "ArialUnicode", src: fontUrl });
    const blob = await buildInventoryBoxCountReportPdf(props);
    self.postMessage({ blob });
  } catch {
    self.postMessage({ error: "REPORT_PDF_FAILED" });
  }
};
