import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const state = vi.hoisted(() => ({ context: vi.fn(), permission: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: <T>(handler: T) => handler,
}));
vi.mock("@/lib/auth", () => ({ requirePermission: state.permission }));
vi.mock("@/lib/auth/requestContext", () => ({ requireRequestContext: state.context }));
const item = "11111111-1111-4111-8111-111111111111";
const warehouse = "22222222-2222-4222-8222-222222222222";
const location = "33333333-3333-4333-8333-333333333333";
const batchQuery = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), limit: vi.fn() };
const locationQuery = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle: vi.fn() };
beforeEach(() => {
  vi.clearAllMocks();
  state.permission.mockResolvedValue(null);
  for (const method of Object.values(batchQuery)) method.mockReturnValue(batchQuery);
  batchQuery.limit.mockResolvedValue({ data: [{ id: "other-item-batch" }], error: null });
  for (const method of Object.values(locationQuery)) method.mockReturnValue(locationQuery);
  locationQuery.maybeSingle.mockResolvedValue({
    data: { id: location, code: "B", name: "Destination" },
    error: null,
  });
  state.rpc.mockResolvedValue({ data: [], error: null });
  state.context.mockResolvedValue({
    companyId: "company",
    currentBusinessUnitId: "bu",
    supabase: {
      from: (table: string) => (table === "item_batches" ? batchQuery : locationQuery),
      rpc: state.rpc,
    },
  });
});
const get = (extra = "") =>
  GET(
    new NextRequest(
      `http://localhost/api/inventory/batches?itemId=${item}&warehouseId=${warehouse}&locationId=${location}${extra}`
    )
  );
describe("warehouse batch code selector", () => {
  it.each([true, false])(
    "checks exact warehouse-wide existence without item or location filtering: %s",
    async (exists) => {
      batchQuery.limit.mockResolvedValue({
        data: exists ? [{ id: "other-item-batch" }] : [],
        error: null,
      });
      expect(await (await get("&exactBatchCode=Z10111")).json()).toEqual({ exists });
      expect(batchQuery.eq.mock.calls).toEqual([
        ["company_id", "company"],
        ["warehouse_id", warehouse],
        ["batch_code", "Z10111"],
      ]);
      expect(batchQuery.limit).toHaveBeenCalledWith(1);
      expect(state.rpc).not.toHaveBeenCalled();
    }
  );
  it("offers a code from another item with its original date and zero target stock", async () => {
    state.rpc.mockResolvedValue({
      data: [
        {
          item_batch_id: "source-item-batch",
          batch_code: "Z10111",
          received_at: "1999-01-01T12:34:56Z",
          item_batch_location_id: null,
          qty_on_hand: 0,
          qty_available: 0,
          qty_reserved: 0,
        },
      ],
      error: null,
    });
    expect((await (await get()).json()).data).toEqual([
      expect.objectContaining({
        itemId: item,
        itemBatchId: "source-item-batch",
        itemBatchLocationId: null,
        qtyOnHand: 0,
        receivedAt: "1999-01-01T12:34:56Z",
        locationId: location,
      }),
    ]);
    expect(state.rpc).toHaveBeenCalledWith("search_stock_adjustment_batches", {
      p_company_id: "company",
      p_item_id: item,
      p_warehouse_id: warehouse,
      p_location_id: location,
      p_search: "",
      p_limit: 5,
    });
    expect(locationQuery.eq).toHaveBeenCalledWith("warehouses.business_unit_id", "bu");
  });
  it("returns only the requested item's destination stock and QR identity", async () => {
    state.rpc.mockResolvedValue({
      data: [
        {
          item_batch_id: "target-item-batch",
          batch_code: "Z10111",
          received_at: "1999-01-01",
          item_batch_location_id: "target-location",
          batch_location_sku: "target-qr",
          qty_on_hand: 7,
          qty_available: 5,
          qty_reserved: 2,
        },
      ],
      error: null,
    });
    expect((await (await get()).json()).data[0]).toMatchObject({
      itemBatchId: "target-item-batch",
      itemBatchLocationId: "target-location",
      batchLocationSku: "target-qr",
      qtyOnHand: 7,
      qtyAvailable: 5,
      qtyReserved: 2,
    });
  });
  it("sends bounded search to the server", async () => {
    expect((await (await get("&search=Z10111&limit=10")).json()).data).toEqual([]);
    expect(state.rpc).toHaveBeenCalledWith(
      "search_stock_adjustment_batches",
      expect.objectContaining({ p_search: "Z10111", p_limit: 10 })
    );
  });
  it.each(["&limit=51", "&limit=0", "&itemId=invalid"])(
    "rejects invalid parameters %s",
    async (extra) => {
      expect((await get(extra)).status).toBe(400);
      expect(state.rpc).not.toHaveBeenCalled();
    }
  );
  it("rejects an unavailable destination", async () => {
    locationQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await get()).status).toBe(400);
    expect(state.rpc).not.toHaveBeenCalled();
  });
});
