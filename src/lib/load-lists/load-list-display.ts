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
