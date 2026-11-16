import { expect, it } from "vitest";
import { summarizePickProgress } from "../../apps/mobile/src/api/pick-progress";

const bin3 = {
  pick_list_item_id: "line-a",
  picked_location_id: "bin-3",
  picked_location_name_path: "Zone 1 / Rack A / Bin 3",
  source_warehouse_id: "warehouse-a",
  source_warehouse: { warehouse_name: "Warehouse A" },
  picked_qty: 1,
};
const bin1 = {
  ...bin3,
  picked_location_id: "bin-1",
  picked_location_name_path: "Zone 1 / Rack A / Bin 1",
};

it("keeps the completed total and groups actual picks by bin and line", () => {
  const progress = summarizePickProgress([
    { ...bin3, picked_batch_code: "batch-a" },
    { ...bin3, picked_batch_code: "batch-b" },
    bin1,
    { ...bin1, picked_qty: 10, deleted_at: "2026-11-16T09:00:00Z" },
    { ...bin3, pick_list_item_id: "line-b", picked_location_id: "other-bin" },
  ]);

  const line = progress.get("line-a")!;
  expect(line.pickedQty).toBe(3);
  expect([...line.locations.values()]).toMatchObject([
    { locationId: "bin-3", locationNamePath: "Zone 1 / Rack A / Bin 3", pickedQty: 2 },
    { locationId: "bin-1", locationNamePath: "Zone 1 / Rack A / Bin 1", pickedQty: 1 },
  ]);
  expect(progress.get("line-b")?.locations.get("other-bin")?.pickedQty).toBe(1);
});

it("keeps bins with the same address separate when their warehouses differ", () => {
  const progress = summarizePickProgress([
    bin3,
    {
      ...bin3,
      picked_location_id: "another-warehouse-bin",
      source_warehouse_id: "warehouse-b",
      source_warehouse: { warehouse_name: "Warehouse B" },
    },
  ]);

  expect([...progress.get("line-a")!.locations.values()]).toMatchObject([
    { locationId: "bin-3", warehouseName: "Warehouse A", pickedQty: 1 },
    { locationId: "another-warehouse-bin", warehouseName: "Warehouse B", pickedQty: 1 },
  ]);
});
