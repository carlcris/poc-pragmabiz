import {
  getBatchReceivedDateError,
  STOCK_ADJUSTMENT_DATE_ERROR_CODES,
} from "./batch-received-date";

export const STOCK_ADJUSTMENT_SAVE_ERROR_CODES = [
  ...STOCK_ADJUSTMENT_DATE_ERROR_CODES,
  "STOCK_ADJUSTMENT_ENTERED_UNIT_INVALID",
  "STOCK_ADJUSTMENT_BATCH_ALREADY_EXISTS",
  "STOCK_ADJUSTMENT_BATCH_LOCATION_INCREASE_REQUIRED",
  "STOCK_ADJUSTMENT_NOT_FOUND",
  "STOCK_ADJUSTMENT_NOT_DRAFT",
  "STOCK_ADJUSTMENT_BU_REQUIRED",
  "STOCK_ADJUSTMENT_FIELDS_REQUIRED",
  "STOCK_ADJUSTMENT_ITEMS_REQUIRED",
  "STOCK_ADJUSTMENT_WAREHOUSE_INVALID",
  "STOCK_ADJUSTMENT_ITEM_INVALID",
  "STOCK_ADJUSTMENT_ITEM_MISSING",
  "STOCK_ADJUSTMENT_UOM_INVALID",
  "STOCK_ADJUSTMENT_BATCH_LOCATION_INVALID",
  "STOCK_ADJUSTMENT_BATCH_REQUIRED",
  "STOCK_ADJUSTMENT_LOCATION_REQUIRED",
  "STOCK_ADJUSTMENT_LOCATION_INVALID",
  "STOCK_ADJUSTMENT_FORBIDDEN",
  "STOCK_ADJUSTMENT_WAREHOUSE_IMMUTABLE",
] as const;
export type StockAdjustmentSaveErrorCode = (typeof STOCK_ADJUSTMENT_SAVE_ERROR_CODES)[number];

const knownFailures = new Map<
  string,
  { code: StockAdjustmentSaveErrorCode; error: string; status: number }
>([
  [
    "Invalid stock adjustment entered quantity or unit",
    {
      code: "STOCK_ADJUSTMENT_ENTERED_UNIT_INVALID",
      error:
        "The entered quantity or unit no longer matches the stock change. Reselect the unit and enter the quantity again.",
      status: 400,
    },
  ],
  [
    "A new batch location requires a positive stock increase from zero",
    {
      code: "STOCK_ADJUSTMENT_BATCH_LOCATION_INCREASE_REQUIRED",
      error:
        "This batch has no stock at the selected location. Enter a positive increase from zero.",
      status: 400,
    },
  ],
  [
    "Stock adjustment not found",
    {
      code: "STOCK_ADJUSTMENT_NOT_FOUND",
      error: "This adjustment is no longer available. Refresh the list and select another draft.",
      status: 404,
    },
  ],
  [
    "Stock adjustment is not valid for the current business unit",
    {
      code: "STOCK_ADJUSTMENT_NOT_FOUND",
      error: "This adjustment is no longer available. Refresh the list and select another draft.",
      status: 404,
    },
  ],
  [
    "Only draft adjustments can be updated",
    {
      code: "STOCK_ADJUSTMENT_NOT_DRAFT",
      error: "This adjustment is no longer a draft. Refresh the list before making changes.",
      status: 409,
    },
  ],
  [
    "Business unit context required",
    {
      code: "STOCK_ADJUSTMENT_BU_REQUIRED",
      error: "Select a business unit, then try saving again.",
      status: 400,
    },
  ],
  [
    "Missing required stock adjustment fields",
    {
      code: "STOCK_ADJUSTMENT_FIELDS_REQUIRED",
      error: "Complete the adjustment type, date, warehouse, and reason before saving.",
      status: 400,
    },
  ],
  [
    "Missing required fields: warehouseId, adjustmentType, adjustmentDate, reason",
    {
      code: "STOCK_ADJUSTMENT_FIELDS_REQUIRED",
      error: "Complete the adjustment type, date, warehouse, and reason before saving.",
      status: 400,
    },
  ],
  [
    "At least one item is required",
    {
      code: "STOCK_ADJUSTMENT_ITEMS_REQUIRED",
      error: "Add at least one item before saving.",
      status: 400,
    },
  ],
  [
    "Selected warehouse is not valid for the current business unit",
    {
      code: "STOCK_ADJUSTMENT_WAREHOUSE_INVALID",
      error: "Select a warehouse belonging to the current business unit.",
      status: 400,
    },
  ],
  [
    "Invalid stock adjustment item",
    {
      code: "STOCK_ADJUSTMENT_ITEM_INVALID",
      error: "Review each adjustment item and its quantities and cost, then try again.",
      status: 400,
    },
  ],
  [
    "Stock adjustment item does not exist",
    {
      code: "STOCK_ADJUSTMENT_ITEM_MISSING",
      error: "An item is no longer available. Remove it and select an available item.",
      status: 400,
    },
  ],
  [
    "Stock adjustment unit of measure does not exist",
    {
      code: "STOCK_ADJUSTMENT_UOM_INVALID",
      error: "A unit of measure is no longer available. Reselect the unit for the affected item.",
      status: 400,
    },
  ],
  [
    "Selected batch location is not valid for the adjustment",
    {
      code: "STOCK_ADJUSTMENT_BATCH_LOCATION_INVALID",
      error: "The selected batch location is no longer valid. Reselect a batch in this warehouse.",
      status: 400,
    },
  ],
  [
    "Batch code is required",
    {
      code: "STOCK_ADJUSTMENT_BATCH_REQUIRED",
      error: "Select an existing batch or enter a batch code for every item.",
      status: 400,
    },
  ],
  [
    "Batch selection or batch code is required for every adjustment item",
    {
      code: "STOCK_ADJUSTMENT_BATCH_REQUIRED",
      error: "Select an existing batch or enter a batch code for every item.",
      status: 400,
    },
  ],
  [
    "Location is required for a new batch",
    {
      code: "STOCK_ADJUSTMENT_LOCATION_REQUIRED",
      error: "Select a warehouse location before adding a new batch.",
      status: 400,
    },
  ],
  [
    "Selected location is not valid for the warehouse",
    {
      code: "STOCK_ADJUSTMENT_LOCATION_INVALID",
      error: "The selected location is not valid for this warehouse. Select another location.",
      status: 400,
    },
  ],
  [
    "User context mismatch",
    {
      code: "STOCK_ADJUSTMENT_FORBIDDEN",
      error:
        "You cannot save this adjustment. Check your business unit or ask an administrator for access.",
      status: 403,
    },
  ],
  [
    "User is not valid for the company",
    {
      code: "STOCK_ADJUSTMENT_FORBIDDEN",
      error:
        "You cannot save this adjustment. Check your business unit or ask an administrator for access.",
      status: 403,
    },
  ],
  [
    "User does not have access to the business unit",
    {
      code: "STOCK_ADJUSTMENT_FORBIDDEN",
      error:
        "You cannot save this adjustment. Check your business unit or ask an administrator for access.",
      status: 403,
    },
  ],
  [
    "The warehouse cannot be changed after an adjustment is created",
    {
      code: "STOCK_ADJUSTMENT_WAREHOUSE_IMMUTABLE",
      error: "The warehouse cannot be changed. Create a new adjustment for the other warehouse.",
      status: 400,
    },
  ],
]);

export const getStockAdjustmentSaveError = (
  failure: { code?: string; message?: string } | null | undefined
) => {
  if (failure?.code === "SA003") {
    return {
      code: "STOCK_ADJUSTMENT_BATCH_ALREADY_EXISTS" as const,
      error:
        "This batch code already exists in the selected warehouse. Use Existing Batch instead.",
      status: 409,
    };
  }
  const dateError = getBatchReceivedDateError(failure?.code);
  if (dateError) return dateError;
  if (failure?.code === "42501") return knownFailures.get("User context mismatch")!;
  return knownFailures.get(failure?.message ?? "") ?? null;
};
