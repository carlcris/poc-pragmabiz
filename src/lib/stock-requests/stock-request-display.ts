import type { StatusTextTone } from "@/components/shared/StatusText";
import type { StockRequestPriority, StockRequestStatus } from "@/types/stock-request";

export const STOCK_REQUEST_STATUS_TONES: Record<StockRequestStatus, StatusTextTone> = {
  draft: "muted",
  submitted: "amber",
  approved: "blue",
  allocating: "amber",
  partially_allocated: "amber",
  allocated: "amber",
  picking: "indigo",
  picked: "indigo",
  dispatched: "indigo",
  delivered: "indigo",
  received: "green",
  partially_fulfilled: "green",
  fulfilled: "green",
  completed: "green",
  cancelled: "red",
};

export const STOCK_REQUEST_STATUS_LABEL_KEYS = {
  draft: "statusDraft",
  submitted: "statusSubmitted",
  approved: "statusApproved",
  allocating: "statusAllocating",
  partially_allocated: "statusPartiallyAllocated",
  allocated: "statusAllocated",
  picking: "statusPicking",
  picked: "statusPicked",
  dispatched: "statusDispatched",
  delivered: "statusDelivered",
  received: "statusReceived",
  partially_fulfilled: "statusPartiallyFulfilled",
  fulfilled: "statusFulfilled",
  completed: "statusCompleted",
  cancelled: "statusCancelled",
} as const satisfies Record<StockRequestStatus, string>;

export const STOCK_REQUEST_PRIORITY_TONES: Record<StockRequestPriority, StatusTextTone> = {
  low: "muted",
  normal: "muted",
  high: "amber",
  urgent: "red",
};

export const STOCK_REQUEST_PRIORITY_LABEL_KEYS = {
  low: "priorityLow",
  normal: "priorityNormal",
  high: "priorityHigh",
  urgent: "priorityUrgent",
} as const satisfies Record<StockRequestPriority, string>;

const PRE_DELIVERY_STATUSES: readonly StockRequestStatus[] = ["draft", "submitted", "approved"];

// Delivered quantities only accrue once the fulfilling warehouse starts moving stock.
export const showsStockRequestDelivery = (status: StockRequestStatus) =>
  !PRE_DELIVERY_STATUSES.includes(status);
