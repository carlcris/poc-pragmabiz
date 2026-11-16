import { createClient } from "@supabase/supabase-js";
import { expect, it, vi } from "vitest";
import { fetchPickList } from "./_lib";

it("loads planned and actual location names in the same ancestor lookup", async () => {
  const plannedBin = { id: "bin-1", code: "B1", name: "Bin 1", path_ids: ["rack", "bin-1"] };
  const actualBin = { id: "bin-3", code: "B3", name: "Bin 3", path_ids: ["rack", "bin-3"] };
  const pickList = {
    pick_list_items: [{ id: "line", suggested_pick_location: plannedBin }],
    delivery_note_item_picks: [
      { id: "pick-3", picked_location: actualBin, picked_location_id: actualBin.id, picked_qty: 2 },
      {
        id: "pick-1",
        picked_location: plannedBin,
        picked_location_id: plannedBin.id,
        picked_qty: 1,
      },
    ],
  };
  const requests: URL[] = [];
  const supabase = createClient("http://localhost:54321", "test-key", {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: vi.fn<typeof fetch>(async (input) => {
        const url = new URL(input instanceof Request ? input.url : input.toString());
        requests.push(url);
        if (url.pathname.endsWith("/pick_lists")) return Response.json(pickList);
        return Response.json([{ id: "rack", code: "R1", name: "Rack A" }]);
      }),
    },
  });

  const detail = await fetchPickList(supabase, "company", "list");

  expect(detail).toMatchObject({
    pick_list_items: [{ suggested_pick_location: { location_name_path: "Rack A / Bin 1" } }],
    delivery_note_item_picks: [
      { picked_location_name_path: "Rack A / Bin 3", picked_qty: 2 },
      { picked_location_name_path: "Rack A / Bin 1", picked_qty: 1 },
    ],
  });
  expect(requests.map((url) => url.pathname)).toEqual([
    "/rest/v1/pick_lists",
    "/rest/v1/warehouse_locations",
  ]);
  expect(requests[0].searchParams.get("select")).toContain(
    "picked_location:warehouse_locations!delivery_note_item_picks_picked_location_id_fkey"
  );
  expect(requests[0].searchParams.get("delivery_note_item_picks.deleted_at")).toBe("is.null");
  expect(requests[1].searchParams.get("id")).toBe("in.(rack)");
});
