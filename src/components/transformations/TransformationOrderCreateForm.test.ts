import { expect, it, vi } from "vitest";
import type { TransformationTemplateListItemApi } from "@/types/transformation-template";
import { getPlannedQuantityLines } from "./TransformationOrderCreateForm";

// The form renders the shared warehouse picker, whose lookup hook pulls in the
// auth store and Supabase client. These tests cover the pure planner helpers.
vi.mock("@/hooks/useLookups", () => ({
  useLookupWarehouses: () => ({ data: undefined, isLoading: false }),
}));

// A recipe template that repacks one bulk sack into 25 finished packs, with a
// packaging input that scales with it.
const recipeTemplate = (
  overrides: Partial<TransformationTemplateListItemApi> = {}
): TransformationTemplateListItemApi =>
  ({
    id: "template-1",
    template_kind: "recipe",
    template_code: "RCP-REPACK",
    template_name: "Rice 50kg Sack To 2kg Packs",
    is_active: true,
    usage_count: 0,
    input_material_count: 2,
    output_product_count: 1,
    inputs: [
      {
        id: "in-2",
        sequence: 2,
        quantity: 25,
        items: { id: "i2", item_code: "BAG-2KG", item_name: "2kg Bag" },
        uom: { id: "u-pc", code: "PC", name: "Piece" },
      },
      {
        id: "in-1",
        sequence: 1,
        quantity: 1,
        items: { id: "i1", item_code: "RICE-BULK", item_name: "Rice Bulk 50kg" },
        uom: { id: "u-sack", code: "SACK", name: "Sack" },
      },
    ],
    outputs: [
      {
        id: "out-1",
        sequence: 1,
        quantity: 25,
        is_scrap: false,
        items: { id: "i3", item_code: "RICE-2KG", item_name: "Rice 2kg Pack" },
        uom: { id: "u-pack", code: "PACK", name: "Pack" },
      },
    ],
    additional_outputs: [],
    ...overrides,
  }) as TransformationTemplateListItemApi;

it("orders a recipe's lines inputs-first by sequence and keeps item identity and base UOM", () => {
  const lines = getPlannedQuantityLines(recipeTemplate());

  expect(
    lines.map((line) => ({
      key: line.key,
      direction: line.direction,
      itemCode: line.itemCode,
      uomLabel: line.uomLabel,
      baseQuantity: line.baseQuantity,
    }))
  ).toEqual([
    {
      key: "input:in-1",
      direction: "input",
      itemCode: "RICE-BULK",
      uomLabel: "SACK",
      baseQuantity: "1",
    },
    {
      key: "input:in-2",
      direction: "input",
      itemCode: "BAG-2KG",
      uomLabel: "PC",
      baseQuantity: "25",
    },
    {
      key: "primary-output:out-1",
      direction: "output",
      itemCode: "RICE-2KG",
      uomLabel: "PACK",
      baseQuantity: "25",
    },
  ]);
});

it("includes scrap and additional outputs as output lines", () => {
  const lines = getPlannedQuantityLines(
    recipeTemplate({
      outputs: [
        {
          id: "out-1",
          sequence: 1,
          quantity: 25,
          is_scrap: false,
          items: { id: "i3", item_code: "RICE-2KG", item_name: "Rice 2kg Pack" },
          uom: { id: "u-pack", code: "PACK", name: "Pack" },
        },
        {
          id: "out-2",
          sequence: 2,
          quantity: 1,
          is_scrap: true,
          items: { id: "i4", item_code: "DUST", item_name: "Rice Dust" },
        },
      ],
      additional_outputs: [
        {
          id: "add-1",
          item_id: "i5",
          sequence: 1,
          quantity: 2,
          // The list response carries the additional output's UOM under its item.
          items: {
            id: "i5",
            item_code: "BRAN",
            item_name: "Bran",
            uom: { id: "u-kg", code: "KG", name: "Kilogram" },
          },
        },
      ],
    })
  );

  expect(
    lines
      .filter((line) => line.direction === "output")
      .map((line) => `${line.key}:${line.itemCode}:${line.uomLabel ?? "-"}`)
  ).toEqual([
    "primary-output:out-1:RICE-2KG:PACK",
    "primary-output:out-2:DUST:-",
    "additional-output:add-1:BRAN:KG",
  ]);
});

it("builds lines for a sheet layout template the same way", () => {
  const lines = getPlannedQuantityLines(
    recipeTemplate({
      template_kind: "sheet_layout",
      inputs: [
        {
          id: "sheet-in",
          sequence: 1,
          quantity: 1,
          items: { id: "s1", item_code: "SHEET", item_name: "Plywood Sheet" },
          uom: { id: "u-sheet", code: "SHT", name: "Sheet" },
        },
      ],
      outputs: [
        {
          id: "sheet-out-1",
          sequence: 1,
          quantity: 4,
          is_scrap: false,
          items: { id: "s2", item_code: "PANEL-A", item_name: "Panel A" },
          uom: { id: "u-pc", code: "PC", name: "Piece" },
        },
        {
          id: "sheet-out-2",
          sequence: 2,
          quantity: 2,
          is_scrap: false,
          items: { id: "s3", item_code: "PANEL-B", item_name: "Panel B" },
          uom: { id: "u-pc", code: "PC", name: "Piece" },
        },
      ],
    })
  );

  expect(lines.map((line) => `${line.direction}:${line.itemCode}:${line.baseQuantity}`)).toEqual([
    "input:SHEET:1",
    "output:PANEL-A:4",
    "output:PANEL-B:2",
  ]);
});

it("builds no lines without a template", () => {
  expect(getPlannedQuantityLines(undefined)).toEqual([]);
});
