import { useCallback } from "react";
import { apiClient, getApiErrorCode } from "@/lib/api";
import type {
  InventoryBoxCountReportErrorCode,
  InventoryBoxCountReportResponse,
} from "@/types/inventory-box-count-report";

type InventoryBoxCountReportFilters = {
  categoryId: string;
  packingUnitId: string;
  businessUnitId?: string;
};

const REPORT_ERROR_CODES = [
  "INVENTORY_BOX_COUNT_TOO_LARGE",
  "INVENTORY_BOX_COUNT_CATEGORY_NOT_FOUND",
  "INVENTORY_BOX_COUNT_PACKING_UNIT_NOT_FOUND",
  "INVENTORY_BOX_COUNT_FORBIDDEN",
  "INVENTORY_BOX_COUNT_FILTERS_INVALID",
] as const satisfies readonly InventoryBoxCountReportErrorCode[];

export const getInventoryBoxCountReportErrorCode = (error: unknown) =>
  getApiErrorCode(error, REPORT_ERROR_CODES);

/** Loads a fresh report on demand and shares cancellation with PDF generation. */
export function useInventoryBoxCountReport() {
  return useCallback(
    (filters: InventoryBoxCountReportFilters, signal: AbortSignal) =>
      apiClient.get<InventoryBoxCountReportResponse>("/api/reports/inventory-box-count", {
        params: { ...filters, exportMode: "pdf" },
        signal,
      }),
    []
  );
}
