import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ permission: vi.fn(), context: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: (handler: unknown) => handler,
}));
vi.mock("@/lib/auth/requestContext", () => ({ requireRequestContext: mocks.context }));
vi.mock("@/lib/load-lists/permissions", () => ({
  LOAD_LIST_LINK_STOCK_REQUISITIONS_CAPABILITY: "load_lists.operation.link_stock_requisitions.edit",
  requireLoadListOperation: mocks.permission,
}));

const lineId = "11111111-1111-4111-8111-111111111111";
const row = {
  sr_item_id: "requisition-line",
  sr_id: "requisition",
  sr_number: "SR-000000001",
  sr_status: "submitted",
  requisition_date: "2026-11-23",
  item_id: "item",
  item_code: "PM057MR000",
  item_name: "Moulding",
  item_unit_option_id: "pack-50",
  unit_name: "BOX (50)",
  qty_per_unit: 50,
  requested_qty: 50,
  fulfilled_qty: 20,
  outstanding_qty: 30,
  total_count: 1,
};
const get = (query = "") =>
  GET(
    new NextRequest(`http://localhost/api/load-lists/shipment/eligible-requisition-items${query}`),
    { params: Promise.resolve({ id: "shipment" }) }
  );

beforeEach(() => {
  vi.resetAllMocks();
  mocks.permission.mockResolvedValue(null);
  mocks.context.mockResolvedValue({
    supabase: { rpc: mocks.rpc },
    userId: "actor",
    companyId: "company",
    currentBusinessUnitId: "source",
  });
  mocks.rpc.mockResolvedValue({ data: [row], error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("pack-aware eligible requisition pagination", () => {
  it("passes the selected shipment line to SQL and returns pack context", async () => {
    const response = await get(`?loadListItemId=${lineId}&search=PM057&limit=5`);
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("list_eligible_load_list_requisition_items", {
      p_company_id: "company",
      p_business_unit_id: "source",
      p_user_id: "actor",
      p_load_list_id: "shipment",
      p_load_list_item_id: lineId,
      p_search: "PM057",
      p_page: 1,
      p_limit: 5,
    });
    const body = await response.json();
    expect(body.data).toEqual([
      expect.objectContaining({
        itemUnitOptionId: "pack-50",
        unitName: "BOX (50)",
        qtyPerUnit: 50,
        requestedQty: 50,
        outstandingQty: 30,
      }),
    ]);
    expect(body.pagination).toEqual({ total: 1, page: 1, limit: 5, totalPages: 1 });
  });

  it("retains the selected pack filter while clamping an empty later page", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [{ ...row, total_count: 7 }], error: null })
      .mockResolvedValueOnce({ data: [{ ...row, total_count: 7 }], error: null });
    const response = await get(`?loadListItemId=${lineId}&page=9&limit=5`);
    expect(response.status).toBe(200);
    expect(mocks.rpc.mock.calls.map((call) => call[1].p_page)).toEqual([9, 1, 2]);
    for (const call of mocks.rpc.mock.calls) expect(call[1].p_load_list_item_id).toBe(lineId);
    expect((await response.json()).pagination.page).toBe(2);
  });

  it.each(["?loadListItemId=bad-id", "?limit=51", "?page=0"])(
    "rejects invalid query %s before querying",
    async (query) => {
      expect((await get(query)).status).toBe(400);
      expect(mocks.rpc).not.toHaveBeenCalled();
    }
  );

  it("maps a foreign or removed selected shipment line to a safe missing response", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Load list item not found" } });
    const response = await get(`?loadListItemId=${lineId}`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Load list item not found" });
  });

  it("preserves the unselected browse request", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(mocks.rpc.mock.calls[0][1].p_load_list_item_id).toBeUndefined();
  });

  it("does not expose unexpected database details", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "private SQL error" } });
    const response = await get();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Failed to list eligible requisition items" });
  });
});
