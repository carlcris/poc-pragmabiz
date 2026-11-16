import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  permission: vi.fn(),
  header: vi.fn(),
  paths: vi.fn(),
}));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: (handler: unknown) => handler,
}));
vi.mock("@/lib/auth", () => ({ requirePermission: vi.fn().mockResolvedValue(null) }));
vi.mock("../../_lib", () => ({
  getPickListAuthContext: async () => ({
    supabase: { rpc: mocks.rpc },
    companyId: "company",
    userId: "actor",
  }),
  fetchPickListHeader: mocks.header,
  ensurePickListActorAuthorized: mocks.permission,
}));
vi.mock("@/lib/warehouse-location-name-path", () => ({
  fetchWarehouseLocationNamePaths: mocks.paths,
}));
import { GET } from "./route";
const id = "11111111-1111-4111-8111-111111111111";
const itemId = "22222222-2222-4222-8222-222222222222";
const locationId = "33333333-3333-4333-8333-333333333333";
const source = {
  batch_location_sku: "1234567890",
  warehouse_id: "warehouse",
  warehouse_name: "Warehouse",
  location_id: locationId,
  location_code: "L1",
  location_name: "Location 1",
  location_path_ids: [locationId],
  batch_received_at: "2026-11-16T00:00:00Z",
  qty_on_hand: 10,
  available_base_qty: "4.50",
  pick_list_item_id: "line",
  delivery_note_item_id: "dn-line",
  allocated_qty: 5,
  picked_qty: 0,
  remaining_base_qty: 5,
  max_pick_qty: "4.50",
  is_suggested: true,
};
const request = (query = `itemId=${itemId}&batchCode=BATCH-A`) =>
  GET(new NextRequest(`http://localhost/api/pick-lists/${id}/scan-source?${query}`), {
    params: Promise.resolve({ id }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.permission.mockResolvedValue({ ok: true });
  mocks.header.mockResolvedValue({ status: "in_progress", business_unit_id: "bu" });
  mocks.paths.mockResolvedValue({ data: new Map([[locationId, "Rack / Bin"]]), error: null });
  mocks.rpc.mockResolvedValue({ data: [source], error: null });
});
describe("item-batch picking source contract", () => {
  it("resolves a single source with both physical stock and effective pick capacity", async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({
      kind: "resolved",
      resolution: {
        batchLocationSku: "1234567890",
        source: { itemId, locationId, batchCode: "BATCH-A", qtyOnHand: 10, availableBaseQty: 4.5 },
        line: { pickListItemId: "line", remainingQty: 5, remainingBaseQty: 5, maxPickQty: 4.5 },
        isMismatch: false,
      },
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "get_pick_item_batch_sources",
      expect.objectContaining({ p_item_id: itemId, p_batch_code: "BATCH-A", p_page: 1 })
    );
  });
  it("requires choice even when one of multiple locations is suggested", async () => {
    mocks.rpc.mockResolvedValue({
      data: [source, { ...source, location_id: "other", is_suggested: false }],
      error: null,
    });
    const data = (await (await request()).json()).data;
    expect(data.kind).toBe("choose_location");
    expect(data.sources).toHaveLength(2);
    expect(data.hasMore).toBe(false);
  });
  it("returns matched demand and pick capacity in the appropriate units for each choice", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          ...source,
          qty_on_hand: 300,
          available_base_qty: "288.00",
          remaining_base_qty: 720,
          max_pick_qty: "2.00",
        },
        {
          ...source,
          location_id: "other",
          pick_list_item_id: "other-line",
          allocated_qty: 8,
          picked_qty: 2,
          available_base_qty: "9.25",
          remaining_base_qty: 6,
          max_pick_qty: "6.00",
          is_suggested: false,
        },
      ],
      error: null,
    });

    const data = (await (await request()).json()).data;
    expect(data.kind).toBe("choose_location");
    expect(data.sources).toMatchObject([
      {
        source: { qtyOnHand: 300, availableBaseQty: 288 },
        line: { pickListItemId: "line", remainingQty: 5, remainingBaseQty: 720, maxPickQty: 2 },
      },
      {
        source: { qtyOnHand: 10, availableBaseQty: 9.25 },
        line: { pickListItemId: "other-line", remainingQty: 6, remainingBaseQty: 6, maxPickQty: 6 },
      },
    ]);
  });
  it("shows only three choices with server pagination", async () => {
    mocks.rpc.mockResolvedValue({ data: Array.from({ length: 4 }, () => source), error: null });
    const data = (await (await request()).json()).data;
    expect(data.sources).toHaveLength(3);
    expect(data.hasMore).toBe(true);
  });
  it("reports no more pages when exactly three choices remain", async () => {
    mocks.rpc.mockResolvedValue({ data: Array.from({ length: 3 }, () => source), error: null });
    const data = (await (await request()).json()).data;
    expect(data.sources).toHaveLength(3);
    expect(data.hasMore).toBe(false);
  });
  it("does not silently select the last option on a later page", async () => {
    const data = (await (await request(`itemId=${itemId}&batchCode=BATCH-A&page=2`)).json()).data;
    expect(data.kind).toBe("choose_location");
    expect(data.page).toBe(2);
  });
  it("revalidates an explicit location against the scanned item and batch", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ ...source, available_base_qty: "2.50", max_pick_qty: "2.50" }],
      error: null,
    });
    const data = (
      await (await request(`itemId=${itemId}&batchCode=BATCH-A&locationId=${locationId}`)).json()
    ).data;
    expect(data).toMatchObject({
      kind: "resolved",
      resolution: { source: { availableBaseQty: 2.5 }, line: { maxPickQty: 2.5 } },
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "get_pick_item_batch_sources",
      expect.objectContaining({ p_location_id: locationId })
    );
  });
  it.each([
    `itemId=${itemId}&batchCode=BATCH-A`,
    `itemId=${itemId}&batchCode=BATCH-A&locationId=${locationId}`,
  ])("returns an actionable conflict when the RPC has no eligible stock (%s)", async (query) => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    const response = await request(query);
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("PICK_SOURCE_UNAVAILABLE");
  });
  it.each([
    "batchLocationSku=1234567890",
    `itemId=${itemId}&batchCode=A&page=0`,
    `itemId=${itemId}&batchCode=A&page=10001`,
  ])("rejects invalid or old contracts: %s", async (query) => {
    expect((await request(query)).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("enforces actor access before looking up stock", async () => {
    mocks.permission.mockResolvedValue({ ok: false });
    expect((await request()).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("keeps unexpected database details out of responses", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "private SQL details" } });
    const response = await request();
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private SQL details");
    log.mockRestore();
  });
});
