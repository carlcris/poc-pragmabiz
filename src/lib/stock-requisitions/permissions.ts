import { GRANULAR_CAPABILITIES } from "@/constants/granular-permissions";
import { getUserCapabilities, hasCapability } from "@/services/permissions/permissionResolver";
import type { StockRequisitionCapabilities } from "@/types/stock-requisition";

export async function resolveStockRequisitionCapabilities(
  userId: string,
  businessUnitId: string | null
): Promise<StockRequisitionCapabilities> {
  const capabilities = await getUserCapabilities(userId, businessUnitId);

  return {
    canViewTotalAmount: hasCapability(
      capabilities,
      GRANULAR_CAPABILITIES.STOCK_REQUISITIONS_TOTAL_AMOUNT
    ),
    canViewUnitCost: hasCapability(
      capabilities,
      GRANULAR_CAPABILITIES.STOCK_REQUISITIONS_UNIT_COST
    ),
    canViewSupplierCostSummary: hasCapability(
      capabilities,
      GRANULAR_CAPABILITIES.STOCK_REQUISITIONS_SUPPLIER_COST_SUMMARY
    ),
  };
}
