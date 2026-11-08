import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const state = vi.hoisted(() => ({
  permission: vi.fn(),
  context: vi.fn(),
  from: vi.fn(),
  operations: [] as unknown[][],
  warehouseUnit: "unit",
  error: null as unknown,
}));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: (handler: unknown) => handler,
}));
vi.mock("@/lib/auth", () => ({ requireLookupDataAccess: state.permission }));
vi.mock("@/lib/auth/requestContext", () => ({ requireRequestContext: state.context }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: state.from }) }));
vi.mock("@/lib/warehouse-location-name-path", () => ({
  fetchWarehouseLocationNamePaths: async (
    _client: unknown,
    _company: string,
    rows: typeof locations
  ) => ({
    data: new Map(rows.map((row) => [row.id, `Rack ${row.rack} / Bin 10`])),
    error: null,
  }),
}));

// Rack 01's code sorts after Rack 02-07's codes, reproducing the production omission.
const locations = Array.from({ length: 7 }, (_, i) => {
  const rack = String(i + 1).padStart(2, "0");
  return {
    id: `00000000-0000-4000-8000-00000000000${i + 1}`,
    rack,
    company_id: "company",
    warehouse_id: "warehouse",
    code: i === 0 ? "RCK01-BIN10" : `Rack${rack}-BIN10`,
    name: "Bin 10",
    location_path: `Rack${rack} - Rack ${rack} / ${i === 0 ? "RCK01" : `Rack${rack}`}-BIN10 - Bin 10`,
    path_ids: [],
    is_active: true,
    is_storable: true,
    is_pickable: true,
    location_type: "bin",
    deleted_at: null,
  };
});

function query(table: string) {
  let rows = [...locations];
  let start = 0;
  let end = rows.length;
  const orders: string[] = [];
  const builder = {
    select: (...args: unknown[]) => {
      state.operations.push(["select", ...args]);
      return builder;
    },
    eq: (column: string, value: unknown) => {
      state.operations.push(["eq", column, value]);
      if (table === "warehouse_locations")
        rows = rows.filter((row) => Reflect.get(row, column) === value);
      return builder;
    },
    is: (...args: unknown[]) => {
      state.operations.push(["is", ...args]);
      return builder;
    },
    not: (...args: unknown[]) => {
      state.operations.push(["not", ...args]);
      return builder;
    },
    order: (column: string, options: unknown) => {
      orders.push(column);
      state.operations.push(["order", column, options]);
      return builder;
    },
    range: (from: number, to: number) => {
      start = from;
      end = to + 1;
      return builder;
    },
    ilike: (column: string, pattern: string) => {
      state.operations.push(["ilike", column, pattern]);
      const regex = new RegExp(
        `^${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*")}$`,
        "i"
      );
      rows = rows.filter((row) => regex.test(String(Reflect.get(row, column))));
      return builder;
    },
    maybeSingle: async () => ({
      data:
        table === "warehouses"
          ? { id: "warehouse", business_unit_id: state.warehouseUnit }
          : (rows[0] ?? null),
      error: null,
    }),
    then: (resolve: (result: { data: typeof locations; error: unknown }) => unknown) => {
      rows.sort((a, b) => {
        for (const column of orders) {
          const result = String(Reflect.get(a, column)).localeCompare(
            String(Reflect.get(b, column))
          );
          if (result) return result;
        }
        return 0;
      });
      return Promise.resolve({ data: rows.slice(start, end), error: state.error }).then(resolve);
    },
  };
  return builder;
}
const request = (params = "") =>
  GET(new NextRequest(`http://localhost/api/lookups/warehouses/warehouse/locations?${params}`), {
    params: Promise.resolve({ id: "warehouse" }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  state.operations = [];
  state.error = null;
  state.warehouseUnit = "unit";
  state.from.mockImplementation(query);
  state.permission.mockResolvedValue(null);
  state.context.mockResolvedValue({ companyId: "company", accessibleBusinessUnitIds: ["unit"] });
});
it("includes Rack 01 Bin 10 in address order and exposes every remaining match on later pages", async () => {
  const first = await (await request("search=Bin%2010")).json();
  const second = await (await request("search=Bin%2010&page=2")).json();
  expect(first.data).toHaveLength(5);
  expect(first.data[0].code).toBe("RCK01-BIN10");
  expect(first.hasMore).toBe(true);
  expect(second.data).toHaveLength(2);
  expect(second.hasMore).toBe(false);
  expect(new Set([...first.data, ...second.data].map((row: { id: string }) => row.id)).size).toBe(
    7
  );
});
it.each(["Rack 01 / Bin 10", "Rack 01/Bin 10", "RCK01-BIN10", "rack 01 / bin 10"])(
  "finds the reported bin by %s",
  async (search) => {
    const body = await (await request(`search=${encodeURIComponent(search)}`)).json();
    expect(body.data.map((row: { code: string }) => row.code)).toEqual(["RCK01-BIN10"]);
    expect(body.hasMore).toBe(false);
  }
);
it("keeps the selected location available outside the requested page", async () => {
  const body = await (await request(`page=2&selectedId=${locations[0].id}`)).json();
  expect(body.data).toHaveLength(2);
  expect(body.selected.id).toBe(locations[0].id);
});
it("retains company, warehouse, active, use, type and subtree restrictions", async () => {
  await request(
    `storableOnly=true&pickableOnly=true&locationType=bin&excludeSubtreeId=${locations[0].id}`
  );
  for (const pair of [
    ["company_id", "company"],
    ["warehouse_id", "warehouse"],
    ["is_active", true],
    ["is_storable", true],
    ["is_pickable", true],
    ["location_type", "bin"],
  ]) {
    expect(state.operations).toContainEqual(["eq", ...pair]);
  }
  expect(state.operations).toContainEqual(["not", "path_ids", "cs", `{${locations[0].id}}`]);
  expect(state.operations).toContainEqual(["is", "deleted_at", null]);
});
it.each(["0", "-1", "1.5", "oops", "1000001"])("rejects invalid page %s", async (page) => {
  expect((await request(`page=${page}`)).status).toBe(400);
  expect(state.from).not.toHaveBeenCalled();
});
it("returns an empty page without claiming more matches", async () => {
  expect(await (await request("search=nonexistent")).json()).toEqual({
    data: [],
    selected: null,
    hasMore: false,
  });
});
it("denies warehouses outside accessible business units", async () => {
  state.warehouseUnit = "other";
  expect((await request()).status).toBe(404);
  expect(state.from).not.toHaveBeenCalledWith("warehouse_locations");
});
it("denies unauthorized lookups", async () => {
  state.permission.mockResolvedValue(new Response(null, { status: 403 }));
  expect((await request()).status).toBe(403);
  expect(state.from).not.toHaveBeenCalled();
});
it("returns safe errors", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  state.error = { message: "private details" };
  const response = await request();
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain("private details");
  log.mockRestore();
});
