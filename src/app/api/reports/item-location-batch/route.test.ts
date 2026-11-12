import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "./route";

type CountResult = { count: number | null; error: { message: string } | null };

const state = vi.hoisted(() => ({
  permission: vi.fn(),
  client: vi.fn(),
  select: vi.fn(),
  range: vi.fn(),
  gt: vi.fn(),
  order: vi.fn(),
  eq: vi.fn(),
  countResult: { count: 0, error: null } as CountResult,
}));
vi.mock("@/lib/auth", () => ({ requirePermission: state.permission }));
vi.mock("@/lib/supabase/server-with-bu", () => ({ createServerClientWithBU: state.client }));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: <T>(handler: T) => handler,
}));
const request = (query = "") =>
  GET(new NextRequest(`http://localhost/api/reports/item-location-batch?${query}`));
const setCount = (count: number | null, error: CountResult["error"] = null) => {
  state.countResult = { count, error };
};
beforeEach(() => {
  vi.clearAllMocks();
  state.permission.mockResolvedValue(null);
  setCount(0);
  const query = {
    select: state.select.mockReturnThis(),
    eq: state.eq.mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    gt: state.gt.mockReturnThis(),
    order: state.order.mockReturnThis(),
    range: state.range,
    single: vi.fn().mockResolvedValue({ data: { company_id: "company" } }),
    // Awaiting the filtered head query resolves the up-front row count.
    then: (resolve: (value: CountResult) => unknown) => resolve(state.countResult),
  };
  state.client.mockResolvedValue({
    supabase: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user" } } }) },
      from: vi.fn().mockReturnValue(query),
    },
  });
  state.range.mockResolvedValue({ data: [], error: null });
});
const sliceRows = (rows: { id: string }[]) => async (start: number, end: number) => ({
  data: rows.slice(start, end + 1),
  error: null,
});

it("checks report permission before data access", async () => {
  state.permission.mockResolvedValue(NextResponse.json({}, { status: 403 }));
  expect((await request()).status).toBe(403);
  expect(state.client).not.toHaveBeenCalled();
});
it("excludes empty location records by default and scopes company", async () => {
  const response = await request();
  expect(response.status).toBe(200);
  expect(state.gt).toHaveBeenCalledWith("qty_on_hand", 0);
  expect(state.eq).toHaveBeenCalledWith("company_id", "company");
  expect(state.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
  expect(state.range).not.toHaveBeenCalled();
  expect(await response.json()).toMatchObject({
    data: [],
    filters: { groupBy: "item", includeEmptyBatches: false },
    groupSubtotals: {},
  });
});
it("includes empty location records only when requested", async () => {
  expect((await request("includeEmptyBatches=true")).status).toBe(200);
  expect(state.gt).not.toHaveBeenCalled();
});
it.each(["item", "batch"])("orders %s groups for stable batched reads", async (groupBy) => {
  setCount(1);
  state.range.mockResolvedValue({ data: [{ id: "1" }], error: null });
  expect((await request(`groupBy=${groupBy}&warehouseId=warehouse&itemId=item`)).status).toBe(
    200
  );
  expect(state.order).toHaveBeenNthCalledWith(1, groupBy === "item" ? "item_id" : "item_batch_id", {
    ascending: true,
  });
  expect(state.order).toHaveBeenLastCalledWith("id", { ascending: true });
  expect(state.eq).toHaveBeenCalledWith("warehouse_id", "warehouse");
  expect(state.eq).toHaveBeenCalledWith("item_id", "item");
  expect(state.range).toHaveBeenCalledWith(0, 0);
});
it.each(["groupBy=invalid", "includeEmptyBatches=maybe", "locale=fr"])(
  "rejects invalid options: %s",
  async (query) => {
    expect((await request(query)).status).toBe(400);
    expect(state.range).not.toHaveBeenCalled();
  }
);
it("refuses oversized reports before reading any rows", async () => {
  setCount(10001);
  expect((await request()).status).toBe(413);
  expect(state.range).not.toHaveBeenCalled();
});
it("logs database errors without exposing them", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  setCount(null, { message: "private detail" });
  const response = await request();
  expect(response.status).toBe(500);
  expect(JSON.stringify(await response.json())).not.toContain("private detail");
  expect(log).toHaveBeenCalled();
  log.mockRestore();
});
it("exports more than the old 50-row page with exact location details and totals", async () => {
  const rows = Array.from({ length: 75 }, (_, index) => ({
    id: String(index),
    item_id: "item",
    warehouse_id: "warehouse",
    location_id: "location",
    item_batch_id: "batch",
    qty_on_hand: "2.50",
    qty_reserved: "0.50",
    qty_available: "2.00",
    updated_at: "2026-11-11",
    item: { id: "item", item_code: "I001", item_name: "Item" },
    warehouse: { id: "warehouse", warehouse_code: "WH", warehouse_name: "Warehouse" },
    location: { id: "location", code: "BIN", name: "Bin", location_path: "Zone / Rack / Bin" },
    item_batch: { id: "batch", batch_code: "B001", received_at: "2026-11-01" },
  }));
  setCount(75);
  state.range.mockResolvedValue({ data: rows, error: null });
  const response = await request();
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.data).toHaveLength(75);
  expect(body.data[0]).toMatchObject({
    locationPath: "Zone / Rack / Bin",
    batchCode: "B001",
    qtyOnHand: 2.5,
  });
  expect(Object.values(body.groupSubtotals)).toEqual([
    { qtyOnHand: 187.5, qtyReserved: 37.5, qtyAvailable: 150 },
  ]);
  expect(body.summary).toMatchObject({
    totalRows: 75,
    totalQtyOnHand: 187.5,
    totalQtyReserved: 37.5,
    totalQtyAvailable: 150,
  });
});

it("loads every database batch for exports above 1,000 rows", async () => {
  const rows = Array.from({ length: 2501 }, (_, index) => ({
    id: String(index),
    item_id: "item",
    item_batch_id: "batch",
    location_id: "location",
    qty_on_hand: 2,
    qty_reserved: 0,
    qty_available: 2,
  }));
  setCount(rows.length);
  state.range.mockImplementation(sliceRows(rows));
  const response = await request();
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.data).toHaveLength(2501);
  expect(body.summary.totalQtyOnHand).toBe(5002);
  expect(state.range.mock.calls).toEqual([
    [0, 999],
    [1000, 1999],
    [2000, 2500],
  ]);
});
it.each(["empty", "duplicate"])(
  "rejects %s subsequent batches without partial totals",
  async (mode) => {
    setCount(2);
    state.range.mockResolvedValueOnce({ data: [{ id: "first" }], error: null });
    state.range.mockResolvedValueOnce({
      data: mode === "empty" ? [] : [{ id: "first" }],
      error: null,
    });
    const response = await request();
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "REPORT_INCOMPLETE" });
  }
);
it("does not mislabel an empty truncated response as oversized", async () => {
  setCount(50);
  expect((await request()).status).toBe(409);
});
it("accepts the 10,000-row boundary in ten bounded reads", async () => {
  setCount(10000);
  state.range.mockImplementation(async (start: number, end: number) => ({
    data: Array.from({ length: end - start + 1 }, (_, index) => ({ id: String(start + index) })),
    error: null,
  }));
  const response = await request();
  expect(response.status).toBe(200);
  expect((await response.json()).data).toHaveLength(10000);
  expect(state.range).toHaveBeenCalledTimes(10);
});
it("bounds requests even when the database returns tiny partial batches", async () => {
  setCount(100);
  state.range.mockImplementation(async (start: number) => ({
    data: [{ id: String(start) }],
    error: null,
  }));
  expect((await request()).status).toBe(409);
  expect(state.range).toHaveBeenCalledTimes(20);
});
it("fails safely if a later batch query fails", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  setCount(2);
  state.range.mockResolvedValueOnce({ data: [{ id: "first" }], error: null });
  state.range.mockResolvedValueOnce({ data: null, error: { message: "private detail" } });
  const response = await request();
  expect(response.status).toBe(500);
  expect(JSON.stringify(await response.json())).not.toContain("private detail");
  log.mockRestore();
});
it("groups matching batch codes across database chunks before exporting", async () => {
  const rows = Array.from({ length: 1001 }, (_, index) => ({
    id: String(index),
    item_id: index === 1000 ? "item-a" : "item-b",
    item_batch_id: `batch-record-${index}`,
    item: {
      id: index === 1000 ? "item-a" : "item-b",
      item_code: index === 1000 ? "A" : "B",
      item_name: index === 1000 ? "Item A" : "Item B",
    },
    item_batch: {
      id: `batch-record-${index}`,
      batch_code: index === 0 || index === 1000 ? "LOT-A" : "LOT-B",
      received_at: "2026-01-01",
    },
  }));
  setCount(rows.length);
  state.range.mockImplementation(sliceRows(rows));
  const response = await request("groupBy=batch");
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(
    body.data.slice(0, 2).map((row: { id: string; batchCode: string }) => [row.id, row.batchCode])
  ).toEqual([
    ["1000", "LOT-A"],
    ["0", "LOT-A"],
  ]);
  expect(body.data).toHaveLength(1001);
});
