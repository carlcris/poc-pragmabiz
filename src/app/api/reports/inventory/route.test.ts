import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { Database } from "@/types/database.types";
import { GET } from "./route";

const state = vi.hoisted(() => ({
  permission: vi.fn(),
  context: vi.fn(),
  fetch: vi.fn<typeof fetch>(),
}));
vi.mock("@/lib/auth", () => ({ requirePermission: state.permission }));
vi.mock("@/lib/supabase/server-with-bu", () => ({
  createServerClientWithBU: state.context,
}));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: <T>(handler: T) => handler,
}));

const itemId = "5c9fe57e-ecad-461a-8f29-b719596ca84d";
const categoryId = "7a2b5efe-363f-463b-81da-e65329971153";
const warehouseId = "aff61bdd-5ebe-4d13-9163-484dbcc245d6";
const request = (params: Record<string, string> = {}) =>
  GET(new NextRequest("http://localhost/api/reports/inventory?" + new URLSearchParams(params)));

const inventoryRequests = () =>
  state.fetch.mock.calls.flatMap(([input, options]) => {
    const url = new URL(input instanceof Request ? input.url : input);
    return url.pathname === "/rest/v1/item_warehouse"
      ? [{ method: options?.method, params: url.searchParams }]
      : [];
  });

beforeEach(() => {
  vi.resetAllMocks();
  state.permission.mockResolvedValue(null);
  const client = createClient<Database>("http://localhost", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: state.fetch },
  });
  state.context.mockResolvedValue({
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: "user" } }, error: null }) },
      from: client.from.bind(client),
    },
  });
});

it("applies the selected item, warehouse, category, status, and search to the PDF count and rows", async () => {
  state.fetch
    .mockResolvedValueOnce(Response.json({ company_id: "company" }))
    .mockResolvedValueOnce(new Response(null, { headers: { "content-range": "0-0/1" } }))
    .mockResolvedValueOnce(
      Response.json([
        {
          id: "stock-row",
          item_id: itemId,
          warehouse_id: warehouseId,
          current_stock: 4,
          reserved_stock: 2,
          available_stock: 2,
        },
      ])
    );

  const response = await request({
    itemId,
    warehouseId,
    category: categoryId,
    stockStatus: "available",
    search: "glass",
    exportMode: "pdf",
    limit: "999",
    sortBy: "current_stock",
    sortOrder: "asc",
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    data: [{ itemId, warehouseId }],
    summary: { rowCount: 1, pageQtyOnHand: 4 },
    pagination: { total: 1, limit: 500 },
    filters: { itemId, warehouseId, category: categoryId, search: "glass" },
  });

  const requests = inventoryRequests();
  expect(requests.map(({ method }) => method)).toEqual(["HEAD", "GET"]);
  for (const { params } of requests) {
    expect(Object.fromEntries(params)).toMatchObject({
      company_id: "eq.company",
      deleted_at: "is.null",
      is_active: "eq.true",
      item_id: "eq." + itemId,
      warehouse_id: "eq." + warehouseId,
      "item.category_id": "eq." + categoryId,
      available_stock: "gt.0",
      "item.or": "(item_code.ilike.%glass%,item_name.ilike.%glass%)",
    });
  }
  expect(requests[1].params.get("order")).toBe("current_stock.asc,id.asc");
  expect(requests[1].params.get("limit")).toBe("500");
});

it("leaves the report unfiltered by item when itemId is omitted", async () => {
  state.fetch
    .mockResolvedValueOnce(Response.json({ company_id: "company" }))
    .mockResolvedValueOnce(new Response(null, { headers: { "content-range": "*/0" } }))
    .mockResolvedValueOnce(Response.json([]));

  const response = await request();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: [], filters: { itemId: null } });
  expect(inventoryRequests().map(({ params }) => params.get("item_id"))).toEqual([null, null]);
});

it.each(["bad", ""])("rejects an invalid item ID (%s) before querying inventory", async (id) => {
  const response = await request({ itemId: id });

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "Invalid inventory item filter" });
  expect(state.context).not.toHaveBeenCalled();
  expect(state.fetch).not.toHaveBeenCalled();
});

it("requires Reports view permission before reading inventory", async () => {
  state.permission.mockResolvedValue(NextResponse.json({}, { status: 403 }));

  expect((await request({ itemId })).status).toBe(403);
  expect(state.permission).toHaveBeenCalledExactlyOnceWith("reports", "view");
  expect(state.context).not.toHaveBeenCalled();
});
