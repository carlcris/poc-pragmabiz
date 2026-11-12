import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderItemLocationReportPdf } from "./item-location-report-pdf";
import type { ItemLocationBatchReportPDFProps } from "@/components/reports/ItemLocationBatchReportPDF";

const props = { rows: [] } as unknown as ItemLocationBatchReportPDFProps;
const workers: FakeWorker[] = [];
class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    workers.push(this);
  }
}
beforeEach(() => {
  workers.length = 0;
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("window", { location: { origin: "https://example.com" } });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("passes serializable props and an absolute font URL, then terminates on success", async () => {
  const promise = renderItemLocationReportPdf(props, new AbortController().signal);
  expect(workers[0].postMessage).toHaveBeenCalledWith({
    props,
    fontUrl: "https://example.com/fonts/ArialUnicode.ttf",
  });
  const blob = new Blob(["pdf"]);
  workers[0].onmessage?.({ data: { blob } } as MessageEvent);
  expect(await promise).toBe(blob);
  expect(workers[0].terminate).toHaveBeenCalledOnce();
});
it("terminates immediately when the preview is cancelled", async () => {
  const controller = new AbortController();
  const promise = renderItemLocationReportPdf(props, controller.signal);
  controller.abort();
  await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  expect(workers[0].terminate).toHaveBeenCalledOnce();
});
it("does not start rendering after a closed preview finishes fetching", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(renderItemLocationReportPdf(props, controller.signal)).rejects.toMatchObject({
    name: "AbortError",
  });
  expect(workers).toHaveLength(0);
});
it.each(["message", "crash", "deserialization"])(
  "releases resources after a worker %s failure",
  async (mode) => {
    const promise = renderItemLocationReportPdf(props, new AbortController().signal);
    if (mode === "message") workers[0].onmessage?.({ data: { error: "failure" } } as MessageEvent);
    else if (mode === "crash") workers[0].onerror?.();
    else workers[0].onmessageerror?.();
    await expect(promise).rejects.toThrow("REPORT_PDF_FAILED");
    expect(workers[0].terminate).toHaveBeenCalledOnce();
  }
);
it("terminates a stalled worker after the deadline", async () => {
  vi.useFakeTimers();
  const promise = renderItemLocationReportPdf(props, new AbortController().signal);
  const assertion = expect(promise).rejects.toThrow("REPORT_PDF_TIMEOUT");
  await vi.advanceTimersByTimeAsync(180000);
  await assertion;
  expect(workers[0].terminate).toHaveBeenCalledOnce();
});
