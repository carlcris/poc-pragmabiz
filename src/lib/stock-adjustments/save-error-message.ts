import { getApiErrorCode } from "@/lib/api";
import { STOCK_ADJUSTMENT_SAVE_ERROR_CODES } from "./save-errors";
import type { translations } from "@/lib/i18n/translations";

export const getStockAdjustmentSaveErrorMessage = (
  error: unknown,
  t: (key: keyof typeof translations.en.stockAdjustmentLineItemValidation) => string
): string => {
  switch (getApiErrorCode(error, STOCK_ADJUSTMENT_SAVE_ERROR_CODES)) {
    case "STOCK_ADJUSTMENT_ENTERED_UNIT_INVALID":
      return t("saveEnteredUnitInvalid");
    case "STOCK_ADJUSTMENT_BATCH_ALREADY_EXISTS":
      return t("batchAlreadyExistsInWarehouse");
    case "STOCK_ADJUSTMENT_BATCH_LOCATION_INCREASE_REQUIRED":
      return t("batchLocationIncreaseRequired");
    case "STOCK_ADJUSTMENT_EXPIRATION_DATE_INVALID":
      return t("expirationDateInvalid");
    case "STOCK_ADJUSTMENT_RECEIVED_DATE_INVALID":
      return t("receivedDateInvalid");
    case "STOCK_ADJUSTMENT_RECEIVED_DATE_CONFLICT":
      return t("receivedDateConflict");
    case "STOCK_ADJUSTMENT_NOT_FOUND":
      return t("saveNotFound");
    case "STOCK_ADJUSTMENT_NOT_DRAFT":
      return t("saveNotDraft");
    case "STOCK_ADJUSTMENT_BU_REQUIRED":
      return t("saveBusinessUnitRequired");
    case "STOCK_ADJUSTMENT_FIELDS_REQUIRED":
      return t("saveFieldsRequired");
    case "STOCK_ADJUSTMENT_ITEMS_REQUIRED":
      return t("saveItemsRequired");
    case "STOCK_ADJUSTMENT_WAREHOUSE_INVALID":
      return t("saveWarehouseInvalid");
    case "STOCK_ADJUSTMENT_ITEM_INVALID":
      return t("saveItemInvalid");
    case "STOCK_ADJUSTMENT_ITEM_MISSING":
      return t("saveItemMissing");
    case "STOCK_ADJUSTMENT_UOM_INVALID":
      return t("saveUomInvalid");
    case "STOCK_ADJUSTMENT_BATCH_LOCATION_INVALID":
      return t("saveBatchLocationInvalid");
    case "STOCK_ADJUSTMENT_BATCH_REQUIRED":
      return t("saveBatchRequired");
    case "STOCK_ADJUSTMENT_LOCATION_REQUIRED":
      return t("saveLocationRequired");
    case "STOCK_ADJUSTMENT_LOCATION_INVALID":
      return t("saveLocationInvalid");
    case "STOCK_ADJUSTMENT_FORBIDDEN":
      return t("saveForbidden");
    case "STOCK_ADJUSTMENT_WAREHOUSE_IMMUTABLE":
      return t("saveWarehouseImmutable");
    default:
      return t("saveFailed");
  }
};
