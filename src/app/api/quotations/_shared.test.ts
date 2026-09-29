import { describe, expect, it } from "vitest";
import {
  transformDbQuotationItem,
  type DbQuotationItemComponent,
  type DbQuotationItemConfiguration,
  type DbQuotationItemWithJoins,
} from "./_shared";

const configuration = (
  id: string,
  sizeIndex: number,
  width: number,
  frameQuantity: number
): DbQuotationItemConfiguration => ({
  id,
  quotation_item_id: "quotation-item-1",
  size_index: sizeIndex,
  width,
  height: width - 2,
  fixed_allowance: 0,
  molding_item_id: null,
  molding_stick_length: null,
  molding_sticks_required: null,
  service_fee_mode: "per_frame",
  service_type: null,
  service_fee_amount: 0,
  total_service_fee: 0,
  invoice_display_mode: "components",
  billing_mode: "chop_join",
  artwork_length_in: width - 4,
  artwork_width_in: width - 6,
  frame_width_in: 1,
  size_mode: "artwork",
  overlap_in: 0,
  mat_source: "store",
  glazing_cut_to_mat_outer: true,
  mat_included: true,
  glazing_included: false,
  glazing_type: null,
  glazing_unit_rate: null,
  glazing_sheets: 1,
  glazing_remarks: null,
  backing_type: "mdf",
  moulding_material: "polystyrene",
  frame_quantity: frameQuantity,
  backing_unit_rate: 0.16,
  framing_instructions: null,
  backing_thickness_in: null,
  component_discounts: null,
  frame_rate: 2.5,
  mat_unit_rate: 2.5,
  mat_border_l_in: 2,
  mat_border_w_in: 2,
  flexipoints_numerator: null,
  flexipoints_denominator: null,
  multipoints_numerator: null,
  multipoints_denominator: null,
});

const component = (
  id: string,
  configurationId: string,
  description: string
): DbQuotationItemComponent => ({
  id,
  quotation_item_id: "quotation-item-1",
  configuration_id: configurationId,
  component_type: "material",
  source: "auto",
  item_id: `item-${id}`,
  description,
  qty_per_frame: 1,
  total_quantity: 1,
  uom_id: "uom-cut",
  unit_rate: 2.5,
  discount_percent: 0,
  discount_amount: 0,
  total_amount: 25,
  rounding_mode: "none",
  sort_order: 0,
});

const quotationItem: DbQuotationItemWithJoins = {
  id: "quotation-item-1",
  quotation_id: "quotation-1",
  item_id: "service-item",
  item_description: "Two configured sizes",
  quantity: 3,
  fulfilled_qty: 0,
  uom_id: "uom-pcs",
  pricing_tier: null,
  pricing_tier_name: null,
  rate: 100,
  discount_percent: 0,
  discount_amount: 0,
  tax_percent: 0,
  tax_amount: 0,
  line_total: 300,
  sort_order: 0,
};

describe("quotation frame-size transformation", () => {
  it("keeps components grouped with every configuration in size order", () => {
    const transformed = transformDbQuotationItem(
      quotationItem,
      [configuration("size-b", 1, 20, 1), configuration("size-a", 0, 10, 2)],
      [
        component("component-a", "size-a", "8 X 10 - MAT A"),
        component("component-b", "size-b", "18 X 20 - MAT B"),
      ]
    );

    expect(transformed.frameSizes).toHaveLength(2);
    expect(transformed.frameSizes?.map((size) => size.frameConfiguration.id)).toEqual([
      "size-a",
      "size-b",
    ]);
    expect(transformed.frameSizes?.[0].frameComponents.map((part) => part.id)).toEqual([
      "component-a",
    ]);
    expect(transformed.frameSizes?.[1].frameComponents.map((part) => part.id)).toEqual([
      "component-b",
    ]);
  });
});
