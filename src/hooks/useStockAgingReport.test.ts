import { afterEach, expect, it, vi } from "vitest";
import { StockAgingReportError, useStockAgingReport } from "./useStockAgingReport";

const state = vi.hoisted(() => ({
  options: null as null | { queryFn: () => Promise<unknown>; queryKey: unknown[] },
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: NonNullable<typeof state.options>) => {
    state.options = options;
    return {};
  },
}));
afterEach(() => vi.unstubAllGlobals());

it("sends explicit PDF mode and filters without unwrapping the report response", async () => {
  const response = { data: [{ id: "last-row" }], pagination: { total: 1205 } };
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => response });
  vi.stubGlobal("fetch", fetchMock);
  useStockAgingReport({
    exportMode: "pdf",
    groupBy: "batch",
    search: "Item & batch",
    ageBucket: "all",
  });
  expect(await state.options?.queryFn()).toEqual(response);
  const url = new URL(fetchMock.mock.calls[0][0], "http://localhost");
  expect(url.searchParams.get("exportMode")).toBe("pdf");
  expect(url.searchParams.get("groupBy")).toBe("batch");
  expect(url.searchParams.get("search")).toBe("Item & batch");
  expect(url.searchParams.get("ageBucket")).toBe("all");
  expect(url.searchParams.has("limit")).toBe(false);
  expect(state.options?.queryKey[1]).toMatchObject({ exportMode: "pdf" });
});
it("sends the picked item as an exact id and keys the query by it", async () => {
  const itemId = "6f1a0c6e-1d4b-4f6a-9d2e-8a7c5b3e1f04";
  const fetchMock = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ data: [], pagination: { total: 0 } }) });
  vi.stubGlobal("fetch", fetchMock);
  useStockAgingReport({ exportMode: "pdf", itemId });
  await state.options?.queryFn();
  const url = new URL(fetchMock.mock.calls[0][0], "http://localhost");
  expect(url.searchParams.get("itemId")).toBe(itemId);
  // The item picker replaced the Stock Aging prose search box, so an unrequested
  // `search` term must never be inferred from the selected item.
  expect(url.searchParams.has("search")).toBe(false);
  // Two selected items must not share a cached report, so the id has to reach
  // the query key rather than only the request URL.
  expect(state.options?.queryKey[1]).toMatchObject({ itemId });
});
it("preserves the status for translated oversized-report feedback without exposing server text", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 413 }));
  useStockAgingReport({ exportMode: "pdf" });
  await expect(state.options?.queryFn()).rejects.toEqual(new StockAgingReportError(413));
});
