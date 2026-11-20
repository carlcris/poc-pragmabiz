import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET, POST } from "./route";
import type { StockMoveBatchSelection, StockMovePayload } from "@/lib/validations/stock-move";
import { MAX_STOCK_MOVE_BATCH_SELECTION } from "@/types/stock-move";
import type { Database } from "@/types/database.types";

const mocks = vi.hoisted(() => ({
  permission: vi.fn(),
  context: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  fetch: vi.fn<typeof fetch>(),
}));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: (handler: unknown) => handler,
  setActivityContextIfAvailable: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requirePermission: mocks.permission }));
vi.mock("@/lib/auth/requestContext", () => ({ requireRequestContext: mocks.context }));

const warehouseId = "10000000-0000-4000-8000-000000000001";
const destinationWarehouseId = "10000000-0000-4000-8000-000000000002";
const businessUnitId = "10000000-0000-4000-8000-000000000003";
const batchLocationIds = [
  "10000000-0000-4000-8000-00000000007a",
  "10000000-0000-4000-8000-00000000007b",
];
const maximumSelection = Array.from(
  { length: MAX_STOCK_MOVE_BATCH_SELECTION },
  (_, index) => `20000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`
);
const payload: StockMovePayload = {
  transactionType: "transfer",
  warehouseId,
  toWarehouseId: destinationWarehouseId,
  fromLocationId: "10000000-0000-4000-8000-000000000004",
  toLocationId: "10000000-0000-4000-8000-000000000005",
  transactionDate: "2026-10-05",
  items: [
    {
      itemId: "10000000-0000-4000-8000-000000000006",
      batchSelection: { mode: "exclude", batchLocationIds: [] },
      quantity: 3.25,
    },
  ],
};
const withBatchSelection = (batchSelection: StockMoveBatchSelection): StockMovePayload => ({
  ...payload,
  items: [{ ...payload.items[0], batchSelection }],
});
const selectiveMoves: StockMoveBatchSelection[] = [
  { mode: "include", batchLocationIds },
  { mode: "exclude", batchLocationIds },
  { mode: "include", batchLocationIds: maximumSelection },
];
const request = (body: unknown) =>
  new NextRequest("http://localhost/api/stock-transactions", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.permission.mockResolvedValue(null);
  mocks.context.mockResolvedValue({
    supabase: { rpc: mocks.rpc, from: mocks.from },
    companyId: "company",
    userId: "actor",
    currentBusinessUnitId: businessUnitId,
  });
  mocks.rpc.mockResolvedValue({
    data: { id: "move", transactionCode: "ST-000000001" },
    error: null,
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("stock transaction list API", () => {
  beforeEach(() => {
    const supabase = createClient<Database>("http://localhost:54321", "test-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: mocks.fetch },
    });
    mocks.context.mockResolvedValue({
      supabase,
      companyId: "company",
      userId: "actor",
      currentBusinessUnitId: businessUnitId,
    });
  });

  it.each([
    { params: "", page: 1, limit: 10, offset: 0 },
    { params: "page=2&limit=10", page: 2, limit: 10, offset: 10 },
    { params: "page=2&limit=500", page: 2, limit: 50, offset: 50 },
  ])(
    "orders the full result by the displayed timestamp before paging $params",
    async (testCase) => {
      mocks.fetch.mockResolvedValueOnce(
        Response.json([], { headers: { "Content-Range": "*/75" } })
      );

      const response = await GET(
        new NextRequest(`http://localhost/api/stock-transactions?${testCase.params}`)
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: [],
        pagination: {
          total: 75,
          page: testCase.page,
          limit: testCase.limit,
          totalPages: Math.ceil(75 / testCase.limit),
        },
      });
      expect(mocks.permission).toHaveBeenCalledWith("stock_transactions", "view");
      expect(mocks.fetch).toHaveBeenCalledTimes(1);
      const [input] = mocks.fetch.mock.calls[0];
      const url = new URL(String(input));
      expect(url.pathname).toBe("/rest/v1/stock_transaction_items");
      expect(url.searchParams.get("order")).toBe("transaction(created_at).desc,id.desc");
      expect(url.searchParams.has("transaction.order")).toBe(false);
      expect(url.searchParams.get("offset")).toBe(String(testCase.offset));
      expect(url.searchParams.get("limit")).toBe(String(testCase.limit));
      expect(url.searchParams.get("transaction.company_id")).toBe("eq.company");
      expect(url.searchParams.get("transaction.business_unit_id")).toBe(`eq.${businessUnitId}`);
    }
  );

  it("keeps filtered searches in the same server-side date order", async () => {
    const itemId = payload.items[0].itemId;
    mocks.fetch.mockResolvedValueOnce(Response.json([{ id: itemId }]));
    mocks.fetch.mockResolvedValueOnce(Response.json([], { headers: { "Content-Range": "*/0" } }));
    const params = new URLSearchParams({
      search: "test item",
      transactionType: "transfer",
      warehouseId,
      itemId,
      startDate: "2026-10-01",
      endDate: "2026-10-31",
      page: "2",
      limit: "10",
    });

    const response = await GET(
      new NextRequest(`http://localhost/api/stock-transactions?${params}`)
    );

    expect(response.status).toBe(200);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    const [input] = mocks.fetch.mock.calls[1];
    const url = new URL(String(input));
    expect(url.searchParams.get("order")).toBe("transaction(created_at).desc,id.desc");
    expect(url.searchParams.get("offset")).toBe("10");
    expect(url.searchParams.get("transaction.transaction_type")).toBe("eq.transfer");
    expect(url.searchParams.get("transaction.warehouse_id")).toBe(`eq.${warehouseId}`);
    expect(url.searchParams.get("item_id")).toBe(`eq.${itemId}`);
    expect(url.searchParams.getAll("transaction.transaction_date")).toEqual([
      "gte.2026-10-01",
      "lte.2026-10-31",
    ]);
    expect(url.searchParams.get("or")).toContain(`item_id.in.(${itemId})`);
  });

  it.each([
    { params: "", message: "Failed to fetch transactions" },
    { params: "search=item", message: "Failed to search items" },
  ])("keeps database failures private for $params", async ({ params, message }) => {
    mocks.fetch.mockResolvedValueOnce(
      Response.json({ code: "XX000", message: "private SQL details" }, { status: 500 })
    );

    const response = await GET(
      new NextRequest(`http://localhost/api/stock-transactions?${params}`)
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: message });
    expect(console.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ message: "private SQL details" })
    );
  });
});

describe("transactional Move Stock API", () => {
  it.each([destinationWarehouseId, warehouseId])(
    "moves to %s through exactly one transaction",
    async (toWarehouseId) => {
      const response = await POST(request({ ...payload, toWarehouseId }));
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({ id: "move", transactionCode: "ST-000000001" });
      expect(mocks.permission).toHaveBeenCalledWith("stock_transactions", "create");
      expect(mocks.permission).toHaveBeenCalledWith("transfer_between_locations", "create");
      expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("move_stock_transactionally", {
        p_business_unit_id: businessUnitId,
        p_item_id: payload.items[0].itemId,
        p_source_warehouse_id: warehouseId,
        p_destination_warehouse_id: toWarehouseId,
        p_from_location_id: payload.fromLocationId,
        p_to_location_id: payload.toLocationId,
        p_quantity: 3.25,
        p_batch_selection_mode: "exclude",
        p_batch_location_ids: [],
        p_transaction_date: payload.transactionDate,
      });
      expect(mocks.from).not.toHaveBeenCalled();
    }
  );

  it.each(selectiveMoves)(
    "moves the requested quantity through one RPC for $mode mode with explicit batch IDs",
    async (selection) => {
      const response = await POST(request(withBatchSelection(selection)));
      expect(response.status).toBe(201);
      expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(
        "move_stock_transactionally",
        expect.objectContaining({
          p_batch_selection_mode: selection.mode,
          p_batch_location_ids: selection.batchLocationIds,
          p_quantity: 3.25,
        })
      );
      expect(mocks.from).not.toHaveBeenCalled();
    }
  );

  it.each([
    { ...payload, items: [{ ...payload.items[0], quantity: -1 }] },
    { ...payload, items: [{ ...payload.items[0], quantity: 0.001 }] },
    { ...payload, items: [{ ...payload.items[0], quantity: 1_000_000_001 }] },
    {
      ...payload,
      items: [{ itemId: payload.items[0].itemId, quantity: 3.25, batchLocationId: null }],
    },
    { ...payload, items: [{ itemId: payload.items[0].itemId, quantity: 3.25 }] },
    { ...payload, items: [payload.items[0], payload.items[0]] },
    { ...payload, items: [{ ...payload.items[0], unitCost: 5 }] },
    { ...payload, fromLocationId: payload.toLocationId },
    { ...payload, transactionDate: "2026-02-30" },
    { ...payload, toWarehouseId: "invalid" },
    { ...payload, businessUnitId: "forged" },
  ])("rejects invalid or identity-bearing payloads before writing: %j", async (body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "STOCK_MOVE_DETAILS_INVALID" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it.each([
    { name: "null selection", selection: null },
    { name: "invalid mode", selection: { mode: "all", batchLocationIds: [] } },
    { name: "empty include list", selection: { mode: "include", batchLocationIds: [] } },
    { name: "null batch list", selection: { mode: "exclude", batchLocationIds: null } },
    { name: "null batch ID", selection: { mode: "include", batchLocationIds: [null] } },
    { name: "invalid batch ID", selection: { mode: "exclude", batchLocationIds: ["invalid"] } },
    {
      name: "duplicate UUIDs with different casing",
      selection: {
        mode: "include",
        batchLocationIds: [batchLocationIds[0], batchLocationIds[0].toUpperCase()],
      },
    },
    {
      name: "oversized selection",
      selection: { mode: "exclude", batchLocationIds: [...maximumSelection, batchLocationIds[0]] },
    },
    {
      name: "unexpected nested field",
      selection: { mode: "exclude", batchLocationIds: [], warehouseId },
    },
  ])("rejects $name before writing", async ({ selection }) => {
    const response = await POST(
      request({ ...payload, items: [{ ...payload.items[0], batchSelection: selection }] })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "STOCK_MOVE_DETAILS_INVALID" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns recovery guidance when an included batch is no longer at the source", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "STOCK_MOVE_BATCH_UNAVAILABLE", details: "private database detail" },
    });
    const response = await POST(request(withBatchSelection({ mode: "include", batchLocationIds })));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: "STOCK_MOVE_BATCH_UNAVAILABLE",
      error:
        "One or more selected batches are no longer available at the source location. Refresh the batch list and update your selection.",
    });
  });

  it.each(["stock_transactions", "transfer_between_locations"])(
    "enforces %s create access",
    async (resource) => {
      mocks.permission.mockImplementation(async (value: string) =>
        value === resource ? NextResponse.json({ error: "Forbidden" }, { status: 403 }) : null
      );
      const response = await POST(request(payload));
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "STOCK_MOVE_FORBIDDEN" });
      expect(mocks.rpc).not.toHaveBeenCalled();
    }
  );

  it("returns a stable authentication error", async () => {
    mocks.permission.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const response = await POST(request(payload));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "STOCK_MOVE_UNAUTHORIZED" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("requires a business unit before moving", async () => {
    mocks.context.mockResolvedValue({ currentBusinessUnitId: null });
    const response = await POST(request(payload));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "STOCK_MOVE_CONTEXT_INVALID" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["STOCK_MOVE_INSUFFICIENT_STOCK", 409],
    ["STOCK_MOVE_BATCH_CONFLICT", 409],
    ["STOCK_MOVE_WAREHOUSE_INVALID", 400],
  ])("maps %s to safe, actionable guidance", async (code, status) => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: code, details: "private database detail" },
    });
    const response = await POST(request(payload));
    expect(response.status).toBe(status);
    const body = await response.json();
    expect(body.code).toBe(code);
    expect(body.error).not.toContain("private");
    expect(body).not.toHaveProperty("details");
  });

  it("keeps unexpected backend failures private", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "secret constraint SQL failure" },
    });
    const response = await POST(request(payload));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      code: "STOCK_MOVE_FAILED",
      error: "Stock could not be moved. Refresh stock levels before trying again.",
    });
  });
});
