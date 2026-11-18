import type { StockMoveBatchSelection } from "@/lib/validations/stock-move";

// Named IDs are checked in include mode and unchecked in exclude mode. Their
// quantities come from the server independently of the visible batch page.
export type StockMoveBatchSelectionState = StockMoveBatchSelection;

export const emptyBatchSelection: StockMoveBatchSelectionState = {
  mode: "include",
  batchLocationIds: [],
};

export const allBatchesSelection: StockMoveBatchSelectionState = {
  mode: "exclude",
  batchLocationIds: [],
};

export const countSelectedBatches = ({ batchLocationIds }: StockMoveBatchSelectionState) =>
  batchLocationIds.length;

export const isBatchChecked = (
  { mode, batchLocationIds }: StockMoveBatchSelectionState,
  id: string
) => (mode === "exclude" ? !batchLocationIds.includes(id) : batchLocationIds.includes(id));

export const masterCheckedState = (selection: StockMoveBatchSelectionState) =>
  countSelectedBatches(selection) === 0 ? selection.mode === "exclude" : ("indeterminate" as const);

export const hasBatchSelection = (selection: StockMoveBatchSelectionState) =>
  selection.mode === "exclude" || countSelectedBatches(selection) > 0;

export const toggleBatch = (
  selection: StockMoveBatchSelectionState,
  id: string,
  checked: boolean
): StockMoveBatchSelectionState => {
  if (isBatchChecked(selection, id) === checked) return selection;

  const shouldName = selection.mode === "exclude" ? !checked : checked;
  return {
    mode: selection.mode,
    batchLocationIds: shouldName
      ? [...selection.batchLocationIds, id]
      : selection.batchLocationIds.filter((namedId) => namedId !== id),
  };
};

export const toggleAllBatches = (checked: boolean) =>
  checked ? allBatchesSelection : emptyBatchSelection;
