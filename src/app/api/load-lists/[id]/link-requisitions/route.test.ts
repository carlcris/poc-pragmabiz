import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const mocks = vi.hoisted(() => ({
  permission: vi.fn(),
  operation: vi.fn(),
  context: vi.fn(),
  fetch: vi.fn<typeof fetch>(),
}));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: (handler: unknown) => handler,
}));
vi.mock("@/lib/auth", () => ({ requirePermission: mocks.permission }));
vi.mock("@/lib/auth/requestContext", () => ({ requireRequestContext: mocks.context }));
vi.mock("@/lib/load-lists/permissions", () => ({
  LOAD_LIST_LINK_STOCK_REQUISITIONS_CAPABILITY: "load_lists.operation.link_stock_requisitions.edit",
  requireLoadListOperation: mocks.operation,
}));

const loadListId = "11111111-1111-4111-8111-111111111111";
const lineId = "22222222-2222-4222-8222-222222222222";
const srLineId = "33333333-3333-4333-8333-333333333333";
const params = { params: Promise.resolve({ id: loadListId }) };
const post = () =>
  POST(
    new NextRequest(`http://localhost/api/load-lists/${loadListId}/link-requisitions`, {
      method: "POST",
      body: JSON.stringify({
        links: [{ loadListItemId: lineId, srItemId: srLineId, fulfilledQty: 20 }],
      }),
    }),
    params
  );

beforeEach(() => {
  vi.resetAllMocks();
  const supabase = createClient("http://localhost:54321", "test-key", {
    auth: { persistSession: false },
    global: { fetch: mocks.fetch },
  });
  mocks.permission.mockResolvedValue(null);
  mocks.operation.mockResolvedValue(null);
  mocks.context.mockResolvedValue({
    supabase,
    userId: "actor",
    companyId: "company",
    currentBusinessUnitId: "source",
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("load-list requisition pack links", () => {
  it("returns a stable actionable error for a cross-pack link", async () => {
    mocks.fetch.mockResolvedValueOnce(
      Response.json(
        {
          code: "P0001",
          message: "Load list and stock requisition items must reference the same pack option",
        },
        { status: 400 }
      )
    );
    const response = await post();
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "LOAD_LIST_LINK_PACK_MISMATCH" });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it("saves a matching pack allocation through the existing transactional RPC", async () => {
    mocks.fetch.mockResolvedValueOnce(Response.json(1));
    const response = await post();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      message: "Links created successfully",
      linksCreated: 1,
    });
    expect(String(mocks.fetch.mock.calls[0][0])).toContain(
      "/rpc/link_load_list_stock_requisitions"
    );
    expect(JSON.parse(String(mocks.fetch.mock.calls[0][1]?.body))).toMatchObject({
      p_load_list_id: loadListId,
      p_links: [{ load_list_item_id: lineId, sr_item_id: srLineId, fulfilled_qty: 20 }],
    });
  });

  it("returns unit context for saved links using explicit scoped projections", async () => {
    mocks.fetch
      .mockResolvedValueOnce(Response.json({ id: loadListId, status: "in_transit" }))
      .mockResolvedValueOnce(
        Response.json([
          {
            id: "link",
            fulfilled_qty: 20,
            load_list_item: {
              id: lineId,
              load_list_id: loadListId,
              load_list_qty: 50,
              item_unit_option_id: "pack-50",
              unit_name: "BOX (50)",
              qty_per_unit: 50,
              item: { id: "item", item_code: "PM057MR000", item_name: "Moulding" },
            },
            sr_item: {
              id: srLineId,
              item_unit_option_id: "pack-50",
              requested_qty: 50,
              fulfilled_qty: 20,
              item_unit_option: {
                option_label: "BOX (50)",
                qty_per_unit: 50,
                uom: { name: "Box" },
              },
              sr: {
                id: "requisition",
                sr_number: "SR-000000001",
                requisition_date: "2026-11-23",
                status: "partially_fulfilled",
              },
            },
          },
        ])
      );
    const response = await GET(
      new NextRequest(`http://localhost/api/load-lists/${loadListId}/link-requisitions`),
      params
    );
    expect(response.status).toBe(200);
    expect((await response.json()).data[0]).toMatchObject({
      loadListItem: { itemUnitOptionId: "pack-50", unitName: "BOX (50)", qtyPerUnit: 50 },
      srItem: { itemUnitOptionId: "pack-50", unitName: "BOX (50)", qtyPerUnit: 50 },
    });
    const firstQuery = new URL(String(mocks.fetch.mock.calls[0][0])).searchParams;
    expect(firstQuery.get("company_id")).toBe("eq.company");
    expect(firstQuery.get("business_unit_id")).toBe("eq.source");
    const projection = new URL(String(mocks.fetch.mock.calls[1][0])).searchParams.get("select");
    expect(projection).toContain(
      "item_unit_option:item_unit_options(option_label,qty_per_unit,uom:units_of_measure(name))"
    );
    expect(projection).not.toContain("*");
  });
});
