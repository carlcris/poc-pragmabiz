import { Font } from "@react-pdf/renderer";
import { buildItemLocationReportPdf } from "./build-item-location-report-pdf";
import type { ItemLocationPdfRequest } from "./item-location-report-pdf";

self.onmessage = async (event: MessageEvent<ItemLocationPdfRequest>) => {
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
