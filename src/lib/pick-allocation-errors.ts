import { getApiErrorCode } from "@/lib/api";

const allocationErrorCodes = [
  "PICK_ALLOCATION_SCOPE_INVALID",
  "PICK_ALLOCATION_INSUFFICIENT_BATCH_QUANTITY",
  "PICK_ALLOCATION_SINGLE_SOURCE_UNAVAILABLE",
  "LOCATION_PICKING_UNAVAILABLE",
  "LOCATION_STORAGE_UNAVAILABLE",
  "PICK_LIST_ACTIVE_EXISTS",
  "PICK_LIST_UNAUTHORIZED",
] as const;

type TranslateAllocationError = (
  key:
    | "scopeInvalid"
    | "insufficient"
    | "sourceUnavailable"
    | "alreadyActive"
    | "forbidden"
    | "failed"
) => string;

export function getPickAllocationErrorMessage(error: unknown, t: TranslateAllocationError) {
  switch (getApiErrorCode(error, allocationErrorCodes)) {
    case "PICK_ALLOCATION_SCOPE_INVALID":
      return t("scopeInvalid");
    case "PICK_ALLOCATION_INSUFFICIENT_BATCH_QUANTITY":
    case "PICK_ALLOCATION_SINGLE_SOURCE_UNAVAILABLE":
      return t("insufficient");
    case "LOCATION_PICKING_UNAVAILABLE":
    case "LOCATION_STORAGE_UNAVAILABLE":
      return t("sourceUnavailable");
    case "PICK_LIST_ACTIVE_EXISTS":
      return t("alreadyActive");
    case "PICK_LIST_UNAUTHORIZED":
      return t("forbidden");
    default:
      return t("failed");
  }
}
