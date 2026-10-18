import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  authorize: vi.fn(),
  permission: vi.fn(),
  from: vi.fn(),
  signedUrl: vi.fn(),
}));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: (handler: unknown) => handler,
}));
vi.mock("@/lib/auth/checkPermission", () => ({ checkPermissionForUser: mocks.permission }));
vi.mock("@/app/api/pick-lists/_lib", () => ({
  getPickListAuthContext: mocks.auth,
  ensurePickListActorAuthorized: mocks.authorize,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mocks.from,
    storage: { from: () => ({ createSignedUrl: mocks.signedUrl }) },
  }),
}));

const rack = {
  warehouse_location_id: "second-floor-rack",
  x_basis_points: 100,
  y_basis_points: 100,
  width_basis_points: 500,
  height_basis_points: 500,
  warehouse_location: { code: "R2", name: "Second rack" },
};
const query = (data: unknown) => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue({ data: [rack], error: null }),
  maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
});
const pickQuery = query({
  suggested_pick_location_id: "second-floor-rack",
  pick_list: { business_unit_id: "bu", dn_id: "dn" },
});
const dnQuery = query({ fulfilling_warehouse_id: "warehouse" });
const locationQuery = query({ id: "second-floor-rack", code: "R2", name: "Second rack" });
const rackQuery = query({ floor_map_id: "second-floor-map" });
const mapQuery = query({
  id: "second-floor-map",
  floor_number: 2,
  name: "Upper floor",
  image_path: "floor2.png",
  image_width: 1000,
  image_height: 800,
  version: 1,
  warehouse: { id: "warehouse", warehouse_name: "Main", deleted_at: null },
});
const context = { params: Promise.resolve({ id: "pick", itemId: "line" }) };
const request = () =>
  new NextRequest("http://localhost/api/pick-lists/pick/items/line/location-map");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({
    userId: "actor",
    companyId: "company",
    currentBusinessUnitId: "bu",
    supabase: { from: mocks.from },
  });
  mocks.permission.mockResolvedValue(true);
  mocks.authorize.mockResolvedValue({ ok: true });
  mocks.from.mockImplementation(
    (table: string) =>
      ({
        pick_list_items: pickQuery,
        delivery_notes: dnQuery,
        warehouse_locations: locationQuery,
        warehouse_floor_map_racks: rackQuery,
        warehouse_floor_maps: mapQuery,
      })[table]
  );
  mocks.signedUrl.mockResolvedValue({ data: { signedUrl: "signed-floor2-image" }, error: null });
  rackQuery.maybeSingle.mockResolvedValue({
    data: { floor_map_id: "second-floor-map" },
    error: null,
  });
  mapQuery.limit.mockReturnValue(mapQuery);
  mapQuery.maybeSingle.mockResolvedValue({
    data: {
      id: "second-floor-map",
      floor_number: 2,
      name: "Upper floor",
      image_path: "floor2.png",
      image_width: 1000,
      image_height: 800,
      version: 1,
      warehouse: { id: "warehouse", warehouse_name: "Main", deleted_at: null },
    },
    error: null,
  });
});

describe("mobile picking across warehouse floors", () => {
  it("opens the mapped rack's floor and bounds its rack overlays", async () => {
    const response = await GET(request(), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: {
        map: { id: "second-floor-map", floorNumber: 2, name: "Upper floor" },
        location: { id: "second-floor-rack" },
        racks: [{ warehouseLocationId: "second-floor-rack" }],
      },
    });
    expect(rackQuery.eq).toHaveBeenCalledWith("warehouse_location_id", "second-floor-rack");
    expect(mapQuery.eq).toHaveBeenCalledWith("id", "second-floor-map");
    expect(mapQuery.eq).toHaveBeenCalledWith("warehouse_id", "warehouse");
    expect(rackQuery.eq).toHaveBeenCalledWith("floor_map_id", "second-floor-map");
    expect(rackQuery.limit).toHaveBeenCalledWith(500);
    expect(mocks.signedUrl).toHaveBeenCalledWith(
      "floor2.png",
      3600,
      expect.objectContaining({ transform: expect.objectContaining({ width: 2048 }) })
    );
  });
  it.each([true, false])(
    "preserves missing-map versus unmapped-rack states (configured=%s)",
    async (configured) => {
      rackQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
      mapQuery.maybeSingle.mockResolvedValue({
        data: configured ? { id: "floor1" } : null,
        error: null,
      });
      const response = await GET(request(), context);
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({
        code: configured ? "WAREHOUSE_RACK_NOT_MAPPED" : "WAREHOUSE_FLOOR_MAP_NOT_CONFIGURED",
      });
      expect(mapQuery.limit).toHaveBeenCalledWith(1);
      expect(mocks.signedUrl).not.toHaveBeenCalled();
    }
  );
  it("retains picker authorization before reading floor assets", async () => {
    mocks.authorize.mockResolvedValue({ ok: false });
    expect((await GET(request(), context)).status).toBe(403);
    expect(locationQuery.select).not.toHaveBeenCalled();
    expect(mocks.signedUrl).not.toHaveBeenCalled();
  });
});
