import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "./route";
import { GET as getFloor, PUT as saveFloor } from "../floor-map/route";

const mocks = vi.hoisted(() => ({
  permission: vi.fn(),
  allPermissions: vi.fn(),
  capability: vi.fn(),
  scope: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  signedUrl: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: (handler: unknown) => handler,
}));
vi.mock("@/lib/auth", () => ({
  requirePermission: mocks.permission,
  requireAllPermissions: mocks.allPermissions,
}));
vi.mock("@/services/warehouse-floor-map-service", () => ({ getScopedWarehouse: mocks.scope }));
vi.mock("@/services/permissions/permissionResolver", () => ({
  canAccessCapability: mocks.capability,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mocks.from,
    storage: {
      from: () => ({
        createSignedUrl: mocks.signedUrl,
        upload: mocks.upload,
        remove: mocks.remove,
      }),
    },
  }),
}));

const warehouseId = "10000000-0000-4000-8000-000000000001";
const context = { params: Promise.resolve({ id: warehouseId }) };
const map = {
  id: "map",
  warehouse_id: warehouseId,
  floor_number: 2,
  name: "Second floor",
  image_path: "second.png",
  image_width: 1000,
  image_height: 800,
  version: 1,
};
const result = { data: [map] as unknown, error: null as { message: string } | null, count: 8 };
const listQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  ilike: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  then: (resolve: (value: typeof result) => unknown) => Promise.resolve(resolve(result)),
};
const mapQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(),
};
const rackQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn(),
};
const listRequest = (query = "") =>
  new NextRequest(`http://localhost/api/warehouses/${warehouseId}/floor-maps${query}`);
const saveRequest = (fields: Record<string, string> = {}, file?: File) => {
  const body = new FormData();
  Object.entries({
    floorNumber: "2",
    expectedVersion: "1",
    name: "Second floor",
    imageWidth: "1000",
    imageHeight: "800",
    racks: "[]",
    ...fields,
  }).forEach(([key, value]) => body.set(key, value));
  if (file) body.set("file", file);
  return new NextRequest(`http://localhost/api/warehouses/${warehouseId}/floor-map`, {
    method: "PUT",
    body,
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.permission.mockResolvedValue(null);
  mocks.allPermissions.mockResolvedValue(null);
  mocks.capability.mockResolvedValue(true);
  mocks.scope.mockResolvedValue({
    userId: "actor",
    companyId: "company",
    currentBusinessUnitId: "bu",
    supabase: { rpc: mocks.rpc },
  });
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.from.mockReturnValue(listQuery);
  mocks.signedUrl.mockResolvedValue({ data: { signedUrl: "signed-floor-image" }, error: null });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  result.data = [map];
  result.error = null;
  result.count = 8;
  mapQuery.maybeSingle.mockResolvedValue({ data: map, error: null });
  rackQuery.limit.mockResolvedValue({ data: [], error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("warehouse floor search", () => {
  it("returns five initial results with deterministic server ordering", async () => {
    const response = await GET(listRequest(), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [{ id: "map", floorNumber: 2, name: "Second floor" }],
      pagination: { page: 1, limit: 5, total: 8, totalPages: 2 },
    });
    expect(listQuery.eq).toHaveBeenCalledWith("company_id", "company");
    expect(listQuery.eq).toHaveBeenCalledWith("warehouse_id", warehouseId);
    expect(listQuery.range).toHaveBeenCalledWith(0, 4);
    expect(listQuery.order).toHaveBeenCalledWith("floor_number", { ascending: true });
  });
  it("uses bounded later pages", async () => {
    await GET(listRequest("?page=2&limit=5"), context);
    expect(listQuery.range).toHaveBeenCalledWith(5, 9);
  });
  it("searches names and floor numbers on the server", async () => {
    await GET(listRequest("?search=Second"), context);
    expect(listQuery.ilike).toHaveBeenCalledWith("name", "%Second%");
    await GET(listRequest("?search=2"), context);
    expect(listQuery.or).toHaveBeenCalledWith("floor_number.eq.2,name.ilike.%2%");
  });
  it.each(["?limit=51", "?limit=0", "?page=0", "?page=1.5", "?search=" + "x".repeat(121)])(
    "rejects invalid search params %s",
    async (query) => {
      expect((await GET(listRequest(query), context)).status).toBe(400);
      expect(mocks.from).not.toHaveBeenCalled();
    }
  );
  it("returns an empty bounded page", async () => {
    result.data = [];
    result.count = 0;
    expect(await (await GET(listRequest(), context)).json()).toMatchObject({
      data: [],
      pagination: { total: 0, totalPages: 0 },
    });
  });
  it("rejects denied permissions and inactive or other-BU warehouses before admin reads", async () => {
    mocks.permission.mockResolvedValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
    expect((await GET(listRequest(), context)).status).toBe(403);
    mocks.permission.mockResolvedValue(null);
    mocks.scope.mockResolvedValue(null);
    expect((await GET(listRequest(), context)).status).toBe(404);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("keeps database failures safe", async () => {
    result.error = { message: "private SQL details" };
    const response = await GET(listRequest(), context);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("private SQL details");
  });
});

describe("floor-specific map reads and saves", () => {
  beforeEach(() =>
    mocks.from.mockImplementation((table: string) =>
      table === "warehouse_floor_maps" ? mapQuery : rackQuery
    )
  );
  it("reads only the requested floor", async () => {
    const response = await getFloor(
      new NextRequest("http://localhost/floor-map?floorNumber=2"),
      context
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { floorNumber: 2, name: "Second floor" } });
    expect(mapQuery.eq).toHaveBeenCalledWith("floor_number", 2);
  });
  it.each(["", "?floorNumber=0", "?floorNumber=1.5", "?floorNumber=2147483648"])(
    "rejects missing/invalid floor identifiers %s",
    async (query) => {
      expect(
        (await getFloor(new NextRequest(`http://localhost/floor-map${query}`), context)).status
      ).toBe(400);
      expect(mocks.from).not.toHaveBeenCalled();
    }
  );
  it("saves one floor through one version-checked database operation", async () => {
    const response = await saveFloor(saveRequest(), context);
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(
      "save_warehouse_floor_map",
      expect.objectContaining({
        p_warehouse_id: warehouseId,
        p_floor_number: 2,
        p_expected_version: 1,
        p_racks: [],
      })
    );
    expect(mapQuery.eq).toHaveBeenCalledWith("floor_number", 2);
  });
  it.each(["FLOOR_MAP_VERSION_CONFLICT", "RACK_ALREADY_MAPPED_ON_ANOTHER_FLOOR"])(
    "preserves actionable conflicts: %s",
    async (reason) => {
      mocks.rpc.mockResolvedValue({ error: { message: reason } });
      const response = await saveFloor(saveRequest(), context);
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: reason });
    }
  );
  it("requires both parent and child edit permission before writes", async () => {
    mocks.allPermissions.mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    expect((await saveFloor(saveRequest(), context)).status).toBe(403);
    mocks.allPermissions.mockResolvedValue(null);
    mocks.capability.mockResolvedValue(false);
    expect((await saveFloor(saveRequest(), context)).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("cleans up a new image when the transaction rejects it without deleting the committed image", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "FLOOR_MAP_VERSION_CONFLICT" } });
    const response = await saveFloor(
      saveRequest({}, new File(["image"], "floor.png", { type: "image/png" })),
      context
    );
    expect(response.status).toBe(409);
    expect(mocks.remove).toHaveBeenCalledTimes(1);
    expect(mocks.remove).not.toHaveBeenCalledWith(["second.png"]);
  });
  it("does not expose unknown database exceptions", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "private constraint details" } });
    const response = await saveFloor(saveRequest(), context);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      code: "FLOOR_MAP_SAVE_FAILED",
      error: "Failed to save warehouse floor map",
    });
  });
});
