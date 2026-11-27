import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import {
  getInventoryBoxCountReportErrorCode,
  useInventoryBoxCountReport,
} from "./useInventoryBoxCountReport";

function getReportRequester() {
  let fetchReport: ReturnType<typeof useInventoryBoxCountReport> | undefined;
  function ReportRequester() {
    fetchReport = useInventoryBoxCountReport();
    return null;
  }
  renderToStaticMarkup(createElement(ReportRequester));
  if (!fetchReport) throw new Error("The report requester did not render");
  return fetchReport;
}

const filters = { categoryId: "category", packingUnitId: "box" };

afterEach(() => vi.unstubAllGlobals());

it("loads the PDF report on demand and omits businessUnitId for all units", async () => {
  const report = {
    data: [],
    summary: { totalItems: 0, totalFullPackingUnits: 0, itemsWithoutPackingUnitSize: 0 },
    category: { id: "category", name: "Supplies" },
    businessUnit: null,
    packingUnit: { id: "box", code: "BOX", name: "Box" },
    pagination: { page: 1, limit: 5000, totalPages: 0 },
  };
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(report)));
  vi.stubGlobal("fetch", fetch);
  const fetchReport = getReportRequester();
  expect(fetch).not.toHaveBeenCalled();

  await expect(fetchReport(filters, new AbortController().signal)).resolves.toEqual(report);
  const [endpoint] = fetch.mock.calls[0];
  const url = new URL(endpoint, "https://example.test");
  expect(url.pathname).toBe("/api/reports/inventory-box-count");
  expect(Object.fromEntries(url.searchParams)).toEqual({ ...filters, exportMode: "pdf" });
});

it("sends the chosen business unit and cancels the request with the preview signal", async () => {
  const fetch = vi.fn(
    (_url: string, request: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        request.signal?.addEventListener("abort", () => reject(request.signal?.reason), {
          once: true,
        });
      })
  );
  vi.stubGlobal("fetch", fetch);
  const controller = new AbortController();
  const pending = getReportRequester()({ ...filters, businessUnitId: "branch" }, controller.signal);
  const [endpoint, request] = fetch.mock.calls[0];
  expect(new URL(endpoint, "https://example.test").searchParams.get("businessUnitId")).toBe(
    "branch"
  );
  expect(request.signal).toBe(controller.signal);

  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
});

it("preserves an actionable report error for the preview to translate", async () => {
  const errorBody = { error: "Report too large", code: "INVENTORY_BOX_COUNT_TOO_LARGE" };
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify(errorBody), { status: 413 }))
  );

  const error = await getReportRequester()(filters, new AbortController().signal).catch(
    (failure: unknown) => failure
  );
  expect(getInventoryBoxCountReportErrorCode(error)).toBe(errorBody.code);
});
