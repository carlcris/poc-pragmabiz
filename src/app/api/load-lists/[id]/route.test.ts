import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requireLoadListReceivingView: vi.fn(),
  requireRequestContext: vi.fn(),
  fetch: vi.fn<typeof fetch>(),
}));

vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: (handler: unknown) => handler,
}));
vi.mock("@/lib/auth", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/auth/requestContext", () => ({
  requireRequestContext: mocks.requireRequestContext,
}));
vi.mock("@/lib/receiving/permissions", () => ({
  requireLoadListReceivingView: mocks.requireLoadListReceivingView,
}));
vi.mock("@/lib/load-lists/permissions", () => ({
  resolveLoadListCapabilities: vi.fn(),
}));

const loadList = {
  id: "load-list",
  company_id: "company",
  business_unit_id: "source",
  destination_business_unit_id: "destination",
  currency: "PHP",
};
const item = {
  item_id: "shared-item",
  load_list_qty: 5,
  qty_per_unit: 1,
  unit_name: "Piece",
  unit_price: 10,
};

const get = (query = "") =>
  GET(new NextRequest(`http://localhost/api/load-lists/${loadList.id}${query}`), {
    params: Promise.resolve({ id: loadList.id }),
  });

beforeEach(() => {
  vi.resetAllMocks();
  const supabase = createClient("http://localhost:54321", "test-key", {
    auth: { persistSession: false },
    global: { fetch: mocks.fetch },
  });
  mocks.requirePermission.mockResolvedValue(null);
  mocks.requireLoadListReceivingView.mockResolvedValue(null);
  mocks.requireRequestContext.mockResolvedValue({
    supabase,
    userId: "user",
    companyId: loadList.company_id,
    currentBusinessUnitId: loadList.destination_business_unit_id,
  });
});

describe("Load List detail stock requisition links", () => {
  it("returns link status for the exact row with a saved link", async () => {
    mocks.fetch.mockResolvedValueOnce(
      Response.json({
        ...loadList,
        items: [
          { ...item, id: "linked-line", stock_requisition_links: [{ id: "saved-link" }] },
          { ...item, id: "unlinked-line", stock_requisition_links: [] },
        ],
      })
    );

    const response = await get();

    expect(response.status).toBe(200);
    expect(mocks.requirePermission).toHaveBeenCalledWith("load_lists", "view");
    const body = await response.json();
    expect(body.items).toMatchObject([
      { id: "linked-line", itemId: item.item_id, isLinkedToStockRequisition: true },
      { id: "unlinked-line", itemId: item.item_id, isLinkedToStockRequisition: false },
    ]);
    expect(body.items[0]).not.toHaveProperty("stock_requisition_links");
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    const query = new URL(String(mocks.fetch.mock.calls[0][0])).searchParams;
    expect(query.get("select")).toContain("stock_requisition_links:load_list_sr_items(id)");
    expect(query.get("items.stock_requisition_links.limit")).toBe("1");
    expect(query.get("id")).toBe(`eq.${loadList.id}`);
    expect(query.get("company_id")).toBe(`eq.${loadList.company_id}`);
  });

  it("omits stock requisition links from the receiving-only read", async () => {
    mocks.fetch.mockResolvedValueOnce(
      Response.json({ ...loadList, items: [{ ...item, id: "receiving-line" }] })
    );

    const response = await get("?receivingOnly=true");

    expect(response.status).toBe(200);
    expect(mocks.requireLoadListReceivingView).toHaveBeenCalledOnce();
    expect(mocks.requirePermission).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.items[0].id).toBe("receiving-line");
    expect(body.items[0]).not.toHaveProperty("isLinkedToStockRequisition");
    const query = new URL(String(mocks.fetch.mock.calls[0][0])).searchParams;
    expect(query.get("select")).not.toContain("load_list_sr_items");
    expect(query.has("items.stock_requisition_links.limit")).toBe(false);
  });
});
