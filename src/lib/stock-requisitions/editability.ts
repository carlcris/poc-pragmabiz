import type { StockRequisition } from "@/types/stock-requisition";

// Mirrors PUT /api/stock-requisitions/[id]: edit permission and a draft requisition.
export const canEditStockRequisition = (
  stockRequisition: Pick<StockRequisition, "status">,
  canEditResource: boolean
) => canEditResource && stockRequisition.status === "draft";
