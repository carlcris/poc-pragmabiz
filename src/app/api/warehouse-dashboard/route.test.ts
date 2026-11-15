import { beforeEach, expect, it, vi } from "vitest";
import type { DashboardData } from "@/types/warehouse-dashboard";
import { GET } from "./route";

const state = vi.hoisted(() => ({
  canViewStock: true,
  rpc: vi.fn(),
  stockSelect: vi.fn(),
  stockLimit: vi.fn(),
}));

vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: <T>(handler: T) => handler,
}));
vi.mock("@/services/permissions/permissionResolver", () => ({
  getUserCapabilities: async () =>
    new Set(state.canViewStock ? ["dashboard.widget.stock_value.view"] : []),
  hasCapability: (permissions: Set<string>, key: string) => permissions.has(key),
}));
vi.mock("@/lib/supabase/server-with-bu", () => ({
  createServerClientWithBU: async () => ({
    currentBusinessUnitId: "selected-unit",
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: "user" } }, error: null }) },
      rpc: state.rpc,
      from: (table: string) => {
        if (table === "users") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: { company_id: "company" }, error: null }),
              }),
            }),
          };
        }
        if (table === "user_business_unit_access") {
          return {
            select: () => ({
              eq: async () => ({
                data: [{ business_unit_id: "selected-unit" }, { business_unit_id: "other-unit" }],
              }),
            }),
          };
        }
        if (table === "stock_transaction_items") {
          return { select: state.stockSelect };
        }
        throw new Error(`Unexpected table: ${table}`);
      },
    },
  }),
}));

beforeEach(() => {
  vi.resetAllMocks();
  state.canViewStock = true;
  state.stockSelect.mockReturnValue({ in: () => ({ order: () => ({ limit: state.stockLimit }) }) });
  state.stockLimit.mockResolvedValue({ data: [], error: null });
  state.rpc.mockResolvedValue({ data: [], error: null });
});

it("returns pending-only out-of-stock rows from the scoped SQL list", async () => {
  state.rpc.mockResolvedValueOnce({
    data: [
      { item_id: "staged", item_name: "First receipt", qty: "0", uom: "pcs", location_code: null },
    ],
    error: null,
  });
  const response = await GET();
  expect(response.status).toBe(200);
  const data: DashboardData = await response.json();
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith("get_warehouse_dashboard_out_of_stocks", {
    p_company_id: "company",
    p_business_unit_ids: ["selected-unit"],
  });
  expect(data.out_of_stocks).toEqual([
    { item_id: "staged", item_name: "First receipt", qty: 0, uom: "pcs", location_code: null },
  ]);
});

it("derives adjustment directions per line and preserves the type of other movements", async () => {
  const incoming = { transaction_type: "in", created_at: "2026-11-14T08:00:00Z" };
  const adjustment = { ...incoming, reference_type: "stock_adjustment" };
  state.stockLimit.mockResolvedValueOnce({
    data: [
      { quantity: 10, qty_before: 0, qty_after: 10, stock_transactions: adjustment },
      { quantity: 3, qty_before: 5, qty_after: 2, stock_transactions: adjustment },
      {
        quantity: 4,
        qty_before: 0,
        qty_after: 0,
        stock_transactions: { ...incoming, reference_type: "grn" },
      },
    ],
    error: null,
  });
  const response = await GET();
  expect(response.status).toBe(200);
  const data: DashboardData = await response.json();
  expect(data.last_stock_movements.map(({ type, qty }) => ({ type, qty }))).toEqual([
    { type: "in", qty: 10 },
    { type: "out", qty: 3 },
    { type: "in", qty: 4 },
  ]);
});

it("omits both stock lists when the caller lacks the stock widget capability", async () => {
  state.canViewStock = false;
  const response = await GET();
  expect(response.status).toBe(200);
  const data: DashboardData = await response.json();
  expect(data.out_of_stocks).toEqual([]);
  expect(data.last_stock_movements).toEqual([]);
  expect(state.rpc).not.toHaveBeenCalled();
  expect(state.stockSelect).not.toHaveBeenCalled();
});
