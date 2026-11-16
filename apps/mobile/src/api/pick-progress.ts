import type { PickedLocation } from "../contracts/picking";
import { asRecord, firstRecord, maybeStr, num, str } from "../utils/record";

export const summarizePickProgress = (pickRows: unknown[]) => {
  const byLine = new Map<string, { pickedQty: number; locations: Map<string, PickedLocation> }>();
  for (const value of pickRows) {
    const row = asRecord(value);
    const lineId = maybeStr(
      row.pick_list_item_id || row.pickListItemId || row.line_id || row.lineId
    );
    if (row.deleted_at || !lineId) continue;

    const progress = byLine.get(lineId) ?? {
      pickedQty: 0,
      locations: new Map<string, PickedLocation>(),
    };
    const pickedQty = num(row.picked_qty ?? row.pickedQty);
    progress.pickedQty += pickedQty;
    byLine.set(lineId, progress);

    const locationId = maybeStr(row.picked_location_id);
    if (!locationId || pickedQty <= 0) continue;

    const location = progress.locations.get(locationId);
    if (location) {
      location.pickedQty += pickedQty;
    } else {
      const warehouse = firstRecord(row.source_warehouse);
      progress.locations.set(locationId, {
        locationId,
        locationNamePath: maybeStr(row.picked_location_name_path),
        warehouseId: str(row.source_warehouse_id),
        warehouseName: maybeStr(warehouse.warehouse_name || warehouse.warehouse_code),
        pickedQty,
      });
    }
  }
  return byLine;
};
