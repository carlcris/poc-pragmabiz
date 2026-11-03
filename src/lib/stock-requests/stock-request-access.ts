import type { StockRequest } from "@/types/stock-request";

type StockRequestScope = Pick<StockRequest, "business_unit_id" | "fulfilling_business_unit_id">;

// The requesting business unit owns drafting, submitting, and cancelling the transfer.
export const isRequestingBusinessUnit = (
  request: StockRequestScope,
  currentBusinessUnitId: string | null | undefined
) => !!currentBusinessUnitId && request.business_unit_id === currentBusinessUnitId;

// The fulfilling business unit approves or rejects a submitted transfer.
export const isFulfillingBusinessUnit = (
  request: StockRequestScope,
  currentBusinessUnitId: string | null | undefined
) => !!currentBusinessUnitId && request.fulfilling_business_unit_id === currentBusinessUnitId;

// Mirrors PUT /api/stock-requests/[id]: edit permission, a draft, and the requesting unit.
export const canEditStockRequest = (
  request: StockRequestScope & Pick<StockRequest, "status">,
  currentBusinessUnitId: string | null | undefined,
  canEditResource: boolean
) =>
  canEditResource &&
  request.status === "draft" &&
  isRequestingBusinessUnit(request, currentBusinessUnitId);
