import type { ItemLocationBatchReportPDFProps } from "@/components/reports/ItemLocationBatchReportPDF";

export type ItemLocationPdfRequest = {
  props: ItemLocationBatchReportPDFProps;
  fontUrl: string;
};

type ItemLocationPdfResult = { blob: Blob } | { error: string };

// Keep PDF layout/font processing off the UI thread. One worker per preview
// releases its document tree and font memory on success, failure, or cancellation.
export function renderItemLocationReportPdf(
  props: ItemLocationBatchReportPDFProps,
  signal: AbortSignal
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Preview cancelled", "AbortError"));
      return;
    }
    const worker = new Worker(new URL("./item-location-report-pdf.worker.ts", import.meta.url), {
      type: "module",
    });
    const cleanup = () => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", cancel);
      worker.terminate();
    };
    const cancel = () => {
      cleanup();
      reject(new DOMException("Preview cancelled", "AbortError"));
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("REPORT_PDF_TIMEOUT"));
    }, 180_000);
    signal.addEventListener("abort", cancel, { once: true });
    worker.onmessage = (event: MessageEvent<ItemLocationPdfResult>) => {
      cleanup();
      if ("blob" in event.data) resolve(event.data.blob);
      else reject(new Error("REPORT_PDF_FAILED"));
    };
    // A result that cannot be deserialized fails now instead of waiting for the timeout.
    worker.onerror = worker.onmessageerror = () => {
      cleanup();
      reject(new Error("REPORT_PDF_FAILED"));
    };
    try {
      worker.postMessage({
        props,
        fontUrl: new URL("/fonts/ArialUnicode.ttf", window.location.origin).href,
      } satisfies ItemLocationPdfRequest);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
