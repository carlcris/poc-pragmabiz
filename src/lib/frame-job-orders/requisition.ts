import { requisitionRow, type RequisitionRow } from "@/lib/framing/documents";
import { frameLineToConfig } from "@/lib/framing/fromLineItem";
import { backingLabel } from "@/lib/framing/types";
import type { FrameQuotationSize } from "@/types/quotation";

export type FrameJobOrderRequisitionDocument = {
  rows: RequisitionRow[];
  totalSales: number;
  customerName: string;
  customerAddress?: string;
  transactionNumber: string;
  preparedBy?: string;
};

export type FrameJobOrderRequisitionResponse = {
  data: FrameJobOrderRequisitionDocument;
};

const itemLabel = (code?: string, name?: string): string =>
  [code?.trim(), name?.trim()].filter(Boolean).join(" ");

/**
 * Builds the same requisition rows used by the live frame configurator from
 * persisted job-order sizes. Keeping this adapter outside the page and API
 * route prevents the saved-job printout from developing a second document
 * format or its own geometry calculations.
 */
export function buildFrameJobOrderRequisitionRows(
  frameSizes: FrameQuotationSize[]
): RequisitionRow[] {
  return frameSizes.flatMap((size) => {
    const stored = size.frameConfiguration;
    const restored = frameLineToConfig(
      {
        itemId: stored.moldingItemId,
        itemCode: stored.moldingItemCode,
        itemName: stored.moldingItemName,
        quantity: stored.frameQuantity ?? 1,
        frameConfiguration: stored,
        frameComponents: size.frameComponents,
        matLayers: size.matLayers,
      },
      ""
    );

    if (!restored) return [];

    const matBoards: Record<number, string | undefined> = {};
    Object.entries(restored.selections.matBoards).forEach(([index, board]) => {
      if (!board) return;
      matBoards[Number(index)] = itemLabel(board.code, board.name.toLowerCase());
    });

    return [
      requisitionRow(restored.config, {
        moulding: itemLabel(restored.config.moulding.code, restored.config.moulding.name) || "-",
        matBoards,
        glazing: restored.config.glazing.label,
        backing: backingLabel(restored.config.backing),
      }),
    ];
  });
}
