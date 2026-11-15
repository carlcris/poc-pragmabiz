import type { Database } from "@/types/database.types";

export const STOCK_ADJUSTMENT_ITEM_COLUMNS = `
  id,
  adjustment_id,
  item_id,
  item_batch_id,
  item_batch_location_id,
  item_code,
  item_name,
  entered_qty,
  entered_unit_option_id,
  entered_unit_label,
  entered_qty_per_unit,
  current_qty,
  adjusted_qty,
  difference,
  unit_cost,
  total_cost,
  uom_id,
  uom_name,
  reason,
  created_at,
  updated_at,
  item_batch:item_batches!stock_adjustment_items_item_batch_id_fkey(
    batch_code, received_at, expiration_date
  ),
  batch_location:item_batch_locations!stock_adjustment_items_item_batch_location_id_fkey(
    batch_location_sku,
    location_id,
    warehouse_location:warehouse_locations!item_batch_locations_location_id_fkey(code, name)
  )
` as const;

type StockAdjustmentLineRow = Database["public"]["Tables"]["stock_adjustment_items"]["Row"];

type ItemBatch = Pick<
  Database["public"]["Tables"]["item_batches"]["Row"],
  "batch_code" | "received_at" | "expiration_date"
>;
type WarehouseLocation = { code: string; name: string | null };
type Embedded<T> = T | T[] | null;
type BatchLocation = {
  batch_location_sku: string | null;
  location_id: string;
  warehouse_location: Embedded<WarehouseLocation>;
};

export type StockAdjustmentItemRow = Pick<
  StockAdjustmentLineRow,
  | "id"
  | "adjustment_id"
  | "item_id"
  | "item_batch_id"
  | "item_batch_location_id"
  | "item_code"
  | "item_name"
  | "entered_qty"
  | "entered_unit_option_id"
  | "entered_unit_label"
  | "entered_qty_per_unit"
  | "current_qty"
  | "adjusted_qty"
  | "difference"
  | "unit_cost"
  | "total_cost"
  | "uom_id"
  | "uom_name"
  | "reason"
  | "created_at"
  | "updated_at"
> & {
  item_batch: Embedded<ItemBatch>;
  batch_location: Embedded<BatchLocation>;
};

type AdjustmentLocation = {
  id?: string | null;
  code?: string | null;
  name?: string | null;
};

const toOne = <T>(value: Embedded<T> | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

export const mapStockAdjustmentItem = (
  item: StockAdjustmentItemRow,
  destination: AdjustmentLocation
) => {
  const batch = toOne(item.item_batch);
  const batchLocation = toOne(item.batch_location);
  const warehouseLocation = toOne(batchLocation?.warehouse_location);

  return {
    id: item.id,
    adjustmentId: item.adjustment_id,
    itemId: item.item_id,
    itemBatchId: item.item_batch_id,
    itemBatchLocationId: item.item_batch_location_id,
    batchLocationSku: batchLocation?.batch_location_sku ?? null,
    batchCode: batch?.batch_code ?? null,
    batchReceivedAt: batch?.received_at ?? null,
    batchExpirationDate: batch?.expiration_date ?? null,
    batchWarehouseLocationId: batchLocation?.location_id ?? destination.id ?? null,
    batchLocationCode: batchLocation
      ? (warehouseLocation?.code ?? null)
      : (destination.code ?? null),
    batchLocationName: batchLocation
      ? (warehouseLocation?.name ?? null)
      : (destination.name ?? null),
    itemCode: item.item_code,
    itemName: item.item_name,
    enteredQty: Number(item.entered_qty),
    enteredUnitOptionId: item.entered_unit_option_id,
    enteredUnitLabel: item.entered_unit_label,
    enteredQtyPerUnit: Number(item.entered_qty_per_unit),
    currentQty: Number(item.current_qty),
    adjustedQty: Number(item.adjusted_qty),
    difference: Number(item.difference),
    unitCost: Number(item.unit_cost),
    totalCost: Number(item.total_cost),
    uomId: item.uom_id,
    uomName: item.uom_name,
    reason: item.reason,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
};
