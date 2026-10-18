import type { StockMoveErrorCode } from "@/types/stock-move";

const STOCK_MOVE_ERRORS = {
  STOCK_MOVE_UNAUTHORIZED: { status: 401, error: "Sign in again before moving stock." },
  STOCK_MOVE_FORBIDDEN: {
    status: 403,
    error: "You do not have permission to move stock in this business unit.",
  },
  STOCK_MOVE_CONTEXT_INVALID: {
    status: 400,
    error: "Select a valid business unit before moving stock.",
  },
  STOCK_MOVE_DETAILS_INVALID: {
    status: 400,
    error:
      "Select distinct source and destination locations and enter a positive quantity with at most two decimal places.",
  },
  STOCK_MOVE_WAREHOUSE_INVALID: {
    status: 400,
    error: "Select active warehouses in the current business unit.",
  },
  STOCK_MOVE_LOCATION_INVALID: {
    status: 400,
    error: "Select active storage locations belonging to the chosen warehouses.",
  },
  STOCK_MOVE_ITEM_UNAVAILABLE: {
    status: 409,
    error: "This item is no longer available. Refresh the item and try again.",
  },
  STOCK_MOVE_INSUFFICIENT_STOCK: {
    status: 409,
    error:
      "The source location no longer has enough available stock. Reduce the quantity or select another source.",
  },
  STOCK_MOVE_DESTINATION_UNAVAILABLE: {
    status: 409,
    error:
      "The destination stock record is inactive or deleted. Restore it or select another destination.",
  },
  STOCK_MOVE_BATCH_CONFLICT: {
    status: 409,
    error:
      "The destination has a conflicting batch record. Resolve the batch record or select another warehouse.",
  },
  STOCK_MOVE_FAILED: {
    status: 500,
    error: "Stock could not be moved. Refresh stock levels before trying again.",
  },
} satisfies Record<StockMoveErrorCode, { status: number; error: string }>;

export const stockMoveErrorResponse = (code: StockMoveErrorCode) => ({
  status: STOCK_MOVE_ERRORS[code].status,
  body: { code, error: STOCK_MOVE_ERRORS[code].error },
});

export const mapStockMoveRpcError = (message: string) => {
  const code = Object.keys(STOCK_MOVE_ERRORS).find((value) => value === message);
  return stockMoveErrorResponse((code as StockMoveErrorCode | undefined) ?? "STOCK_MOVE_FAILED");
};
