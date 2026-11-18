import { describe, expect, it } from "vitest";
import {
  allBatchesSelection,
  countSelectedBatches,
  emptyBatchSelection,
  hasBatchSelection,
  isBatchChecked,
  masterCheckedState,
  toggleAllBatches,
  toggleBatch,
} from "./stock-move-batch-selection";

const first = "1";
const second = "2";
const third = "3";

describe("stock move batch selection", () => {
  it("starts with nothing selected and nothing submittable", () => {
    expect(countSelectedBatches(emptyBatchSelection)).toBe(0);
    expect(hasBatchSelection(emptyBatchSelection)).toBe(false);
    expect(masterCheckedState(emptyBatchSelection)).toBe(false);
    expect(isBatchChecked(emptyBatchSelection, first)).toBe(false);
  });

  it("accumulates individually checked batches across pages", () => {
    // `second` stands in for a batch checked on another page or search result.
    const selection = toggleBatch(toggleBatch(emptyBatchSelection, first, true), second, true);
    expect(isBatchChecked(selection, first)).toBe(true);
    expect(isBatchChecked(selection, second)).toBe(true);
    expect(isBatchChecked(selection, third)).toBe(false);
    expect(masterCheckedState(selection)).toBe("indeterminate");
    expect(selection).toEqual({
      mode: "include",
      batchLocationIds: [first, second],
    });
  });

  it("drops an unchecked batch without affecting the others", () => {
    const selection = toggleBatch(
      toggleBatch(toggleBatch(emptyBatchSelection, first, true), second, true),
      first,
      false
    );
    expect(selection).toEqual({
      mode: "include",
      batchLocationIds: [second],
    });
  });

  it("sends an empty exclude list for Select All so off-page batches stay eligible", () => {
    const selection = toggleAllBatches(true);
    expect(selection).toEqual(allBatchesSelection);
    expect(masterCheckedState(selection)).toBe(true);
    expect(isBatchChecked(selection, third)).toBe(true);
    expect(hasBatchSelection(selection)).toBe(true);
    expect(selection).toEqual({ mode: "exclude", batchLocationIds: [] });
  });

  it("records an unchecked exception after Select All and removes it when rechecked", () => {
    const excluded = toggleBatch(toggleAllBatches(true), first, false);
    expect(isBatchChecked(excluded, first)).toBe(false);
    expect(isBatchChecked(excluded, second)).toBe(true);
    expect(masterCheckedState(excluded)).toBe("indeterminate");
    expect(excluded).toEqual({
      mode: "exclude",
      batchLocationIds: [first],
    });

    const rechecked = toggleBatch(excluded, first, true);
    expect(rechecked).toEqual({ mode: "exclude", batchLocationIds: [] });
    expect(masterCheckedState(rechecked)).toBe(true);
  });

  it("clears every selection, including off-page ones, through the master checkbox", () => {
    const excluded = toggleBatch(toggleAllBatches(true), first, false);
    expect(toggleAllBatches(false)).toEqual(emptyBatchSelection);
    expect(hasBatchSelection(toggleAllBatches(false))).toBe(false);
    // Clearing never silently keeps the previous mode's exceptions.
    expect(countSelectedBatches(excluded)).toBe(1);
  });

  it("keeps explicit ids unique so the payload passes the schema's uniqueness rule", () => {
    const selection = toggleBatch(toggleBatch(emptyBatchSelection, first, true), first, true);
    expect(selection.batchLocationIds).toEqual([first]);
  });
});
