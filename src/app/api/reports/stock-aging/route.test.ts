import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const state = vi.hoisted(() => ({
  cap: 1000,
  rows: [] as Record<string, unknown>[],
  ranges: [] as number[][],
  orders: [] as string[],
  failAt: -1,
  emptyAt: -1,
  countDeltaAt: -1,
  permission: vi.fn(),
}));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: (handler: unknown) => handler,
}));
vi.mock("@/lib/auth", () => ({ requirePermission: state.permission }));
vi.mock("@/lib/supabase/server-with-bu", () => ({
  createServerClientWithBU: async () => ({
    currentBusinessUnitId: "unit",
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: "user" } } }) },
      from: (table: string) => {
        let filtered = [...state.rows];
        const builder = {
          select: () => builder,
          eq: (column: string, value: unknown) => {
            if (table === "item_batch_locations") {
              filtered = filtered.filter((row) => {
                const [parent, child] = column.split(".");
                return (
                  (child ? (row[parent] as Record<string, unknown>)[child] : row[parent]) === value
                );
              });
            }
            return builder;
          },
          is: (column: string, value: unknown) => {
            filtered = filtered.filter((row) => row[column] === value);
            return builder;
          },
          gt: (column: string, value: number) => {
            filtered = filtered.filter((row) => Number(row[column]) > value);
            return builder;
          },
          single: async () => ({ data: { company_id: "company" } }),
          order: (column: string) => {
            state.orders.push(column);
            return builder;
          },
          range: async (start: number, end: number) => {
            state.ranges.push([start, end]);
            return {
              data:
                start === state.emptyAt
                  ? []
                  : filtered.slice(start, Math.min(end + 1, start + state.cap)),
              count: filtered.length + (start === state.countDeltaAt ? 1 : 0),
              error: start === state.failAt ? { message: "private database failure" } : null,
            };
          },
        };
        return builder;
      },
    },
  }),
}));

function rows(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i).padStart(6, "0"),
    company_id: "company",
    deleted_at: null,
    item_id: `item-${i}`,
    warehouse_id: "warehouse",
    location_id: `location-${i}`,
    item_batch_id: `batch-${i}`,
    qty_on_hand: 2,
    qty_reserved: 0,
    qty_available: 2,
    item: { item_code: `ITEM-${i}`, item_name: `Item ${i}`, purchase_price: 3 },
    warehouse: { business_unit_id: "unit" },
    item_batch: { received_at: "2020-01-01", batch_code: `BATCH-${i}` },
  }));
}
async function request(params = "") {
  const response = await GET(new NextRequest(`http://localhost/api/reports/stock-aging?${params}`));
  return { status: response.status, body: await response.json() };
}
beforeEach(() => {
  vi.clearAllMocks();
  state.permission.mockResolvedValue(null);
  state.cap = 1000;
  state.rows = rows(1205);
  state.ranges = [];
  state.orders = [];
  state.failAt = -1;
  state.emptyAt = -1;
  state.countDeltaAt = -1;
});

it("exports all matching rows beyond both the 50-row preview and 1000-row source limits", async () => {
  const { status, body } = await request("exportMode=pdf&page=9&limit=10");
  expect(status).toBe(200);
  expect(body.data).toHaveLength(1205);
  expect(body.summary.totalQtyOnHand).toBe(2410);
  expect(body.summary.totalStockValue).toBe(7230);
  expect(body.pagination).toEqual({ page: 1, limit: 5000, total: 1205, totalPages: 1 });
  expect(state.ranges).toEqual([
    [0, 999],
    [1000, 1999],
  ]);
  expect(state.orders).toEqual(["id"]);
});
it("advances by actual rows when the backend cap is smaller than the requested batch", async () => {
  state.cap = 200;
  const { body } = await request("exportMode=pdf&search=ITEM-1204");
  expect(body.data).toHaveLength(1);
  expect(body.data[0].itemCode).toBe("ITEM-1204");
  expect(state.ranges.at(-1)?.[0]).toBe(1200);
});
it("keeps normal pagination bounded and summaries complete", async () => {
  const { body } = await request("page=2&limit=99999");
  expect(body.data).toHaveLength(50);
  expect(body.pagination).toEqual({ page: 2, limit: 50, total: 1205, totalPages: 25 });
  expect(body.summary.rowCount).toBe(1205);
});
it("accepts exactly 5000 source rows and rejects 5001 even with a lower API cap", async () => {
  state.rows = rows(5000);
  expect((await request("exportMode=pdf")).body.data).toHaveLength(5000);
  state.rows = rows(5001);
  const result = await request("exportMode=pdf");
  expect(result.status).toBe(413);
  expect(result.body.data).toBeUndefined();
});
it("does not return partial results if a later batch fails or is unexpectedly empty", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  state.failAt = 1000;
  expect((await request("exportMode=pdf")).status).toBe(500);
  state.failAt = -1;
  state.emptyAt = 1000;
  expect((await request("exportMode=pdf")).status).toBe(500);
  vi.restoreAllMocks();
});
it("rejects changing source counts instead of returning an incomplete export", async () => {
  state.countDeltaAt = 1000;
  expect((await request("exportMode=pdf")).status).toBe(409);
});
it("preserves business-unit and positive-stock scope, and supports empty results", async () => {
  state.rows = rows(3);
  state.rows[0].warehouse = { business_unit_id: "other" };
  state.rows[1].qty_on_hand = 0;
  expect((await request("exportMode=pdf")).body.data).toHaveLength(1);
  expect((await request("exportMode=pdf&search=absent")).body.data).toEqual([]);
});
it("retains age filtering across all source batches", async () => {
  state.rows[1204].item_batch = { received_at: new Date().toISOString(), batch_code: "NEW" };
  expect((await request("exportMode=pdf&search=ITEM-1204")).body.data).toHaveLength(0);
  expect((await request("exportMode=pdf&search=ITEM-1204&ageBucket=all")).body.data).toHaveLength(
    1
  );
});

it("groups shared batch codes across items and warehouses with complete subtotals", async () => {
  state.rows = rows(3);
  state.rows[0].item_batch = { received_at: "2020-01-01", batch_code: "LOT-A" };
  state.rows[2].item_batch = { received_at: "2020-01-01", batch_code: "LOT-A" };
  state.rows[2].warehouse_id = "other-warehouse";
  const { body } = await request("exportMode=pdf&groupBy=batch");
  expect(body.filters.groupBy).toBe("batch");
  expect(body.groups).toHaveLength(2);
  const batch = body.groups.find((group: { title: string }) => group.title === "LOT-A");
  expect(batch).toMatchObject({ rowCount: 2, subtotalQtyOnHand: 4, subtotalStockValue: 12 });
  expect(
    body.data
      .slice(batch.startIndex, batch.startIndex + batch.rowCount)
      .map((row: { itemId: string }) => row.itemId)
  ).toEqual(["item-0", "item-2"]);
  expect(body.summary.totalQtyOnHand).toBe(6);
});
it("keeps separated rows of the same item in a single default group", async () => {
  state.rows = rows(3);
  state.rows[2].item_id = "item-0";
  const { body } = await request("exportMode=pdf");
  expect(body.filters.groupBy).toBe("item");
  expect(body.groups).toHaveLength(2);
  expect(body.groups[0]).toMatchObject({ id: "item-0", rowCount: 2, subtotalQtyOnHand: 4 });
});
it("does not merge unnamed batches and rejects invalid grouping", async () => {
  state.rows = rows(2);
  for (const row of state.rows) row.item_batch = { received_at: "2020-01-01", batch_code: null };
  expect((await request("exportMode=pdf&groupBy=batch")).body.groups).toHaveLength(2);
  expect((await request("exportMode=pdf&groupBy=invalid")).status).toBe(400);
});

it.each(["item", "batch"])(
  "sorts %s groups by oldest age and their rows by descending age",
  async (groupBy) => {
    state.rows = rows(4);
    const ages = [300, 100, 400, 200];
    state.rows.forEach((row, index) => {
      row.item_id = index < 2 ? "item-a" : "item-z";
      row.item = {
        item_code: index < 2 ? "A" : "Z",
        item_name: index < 2 ? "Alpha" : "Zulu",
        purchase_price: 3,
      };
      row.item_batch = {
        received_at: new Date(Date.now() - ages[index] * 86400000).toISOString(),
        batch_code: index < 2 ? "BATCH-A" : "BATCH-Z",
      };
    });
    const { body } = await request(`exportMode=pdf&ageBucket=all&groupBy=${groupBy}`);
    expect(body.groups.map((group: { oldestAgeDays: number }) => group.oldestAgeDays)).toEqual([
      400, 300,
    ]);
    expect(body.data.map((row: { batchAgeDays: number }) => row.batchAgeDays)).toEqual([
      400, 200, 300, 100,
    ]);
    expect(body.groups.map((group: { rowCount: number }) => group.rowCount)).toEqual([2, 2]);
    const paginated = await request(`ageBucket=all&groupBy=${groupBy}`);
    expect(paginated.body.data.map((row: { batchAgeDays: number }) => row.batchAgeDays)).toEqual([
      400, 300, 200, 100,
    ]);
  }
);

it("returns calendar duration from the receipt date using the same instant as total days", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-02-04T00:00:00Z"));
  try {
    state.rows = rows(1);
    state.rows[0].item_batch = { received_at: "2025-01-01T00:00:00Z", batch_code: "RECEIPT" };
    const { body } = await request("exportMode=pdf&ageBucket=all");
    expect(body.data[0]).toMatchObject({
      batchAgeDays: 399,
      batchAgeDuration: { years: 1, months: 1, days: 3 },
    });
  } finally {
    vi.useRealTimers();
  }
});

it("returns location names rather than code-prefixed addresses", async () => {
  state.rows = rows(1);
  state.rows[0].location = {
    id: "location-0",
    code: "MAIN",
    name: "Rack 1",
    path_ids: ["location-0"],
  };
  const { body } = await request("exportMode=pdf");
  expect(body.data[0].locationPath).toBe("Rack 1");
});
