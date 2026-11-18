import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/types/database.types";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  permission: vi.fn(),
  fetch: vi.fn<typeof fetch>(),
}));

vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: (handler: unknown) => handler,
}));
vi.mock("@/lib/auth/checkPermission", () => ({ checkPermissionForUser: mocks.permission }));
vi.mock("@/lib/auth/requestContext", () => ({ requireRequestContext: mocks.context }));

const companyId = "10000000-0000-4000-8000-000000000001";
const currentBusinessUnitId = "10000000-0000-4000-8000-000000000002";
const userId = "10000000-0000-4000-8000-000000000003";
const itemId = "10000000-0000-4000-8000-000000000004";
const warehouseId = "10000000-0000-4000-8000-000000000005";
const locationId = "10000000-0000-4000-8000-000000000006";
const firstBatchId = "10000000-0000-4000-8000-00000000000a";
const secondBatchId = "10000000-0000-4000-8000-00000000000b";
const availabilityParams = { view: "availability", selectionMode: "exclude" };
const invalidLookupParams: Record<string, string>[] = [
  { locationId: "wrong" },
  { page: "0" },
  { search: "a".repeat(151) },
];

const request = (params?: Record<string, string>) =>
  new NextRequest(
    `http://localhost/api/lookups/stock-move-batches?${new URLSearchParams({
      itemId,
      warehouseId,
      locationId,
      ...params,
    })}`
  );

beforeEach(() => {
  vi.resetAllMocks();
  const supabase = createClient<Database>("http://localhost:54321", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: mocks.fetch },
  });
  mocks.context.mockResolvedValue({ supabase, companyId, currentBusinessUnitId, userId });
  mocks.permission.mockResolvedValue(true);
});

describe("Move Stock source availability", () => {
  it("returns the RPC's movable balance for Select All", async () => {
    mocks.fetch.mockResolvedValueOnce(Response.json({ available_quantity: 13, named_batches: [] }));

    const response = await GET(request(availabilityParams));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ availableQuantity: 13, namedBatches: [] });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);

    const [input, init] = mocks.fetch.mock.calls[0];
    const url = new URL(String(input));
    expect(url.pathname).toBe("/rest/v1/rpc/get_stock_move_source_availability");
    expect(JSON.parse(String(init?.body))).toEqual({
      p_business_unit_id: currentBusinessUnitId,
      p_item_id: itemId,
      p_source_warehouse_id: warehouseId,
      p_from_location_id: locationId,
      p_batch_selection_mode: "exclude",
      p_batch_location_ids: [],
    });
  });

  it.each(["include", "exclude"])(
    "refreshes explicitly named IDs in %s mode without a page filter",
    async (selectionMode) => {
      mocks.fetch.mockResolvedValueOnce(
        Response.json({
          available_quantity: 5,
          named_batches: [{ id: firstBatchId, qtyAvailable: 5 }],
        })
      );

      const response = await GET(
        request({
          view: "availability",
          selectionMode,
          batchLocationIds: `${firstBatchId.toUpperCase()},${secondBatchId}`,
        })
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        availableQuantity: 5,
        namedBatches: [{ id: firstBatchId, qtyAvailable: 5 }],
      });
      const [, init] = mocks.fetch.mock.calls[0];
      expect(JSON.parse(String(init?.body))).toMatchObject({
        p_batch_selection_mode: selectionMode,
        p_batch_location_ids: [firstBatchId, secondBatchId],
      });
    }
  );

  it.each([
    { page: "2" },
    { search: "batch" },
    { selectionMode: "invalid" },
    { batchLocationIds: "bad-id" },
    { batchLocationIds: `${firstBatchId},${firstBatchId.toUpperCase()}` },
    {
      batchLocationIds: Array.from(
        { length: 101 },
        (_, index) => `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`
      ).join(","),
    },
  ] as Record<string, string>[])(
    "rejects invalid or excessive availability inputs",
    async (params) => {
      expect((await GET(request({ ...availabilityParams, ...params }))).status).toBe(400);
      expect(mocks.fetch).not.toHaveBeenCalled();
    }
  );

  it("requires transfer permission before calling the availability RPC", async () => {
    mocks.permission.mockImplementation(
      async (_actor, resource) => resource === "stock_transactions"
    );

    expect((await GET(request(availabilityParams))).status).toBe(403);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it.each([
    { code: "42501", status: 403, safeMessage: "You do not have permission to move stock" },
    { code: "22023", status: 400, safeMessage: "Invalid stock move batch lookup" },
    { code: "XX000", status: 500, safeMessage: "Failed to load available batches" },
  ])("maps RPC error $code to a safe response", async ({ code, status, safeMessage }) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.fetch.mockResolvedValueOnce(
      Response.json({ code, message: "private SQL detail" }, { status })
    );

    try {
      const response = await GET(request(availabilityParams));
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error: safeMessage });
    } finally {
      log.mockRestore();
    }
  });
});

describe("Move Stock batch lookup", () => {
  it.each(["stock_transactions", "transfer_between_locations"])(
    "denies the lookup without %s create access",
    async (deniedResource) => {
      mocks.permission.mockImplementation(async (_actor, resource, action) =>
        Boolean(resource !== deniedResource && action === "create")
      );

      expect((await GET(request())).status).toBe(403);
      expect(mocks.fetch).not.toHaveBeenCalled();
    }
  );

  it("denies unauthenticated callers and callers without a current business unit", async () => {
    mocks.context.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    mocks.context.mockResolvedValueOnce({ companyId, currentBusinessUnitId: null, userId });

    expect((await GET(request())).status).toBe(401);
    expect((await GET(request())).status).toBe(400);
    expect(mocks.permission).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it.each(invalidLookupParams)(
    "rejects invalid lookup parameters before reading stock: %j",
    async (params) => {
      expect((await GET(request(params))).status).toBe(400);
      expect(mocks.fetch).not.toHaveBeenCalled();
    }
  );

  it("returns up to five eligible placements and detects a subsequent page", async () => {
    mocks.fetch.mockResolvedValueOnce(
      Response.json(
        Array.from({ length: 6 }, (_, index) => ({
          id: `placement-${index + 1}`,
          qty_available: 8,
          batch: { batch_code: `Batch #${index + 1}`, qty_available: 7 },
        }))
      )
    );

    const response = await GET(request());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveLength(5);
    expect(body.data[0]).toEqual({ id: "placement-1", batchCode: "Batch #1", qtyAvailable: 7 });
    expect(body.hasMore).toBe(true);

    const [input] = mocks.fetch.mock.calls[0];
    const url = new URL(String(input));
    expect(url.pathname).toBe("/rest/v1/item_batch_locations");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      company_id: `eq.${companyId}`,
      item_id: `eq.${itemId}`,
      warehouse_id: `eq.${warehouseId}`,
      location_id: `eq.${locationId}`,
      deleted_at: "is.null",
      qty_available: "gt.0",
      "batch.qty_available": "gt.0",
      "batch.deleted_at": "is.null",
      "location.is_active": "eq.true",
      "location.is_storable": "eq.true",
      "warehouse.is_active": "eq.true",
      "warehouse.business_unit_id": `eq.${currentBusinessUnitId}`,
      "warehouse.unit.is_active": "eq.true",
      "warehouse.unit.access.user_id": `eq.${userId}`,
      "warehouse.unit.access.actor.company_id": `eq.${companyId}`,
      "warehouse.unit.access.actor.is_active": "eq.true",
      "warehouse.unit.access.actor.deleted_at": "is.null",
      order: "batch(batch_code).asc,id.asc",
      offset: "0",
      limit: "6",
    });
  });

  it("searches for literal batch-code text on later pages", async () => {
    mocks.fetch.mockResolvedValueOnce(Response.json([]));
    const response = await GET(request({ page: "2", search: "  R*,_%.  " }));
    expect(await response.json()).toEqual({ data: [], hasMore: false });

    const [input] = mocks.fetch.mock.calls[0];
    const { searchParams } = new URL(String(input));
    expect(searchParams.get("offset")).toBe("5");
    expect(searchParams.get("batch.batch_code")).toBe(String.raw`imatch.R\*,_%\.`);
  });

  it("keeps database lookup errors private", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.fetch.mockResolvedValueOnce(
      Response.json({ message: "private SQL detail" }, { status: 500 })
    );

    try {
      const response = await GET(request());
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "Failed to load available batches" });
    } finally {
      log.mockRestore();
    }
  });
});
