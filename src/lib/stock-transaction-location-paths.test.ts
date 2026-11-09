import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchStockTransactionLocationPaths } from "./stock-transaction-location-paths";

describe("stock transaction location paths", () => {
  it("batches shared ancestors and uses names in hierarchy order without codes", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [
          { id: "zone", name: " Zone 3 " },
          { id: "rack", name: "Rack 1" },
        ],
        error: null,
      }),
    };
    const from = vi.fn().mockReturnValue(query);
    const paths = await fetchStockTransactionLocationPaths(
      { from } as unknown as SupabaseClient,
      "company",
      [
        { id: "bin", name: "Bin 17", path_ids: ["zone", "rack", "bin"] },
        { id: "other", name: "Bin 18", path_ids: ["zone", "rack", "other"] },
      ]
    );
    expect(paths.get("bin")).toBe("Zone 3 / Rack 1 / Bin 17");
    expect(paths.get("other")).toBe("Zone 3 / Rack 1 / Bin 18");
    expect(from).toHaveBeenCalledTimes(1);
    expect(query.in).toHaveBeenCalledWith("id", ["zone", "rack"]);
    expect(query.eq).toHaveBeenCalledWith("company_id", "company");
  });

  it("avoids a query when there are no ancestors and handles unnamed locations", async () => {
    const from = vi.fn();
    const paths = await fetchStockTransactionLocationPaths(
      { from } as unknown as SupabaseClient,
      "company",
      [{ id: "root", name: null, path_ids: ["root"] }]
    );
    expect(paths.get("root")).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
});
