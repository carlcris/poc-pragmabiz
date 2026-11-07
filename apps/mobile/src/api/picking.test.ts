import { describe, expect, it, vi } from "vitest";
import { getPickList } from "./picking";

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/api/client", () => ({ apiRequest: mocks.request }));

describe("configured picking addresses", () => {
  it.each(["Zone 1 / Crate 1", "Rack 1 / Bin 1", "Rack 1 / Shelf 2 / Bin 1"])(
    "keeps the full %s name address and exact source identity",
    async (locationPath) => {
      mocks.request.mockResolvedValue({
        id: "pick-list",
        pick_list_no: "PL-1",
        status: "pending",
        pick_list_items: [
          {
            id: "line",
            item_id: "item",
            dn_item_id: "dn-line",
            allocated_qty: 4,
            picked_qty: 0,
            suggested_pick_location_id: "exact-location",
            suggested_batch_location_sku: "1234567890",
            suggested_pick_location: {
              id: "exact-location",
              code: "B1",
              name: "Bin 1",
              location_path: `CODE / ${locationPath}`,
              location_name_path: locationPath,
            },
          },
        ],
      });
      const list = await getPickList("pick-list");
      expect(list.items[0]).toMatchObject({
        locationPath: `CODE / ${locationPath}`,
        locationNamePath: locationPath,
        sourceLocationId: "exact-location",
        sourceLocationCode: "B1",
        sourceSku: "1234567890",
      });
    }
  );
});
