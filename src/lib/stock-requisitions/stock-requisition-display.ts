import type { StatusTextTone } from "@/components/shared/StatusText";
import type { StockRequisitionStatus } from "@/types/stock-requisition";

export const STOCK_REQUISITION_STATUS_TONES: Record<StockRequisitionStatus, StatusTextTone> = {
  draft: "muted",
  submitted: "blue",
  partially_fulfilled: "yellow",
  fulfilled: "green",
  cancelled: "red",
};

export const STOCK_REQUISITION_STATUS_LABEL_KEYS = {
  draft: "statusDraft",
  submitted: "statusSubmitted",
  partially_fulfilled: "statusPartiallyFulfilled",
  fulfilled: "statusFulfilled",
  cancelled: "statusCancelled",
} as const satisfies Record<StockRequisitionStatus, string>;

// Fulfillment only accrues once the requisition has been sent to the supplier.
export const showsStockRequisitionFulfillment = (status: StockRequisitionStatus) =>
  status !== "draft";
