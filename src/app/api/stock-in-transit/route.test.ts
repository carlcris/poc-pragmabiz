import { NextRequest, NextResponse } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";

const state = vi.hoisted(() => ({
  permission: vi.fn(),
  context: vi.fn(),
  rpc: vi.fn(),
  asOfDate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requirePermission: state.permission }));
vi.mock("@/lib/auth/requestContext", () => ({ requireRequestContext: state.context }));
vi.mock("@/lib/pricing/pricing-date", () => ({ getCurrentPricingDate: state.asOfDate }));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: <T>(handler: T) => handler,
}));

const request = (params: Record<string, string> = {}) =>
  GET(new NextRequest("http://localhost/api/stock-in-transit?" + new URLSearchParams(params)));

beforeEach(() => {
  vi.resetAllMocks();
  state.permission.mockResolvedValue(null);
  state.context.mockResolvedValue({
    companyId: "company",
    currentBusinessUnitId: "destination-bu",
    supabase: { rpc: state.rpc },
  });
  state.asOfDate.mockResolvedValue("2026-11-22");
  state.rpc.mockResolvedValue({ data: [], error: null });
});

const itemId = "11111111-1111-4111-8111-111111111111";
const itemArgs = {
  p_company_id: "company",
  p_as_of_date: "2026-11-22",
  p_search: null,
  p_page: 1,
  p_limit: 25,
};
const arrivalArgs = {
  p_company_id: "company",
  p_item_id: itemId,
  p_as_of_date: "2026-11-22",
  p_page: 1,
  p_limit: 25,
};

it("checks item permission before reading request context or stock", async () => {
  state.permission.mockResolvedValue(NextResponse.json({}, { status: 403 }));

  expect((await request({ view: "items" })).status).toBe(403);
  expect(state.permission).toHaveBeenCalledWith("items", "view");
  expect(state.context).not.toHaveBeenCalled();
  expect(state.rpc).not.toHaveBeenCalled();
});

it("scopes items to the authenticated company without a selected business unit", async () => {
  state.context.mockResolvedValue({
    companyId: "company",
    currentBusinessUnitId: null,
    supabase: { rpc: state.rpc },
  });

  const response = await request({ view: "items", companyId: "other-company" });

  expect(response.status).toBe(200);
  expect(state.asOfDate).toHaveBeenCalledWith({ rpc: state.rpc }, "company", null);
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith(
    "get_stock_in_transit_item_summary_page",
    itemArgs
  );
});

it("preserves distinct saved pack conversions in item totals with complete load-list counts", async () => {
  state.rpc.mockResolvedValue({
    data: [
      {
        item_id: "item-1",
        item_code: "ITEM-1",
        item_name: "Item one",
        base_unit_name: "Stick",
        total_base_quantity: "648",
        ordered_unit_totals: [
          { unit_name: "BOX", quantity: "2", qty_per_unit: 144 },
          { unit_name: "BOX", quantity: 5, qty_per_unit: 72 },
        ],
        shipment_count: "2",
        next_estimated_arrival_date: "2026-11-19",
        next_days_until_arrival: -3,
        next_arrival_window: "late",
        total_count: "3",
        load_list_count: "4",
        late_load_list_count: "1",
      },
    ],
    error: null,
  });

  const response = await request({
    view: "items",
    search: String.raw`  %ITEM_01\A  `,
    page: "2",
    limit: "1",
  });

  expect(response.status).toBe(200);
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith("get_stock_in_transit_item_summary_page", {
    ...itemArgs,
    p_search: String.raw`\%ITEM\_01\\A`,
    p_page: 2,
    p_limit: 1,
  });
  expect(await response.json()).toEqual({
    data: [
      {
        itemId: "item-1",
        itemCode: "ITEM-1",
        itemName: "Item one",
        baseUnitName: "Stick",
        totalBaseQuantity: 648,
        orderedUnitTotals: [
          { unitName: "BOX", quantity: 2, quantityPerUnit: 144 },
          { unitName: "BOX", quantity: 5, quantityPerUnit: 72 },
        ],
        shipmentCount: 2,
        nextEstimatedArrivalDate: "2026-11-19",
        nextDaysUntilArrival: -3,
        nextArrivalWindow: "late",
      },
    ],
    summary: { loadListCount: 4, lateLoadListCount: 1 },
    pagination: { page: 2, limit: 1, total: 3, totalPages: 3 },
  });
});

it("preserves distinct saved pack conversions in shipment, date, destination, and window totals", async () => {
  state.rpc.mockResolvedValue({
    data: [
      {
        load_list_id: "load-list-1",
        ll_number: "LL-001",
        supplier_name: "Supplier one",
        source_business_unit_id: "source-bu",
        destination_business_unit_id: "destination-bu",
        destination_business_unit_name: "Destination branch",
        estimated_arrival_date: "2026-11-27",
        days_until_arrival: 5,
        arrival_window: "next_7_days",
        liner_name: "Liner",
        container_number: "CONT-1",
        base_quantity: "200",
        ordered_unit_totals: [
          { unit_name: "Box", quantity: 8, qty_per_unit: 20 },
          { unit_name: "Box", quantity: 1, qty_per_unit: 40 },
        ],
        arrival_base_quantity: "680",
        arrival_ordered_unit_totals: [
          { unit_name: "Box", quantity: 30, qty_per_unit: 20 },
          { unit_name: "Box", quantity: 2, qty_per_unit: 40 },
        ],
        arrival_shipment_count: "4",
        arrival_container_count: "4",
        arrival_destination_totals: [
          {
            destination_business_unit_id: "destination-bu",
            destination_business_unit_name: "Destination branch",
            base_quantity: 680,
            ordered_unit_totals: [
              { unit_name: "Box", quantity: 30, qty_per_unit: 20 },
              { unit_name: "Box", quantity: 2, qty_per_unit: 40 },
            ],
          },
        ],
        late_base_quantity: "240",
        next_7_days_base_quantity: "680",
        days_8_to_14_base_quantity: "0",
        later_base_quantity: "120",
        no_eta_base_quantity: "0",
        arrival_window_ordered_unit_totals: {
          late: [{ unit_name: "Box", quantity: 12, qty_per_unit: 20 }],
          next_7_days: [
            { unit_name: "Box", quantity: 30, qty_per_unit: 20 },
            { unit_name: "Box", quantity: 2, qty_per_unit: 40 },
          ],
          later: [{ unit_name: "Each", quantity: 120, qty_per_unit: 1 }],
        },
        total_count: "6",
      },
    ],
    error: null,
  });

  const response = await request({ view: "arrivals", itemId });

  expect(response.status).toBe(200);
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith(
    "get_stock_in_transit_item_arrivals_page",
    arrivalArgs
  );
  expect(await response.json()).toEqual({
    data: [
      {
        loadListId: "load-list-1",
        loadListNumber: "LL-001",
        supplierName: "Supplier one",
        sourceBusinessUnitId: "source-bu",
        destinationBusinessUnitId: "destination-bu",
        destinationBusinessUnitName: "Destination branch",
        estimatedArrivalDate: "2026-11-27",
        daysUntilArrival: 5,
        arrivalWindow: "next_7_days",
        linerName: "Liner",
        containerNumber: "CONT-1",
        baseQuantity: 200,
        orderedUnitTotals: [
          { unitName: "Box", quantity: 8, quantityPerUnit: 20 },
          { unitName: "Box", quantity: 1, quantityPerUnit: 40 },
        ],
        arrivalBaseQuantity: 680,
        arrivalOrderedUnitTotals: [
          { unitName: "Box", quantity: 30, quantityPerUnit: 20 },
          { unitName: "Box", quantity: 2, quantityPerUnit: 40 },
        ],
        arrivalShipmentCount: 4,
        arrivalContainerCount: 4,
        arrivalDestinationTotals: [
          {
            destinationBusinessUnitId: "destination-bu",
            destinationBusinessUnitName: "Destination branch",
            baseQuantity: 680,
            orderedUnitTotals: [
              { unitName: "Box", quantity: 30, quantityPerUnit: 20 },
              { unitName: "Box", quantity: 2, quantityPerUnit: 40 },
            ],
          },
        ],
      },
    ],
    summary: {
      arrivalWindowTotals: {
        late: 240,
        next_7_days: 680,
        days_8_to_14: 0,
        later: 120,
        no_eta: 0,
      },
      arrivalWindowOrderedUnitTotals: {
        late: [{ unitName: "Box", quantity: 12, quantityPerUnit: 20 }],
        next_7_days: [
          { unitName: "Box", quantity: 30, quantityPerUnit: 20 },
          { unitName: "Box", quantity: 2, quantityPerUnit: 40 },
        ],
        days_8_to_14: [],
        later: [{ unitName: "Each", quantity: 120, quantityPerUnit: 1 }],
        no_eta: [],
      },
    },
    pagination: { page: 1, limit: 25, total: 6, totalPages: 1 },
  });
});

it.each<Record<string, string>>([{}, { view: "shipments" }, { view: "other" }])(
  "rejects an unsupported view for %o before fetching stock",
  async (params) => {
    expect((await request(params)).status).toBe(400);
    expect(state.rpc).not.toHaveBeenCalled();
  }
);

it.each<Record<string, string>>([{ view: "arrivals" }, { view: "arrivals", itemId: "not-a-uuid" }])(
  "rejects an invalid arrival item for %o",
  async (params) => {
    expect((await request(params)).status).toBe(400);
    expect(state.rpc).not.toHaveBeenCalled();
  }
);

it("caps page size at fifty rows", async () => {
  expect((await request({ view: "arrivals", itemId, limit: "100" })).status).toBe(200);
  expect(state.rpc).toHaveBeenCalledWith(
    "get_stock_in_transit_item_arrivals_page",
    expect.objectContaining({ p_limit: 50 })
  );
});

it.each([undefined, null, "144", 0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
  "rejects an invalid saved pack conversion %s without returning internal details",
  async (quantityPerUnit) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    state.rpc.mockResolvedValue({
      data: [
        {
          ordered_unit_totals: [{ unit_name: "BOX", quantity: 2, qty_per_unit: quantityPerUnit }],
        },
      ],
      error: null,
    });

    const response = await request({ view: "items" });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal server error" });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  }
);

it("keeps out-of-range page arguments inside the RPC integer range", async () => {
  expect((await request({ view: "items", page: "9007199254740992" })).status).toBe(200);
  expect(state.rpc).toHaveBeenCalledWith(
    "get_stock_in_transit_item_summary_page",
    expect.objectContaining({ p_page: 1 })
  );
});

it.each<Record<string, string>>([{ view: "items" }, { view: "arrivals", itemId }])(
  "logs internal failures and returns a safe error for %o",
  async (params) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    state.rpc.mockResolvedValue({ data: null, error: { message: "private database details" } });

    const response = await request(params);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Failed to fetch stock in transit" });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  }
);
