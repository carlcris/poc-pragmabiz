export const MAX_STOCK_MOVE_BATCH_SELECTION = 100;

export type StockMoveResponse = {
  id: string;
  transactionCode: string;
  message: string;
};

export type StockMoveBatchOption = {
  id: string;
  batchCode: string;
  qtyAvailable: number;
};

export type StockMoveBatchLookupResponse = {
  data: StockMoveBatchOption[];
  hasMore: boolean;
};

export type StockMoveSourceAvailabilityResponse = {
  availableQuantity: number;
  namedBatches: Pick<StockMoveBatchOption, "id" | "qtyAvailable">[];
};

export const STOCK_MOVE_ERROR_CODES = [
  "STOCK_MOVE_UNAUTHORIZED",
  "STOCK_MOVE_FORBIDDEN",
  "STOCK_MOVE_CONTEXT_INVALID",
  "STOCK_MOVE_DETAILS_INVALID",
  "STOCK_MOVE_WAREHOUSE_INVALID",
  "STOCK_MOVE_LOCATION_INVALID",
  "STOCK_MOVE_ITEM_UNAVAILABLE",
  "STOCK_MOVE_BATCH_UNAVAILABLE",
  "STOCK_MOVE_INSUFFICIENT_STOCK",
  "STOCK_MOVE_DESTINATION_UNAVAILABLE",
  "STOCK_MOVE_BATCH_CONFLICT",
  "STOCK_MOVE_FAILED",
] as const;

export type StockMoveErrorCode = (typeof STOCK_MOVE_ERROR_CODES)[number];
