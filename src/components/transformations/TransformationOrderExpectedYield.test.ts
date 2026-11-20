import { expect, it, vi } from "vitest";
import {
  getExpectedOutputYield,
  getPlannedQuantityPlan,
  getPlannedQuantityValidationError,
  type PlannedQuantityLine,
} from "./TransformationOrderCreateForm";

// The form renders the shared warehouse picker, whose lookup hook pulls in the
// auth store and Supabase client. These tests cover the pure planner helpers.
vi.mock("@/hooks/useLookups", () => ({
  useLookupWarehouses: () => ({ data: undefined, isLoading: false }),
}));

/** One bulk input scaling to one finished output, the 1-sack / 25-pack recipe. */
const singleOutputLines: PlannedQuantityLine[] = [
  {
    key: "input:in-1",
    direction: "input",
    itemCode: "BULK-50KG",
    itemName: "Bulk Rice 50kg Sack",
    uomLabel: "SACK",
    baseQuantity: "1",
  },
  {
    key: "primary-output:out-1",
    direction: "output",
    itemCode: "PACK-2KG",
    itemName: "Rice Pack 2kg",
    uomLabel: "PACK",
    baseQuantity: "25",
  },
];

/** A sheet layout with two cut outputs plus a scaling additional output. */
const multiOutputLines: PlannedQuantityLine[] = [
  {
    key: "input:sheet-in",
    direction: "input",
    itemCode: "SHEET",
    itemName: "Plywood Sheet",
    uomLabel: "SHT",
    baseQuantity: "1",
  },
  {
    key: "primary-output:out-a",
    direction: "output",
    itemCode: "PANEL-A",
    itemName: "Panel A",
    uomLabel: "PC",
    baseQuantity: "4",
  },
  {
    key: "primary-output:out-b",
    direction: "output",
    itemCode: "PANEL-B",
    itemName: "Panel B",
    uomLabel: "PC",
    baseQuantity: "2",
  },
  {
    key: "additional-output:add-1",
    direction: "output",
    itemCode: "OFFCUT",
    itemName: "Offcut",
    uomLabel: null,
    baseQuantity: "1",
  },
];

/** The yield as `itemCode:quantity`, so a case reads as what the person sees. */
const yieldOf = (lines: PlannedQuantityLine[], quantityValues: Record<string, string>) =>
  getExpectedOutputYield(lines, quantityValues)?.map(
    ({ line, quantity }) => `${line.itemCode}:${quantity}`
  ) ?? null;

it("previews 25 packs at the recipe's own scale and 75 packs at three times it", () => {
  expect(yieldOf(singleOutputLines, { "input:in-1": "1", "primary-output:out-1": "25" })).toEqual([
    "PACK-2KG:25",
  ]);
  expect(yieldOf(singleOutputLines, { "input:in-1": "3", "primary-output:out-1": "75" })).toEqual([
    "PACK-2KG:75",
  ]);
});

it("previews every output when the person edits an output instead of the input", () => {
  // Editing Panel A to 12 scales the sheet layout by 3.
  expect(
    yieldOf(multiOutputLines, {
      "input:sheet-in": "3",
      "primary-output:out-a": "12",
      "primary-output:out-b": "6",
      "additional-output:add-1": "3",
    })
  ).toEqual(["PANEL-A:12", "PANEL-B:6", "OFFCUT:3"]);
});

it("previews nothing for blank, zero, or fractional quantities", () => {
  for (const sackCount of ["", "   ", "0", "2.5"]) {
    const quantityValues = { "input:in-1": sackCount, "primary-output:out-1": "25" };
    expect(yieldOf(singleOutputLines, quantityValues)).toBeNull();
    expect(getPlannedQuantityValidationError(singleOutputLines, quantityValues)).toBe(
      "wholeNumbersOnly"
    );
  }
});

it("previews nothing when a missing entry leaves the set incomplete", () => {
  expect(yieldOf(singleOutputLines, { "input:in-1": "1" })).toBeNull();
  expect(getPlannedQuantityValidationError(singleOutputLines, { "input:in-1": "1" })).toBe(
    "wholeNumbersOnly"
  );
});

it("previews nothing for quantities that are whole but off the template ratio", () => {
  const quantityValues = { "input:in-1": "1", "primary-output:out-1": "30" };

  expect(yieldOf(singleOutputLines, quantityValues)).toBeNull();
  expect(getPlannedQuantityValidationError(singleOutputLines, quantityValues)).toBe("invalidRatio");
});

it("previews nothing when the scale cannot keep every line whole", () => {
  // A 2-sack batch cannot be driven by a single sack.
  const twoSackLines: PlannedQuantityLine[] = [
    { ...singleOutputLines[0], baseQuantity: "2" },
    { ...singleOutputLines[1], baseQuantity: "5" },
  ];

  expect(yieldOf(twoSackLines, { "input:in-1": "1", "primary-output:out-1": "2.5" })).toBeNull();
  expect(yieldOf(twoSackLines, { "input:in-1": "2", "primary-output:out-1": "5" })).toEqual([
    "PACK-2KG:5",
  ]);
});

it("previews nothing before a template is chosen", () => {
  expect(getExpectedOutputYield([], {})).toBeNull();
  expect(getPlannedQuantityValidationError([], {})).toBeNull();
});

/** The multiplier of a valid plan, or the error that blocks one. */
const planOf = (lines: PlannedQuantityLine[], quantityValues: Record<string, string>) => {
  const plan = getPlannedQuantityPlan(lines, quantityValues);
  if (!plan) return null;
  return "error" in plan ? plan.error : plan.multiplier;
};

it("re-reads the multiplier from the current basis when the ratio is edited proportionally", () => {
  // The person entered a doubled batch of the 1-sack / 25-pack recipe, so the
  // batch is 2 sacks to 50 packs at multiplier 2.
  const enteredQuantities = { "input:in-1": "2", "primary-output:out-1": "50" };
  expect(planOf(singleOutputLines, enteredQuantities)).toBe("2");

  // The template is then edited to 2 sacks / 50 packs, which the same entries
  // still satisfy — but now as a single batch, so the multiplier must be 1 and
  // never the 2 that the previous basis produced.
  const doubledBasisLines: PlannedQuantityLine[] = [
    { ...singleOutputLines[0], baseQuantity: "2" },
    { ...singleOutputLines[1], baseQuantity: "50" },
  ];

  expect(planOf(doubledBasisLines, enteredQuantities)).toBe("1");
  // The preview the person reads is the same plan, so it keeps showing 50.
  expect(yieldOf(doubledBasisLines, enteredQuantities)).toEqual(["PACK-2KG:50"]);
});

it("blocks a plan when a changed basis no longer accepts the entered quantities", () => {
  // A basis change that leaves the entries off the new ratio reports the ratio
  // error, which clears the yield and blocks the submit.
  const trebledBasisLines: PlannedQuantityLine[] = [
    { ...singleOutputLines[0], baseQuantity: "3" },
    { ...singleOutputLines[1], baseQuantity: "75" },
  ];
  const enteredQuantities = { "input:in-1": "2", "primary-output:out-1": "50" };

  expect(planOf(trebledBasisLines, enteredQuantities)).toBe("invalidRatio");
  expect(yieldOf(trebledBasisLines, enteredQuantities)).toBeNull();

  // A basis whose lines changed identity leaves the old entries unmatched, so
  // the whole-number error blocks it rather than an unscaled plan slipping out.
  const replacedLines: PlannedQuantityLine[] = [
    { ...singleOutputLines[0], key: "input:in-9" },
    { ...singleOutputLines[1], key: "primary-output:out-9" },
  ];

  expect(planOf(replacedLines, enteredQuantities)).toBe("wholeNumbersOnly");
  expect(yieldOf(replacedLines, enteredQuantities)).toBeNull();
});
