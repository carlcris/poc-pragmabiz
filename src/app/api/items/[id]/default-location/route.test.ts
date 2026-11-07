import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "./route";

const state = vi.hoisted(() => ({
  location: { id: "location", is_storable: true, is_active: true } as {
    id: string;
    is_storable: boolean;
    is_active: boolean;
  } | null,
  existing: true,
  update: vi.fn(),
  insert: vi.fn(),
}));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: <T>(handler: T) => handler,
}));
vi.mock("@/lib/auth", () => ({ requirePermission: async () => null }));
vi.mock("@/lib/supabase/server-with-bu", () => ({
  createServerClientWithBU: async () => ({
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: "user" } } }) },
      from: (table: string) => {
        const query = {
          select: () => query,
          eq: () => query,
          is: () => query,
          single: async () => ({ data: { company_id: "company" } }),
          maybeSingle: async () => ({
            data:
              table === "warehouse_locations"
                ? state.location
                : table === "item_warehouse"
                  ? state.existing
                    ? { id: "iw" }
                    : null
                  : { id: "item" },
          }),
          update: state.update,
          insert: state.insert,
        };
        return query;
      },
    },
  }),
}));
const request = (locationId: string | null = "location") =>
  PATCH(
    new NextRequest("http://localhost/api/items/item/default-location", {
      method: "PATCH",
      body: JSON.stringify({ warehouseId: "warehouse", locationId }),
    }),
    { params: Promise.resolve({ id: "item" }) }
  );
beforeEach(() => {
  vi.clearAllMocks();
  state.location = { id: "location", is_storable: true, is_active: true };
  state.existing = true;
  state.update.mockReturnValue({ eq: async () => ({ error: null }) });
  state.insert.mockResolvedValue({ error: null });
});
it.each([true, false])(
  "rejects Organize Only locations before writing (existing row: %s)",
  async (existing) => {
    state.existing = existing;
    state.location!.is_storable = false;
    const response = await request();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: "LOCATION_STORAGE_UNAVAILABLE",
      error: "Choose an active location that allows stock storage.",
    });
    expect(state.update).not.toHaveBeenCalled();
    expect(state.insert).not.toHaveBeenCalled();
  }
);
it("rejects an inactive storage location", async () => {
  state.location!.is_active = false;
  expect((await request()).status).toBe(409);
  expect(state.update).not.toHaveBeenCalled();
});
it.each([true, false])("accepts active storage locations (existing row: %s)", async (existing) => {
  state.existing = existing;
  expect((await request()).status).toBe(200);
  expect(existing ? state.update : state.insert).toHaveBeenCalledWith(
    expect.objectContaining({ default_location_id: "location" })
  );
});
it("still allows clearing an existing preference", async () => {
  expect((await request(null)).status).toBe(200);
  expect(state.update).toHaveBeenCalledWith(expect.objectContaining({ default_location_id: null }));
});
it("rejects a location outside the scoped lookup", async () => {
  state.location = null;
  expect((await request()).status).toBe(400);
  expect(state.update).not.toHaveBeenCalled();
});
