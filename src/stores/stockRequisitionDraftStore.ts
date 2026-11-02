import { create } from "zustand";
import type { DocumentFormLine } from "@/types/document-line";

type StockRequisitionDraftState = {
  /** Lines handed from another screen (reorder alerts) to the next new requisition page. */
  pendingLines: DocumentFormLine[] | null;
  setPendingLines: (lines: DocumentFormLine[]) => void;
  clearPendingLines: () => void;
};

// In-memory only: the hand-off lasts for one client-side navigation and is gone on reload.
export const useStockRequisitionDraftStore = create<StockRequisitionDraftState>()((set) => ({
  pendingLines: null,
  setPendingLines: (lines) => set({ pendingLines: lines }),
  clearPendingLines: () => set({ pendingLines: null }),
}));
