import type { StatusTextTone } from "@/components/shared/StatusText";
import type { LoadListStatus } from "@/types/load-list";

export const LOAD_LIST_STATUS_TONES: Record<LoadListStatus, StatusTextTone> = {
  draft: "muted",
  confirmed: "blue",
  in_transit: "purple",
  arrived: "indigo",
  receiving: "amber",
  pending_approval: "yellow",
  received: "green",
  cancelled: "red",
};

export const LOAD_LIST_STATUS_LABEL_KEYS = {
  draft: "statusDraft",
  confirmed: "statusConfirmed",
  in_transit: "statusInTransit",
  arrived: "statusArrived",
  receiving: "statusReceiving",
  pending_approval: "statusPendingApproval",
  received: "statusReceived",
  cancelled: "statusCancelled",
} as const satisfies Record<LoadListStatus, string>;

// Receipt quantities only carry meaning once the shipment has reached the destination.
const RECEIPT_TRACKING_STATUSES: readonly LoadListStatus[] = [
  "arrived",
  "receiving",
  "pending_approval",
  "received",
];

export const showsLoadListReceiptQuantities = (status: LoadListStatus) =>
  RECEIPT_TRACKING_STATUSES.includes(status);

export const formatLoadListAmount = (amount: number, currencyCode: string, locale: string) => {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
};

export const getLoadListCurrencySymbol = (currencyCode: string, locale: string) =>
  formatLoadListAmount(0, currencyCode, locale).replace(/[\d\s.,]/g, "") || currencyCode;

export const formatLoadListQuantity = (value: number, locale: string) =>
  value.toLocaleString(locale, { maximumFractionDigits: 4 });

export const formatLoadListDate = (value: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "2-digit" }).format(
    new Date(value)
  );
