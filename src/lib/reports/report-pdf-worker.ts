export type ReportPdfWorkerRequest<Props> = {
  props: Props;
  fontUrl: string;
};

type ReportPdfWorkerResult = { blob: Blob } | { error: string };

export function runReportPdfWorker<Props>(
  createWorker: () => Worker,
  props: Props,
  signal: AbortSignal
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Preview cancelled", "AbortError"));
      return;
    }
    const worker = createWorker();
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
    worker.onmessage = (event: MessageEvent<ReportPdfWorkerResult>) => {
      cleanup();
      if ("blob" in event.data) resolve(event.data.blob);
      else reject(new Error("REPORT_PDF_FAILED"));
    };
    worker.onerror = worker.onmessageerror = () => {
      cleanup();
      reject(new Error("REPORT_PDF_FAILED"));
    };
    try {
      worker.postMessage({
        props,
        fontUrl: new URL("/fonts/ArialUnicode.ttf", window.location.origin).href,
      } satisfies ReportPdfWorkerRequest<Props>);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
