import { describe, expect, it } from "vitest";
import { quotationTotals } from "@/lib/quotations/quotation-totals";
import {
  transformSalesOrderFrameDetails,
  transformSalesOrderQuotationPricing,
  type DbSalesOrderItemComponent,
  type DbSalesOrderItemConfiguration,
  type DbSalesOrderItemMatLayer,
} from "./frame-details";

const configuration = (
  id: string,
  sizeIndex: number,
  width: number,
  height: number,
  frameQuantity: number
): DbSalesOrderItemConfiguration => ({
  id,
  order_item_id: "order-item-1",
  quotation_configuration_id: `quote-${id}`,
  size_index: sizeIndex,
  width,
  height,
  fixed_allowance: 0,
  molding_item_id: `molding-${id}`,
  molding_stick_length: null,
  molding_sticks_required: null,
  service_fee_mode: "per_frame",
  service_type: null,
  service_fee_amount: 0,
  total_service_fee: 0,
  invoice_display_mode: "components",
  billing_mode: "chop_join",
  frame_quantity: frameQuantity,
  artwork_length_in: height - 4,
  artwork_width_in: width - 4,
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
  backing_unit_rate: 0.16,
  frame_rate: null,
  mat_unit_rate: 2.5,
  mat_border_l_in: 2,
  mat_border_w_in: 2,
  flexipoints_numerator: 1,
  flexipoints_denominator: 2,
  multipoints_numerator: null,
  multipoints_denominator: null,
  items: {
    id: `molding-${id}`,
    item_code: `M-${id}`,
    item_name: `Moulding ${id}`,
  },
});

const component = (
  id: string,
  configurationId: string,
  description: string
): DbSalesOrderItemComponent => ({
  id,
  order_item_id: "order-item-1",
  configuration_id: configurationId,
  quotation_component_id: `quote-${id}`,
  component_type: "material",
  source: "auto",
  item_id: `item-${id}`,
  description,
  qty_per_frame: 1,
  total_quantity: 1,
  uom_id: "uom-cut",
  unit_rate: 2.5,
  total_amount: 25,
  discount_percent: 0,
  discount_amount: 0,
  rounding_mode: "none",
  sort_order: 0,
});

const matLayer = (
  id: string,
  configurationId: string,
  boardName: string
): DbSalesOrderItemMatLayer => ({
  id,
  configuration_id: configurationId,
  quotation_mat_layer_id: `quote-${id}`,
  layer_index: 0,
  mat_board_item_id: `board-${id}`,
  unit_rate: 2.5,
  items: { id: `board-${id}`, item_code: id, item_name: boardName },
});

describe("Sales Order frame-size grouping", () => {
  it("retains original quotation amounts rather than the already-prorated order snapshot", () => {
    const pricing = transformSalesOrderQuotationPricing(
      { quantity: "3", discount_amount: "0.10", tax_amount: "0", line_total: "0.90" },
      [
        {
          ...configuration("size-a", 0, 10, 8, 1),
          source_pricing: [{ frame_quantity: "3", total_service_fee: "0" }],
        },
      ],
      [
        {
          ...component("part", "size-a", "Moulding"),
          total_amount: 0.33,
          source_pricing: { total_amount: "1", discount_amount: "0.3" },
        },
      ]
    );
    expect(pricing).toEqual({
      quantity: 3,
      discountAmount: 0.1,
      taxAmount: 0,
      lineTotal: 0.9,
      sizes: [
        {
          configurationId: "quote-size-a",
          quantity: 3,
          serviceFee: 0,
          components: [{ amount: 1, discountAmount: 0.3 }],
        },
      ],
    });
  });

  it("does not reconstruct inaccessible quotation prices from the rounded order rate", () => {
    expect(transformSalesOrderQuotationPricing(undefined, [], [])).toBeUndefined();
    expect(
      transformSalesOrderQuotationPricing(
        { quantity: 1, discount_amount: 0, tax_amount: 0, line_total: 100 },
        [configuration("size-a", 0, 10, 8, 1)],
        []
      )
    ).toBeUndefined();
  });
  it("preserves component discounts in both grouped and flat read contracts", () => {
    const transformed = transformSalesOrderFrameDetails(
      [configuration("size-a", 0, 10, 8, 1)],
      [
        {
          ...component("part", "size-a", "Discounted moulding"),
          total_amount: "90",
          discount_amount: "10",
          discount_percent: "10",
        },
      ],
      new Map()
    );
    expect(transformed.frameComponents[0]).toMatchObject({
      totalAmount: 90,
      discountAmount: 10,
      discountPercent: 10,
    });
    expect(transformed.frameSizes?.[0].frameComponents[0]).toMatchObject({
      totalAmount: 90,
      discountAmount: 10,
      discountPercent: 10,
    });
    expect(
      quotationTotals([
        {
          ...transformed,
          quantity: 1,
          unitPrice: 90,
          discountAmount: 0,
          taxRate: 0,
          lineTotal: 90,
        },
      ])
    ).toEqual({
      subtotal: 100,
      totalDiscount: 10,
      totalTax: 0,
      totalAmount: 90,
    });
  });
  it("keeps each size's geometry, quantity, components and mat layers together", () => {
    const configurations = [
      configuration("size-b", 1, 20, 16, 1),
      configuration("size-a", 0, 10, 8, 2),
    ];
    const components = [
      component("component-a", "size-a", "8 X 10 - MAT A"),
      component("component-b", "size-b", "16 X 20 - MAT B"),
    ];
    const layers = new Map<string, DbSalesOrderItemMatLayer[]>([
      ["size-a", [matLayer("layer-a", "size-a", "Board A")]],
      ["size-b", [matLayer("layer-b", "size-b", "Board B")]],
    ]);

    const transformed = transformSalesOrderFrameDetails(configurations, components, layers);

    expect(transformed.frameSizes).toHaveLength(2);
    expect(transformed.frameSizes?.map((size) => size.frameConfiguration.id)).toEqual([
      "size-a",
      "size-b",
    ]);
    expect(transformed.frameSizes?.map((size) => size.frameConfiguration.frameQuantity)).toEqual([
      2, 1,
    ]);
    expect(transformed.frameSizes?.[0].frameComponents.map((part) => part.description)).toEqual([
      "8 X 10 - MAT A",
    ]);
    expect(transformed.frameSizes?.[1].frameComponents.map((part) => part.description)).toEqual([
      "16 X 20 - MAT B",
    ]);
    expect(transformed.frameSizes?.[0].matLayers[0].matBoardItemName).toBe("Board A");
    expect(transformed.frameSizes?.[0].matLayers[0].quotationMatLayerId).toBe("quote-layer-a");
    expect(transformed.frameSizes?.[1].matLayers[0].matBoardItemName).toBe("Board B");
  });

  it("returns a single configured line in the same grouped read contract", () => {
    const transformed = transformSalesOrderFrameDetails(
      [configuration("only-size", 0, 20, 16, 1)],
      [component("only-component", "only-size", "16 X 20 - GLASS")],
      new Map()
    );

    expect(transformed.frameSizes).toHaveLength(1);
    expect(transformed.frameSizes?.[0].frameConfiguration.id).toBe("only-size");
    expect(transformed.frameSizes?.[0].frameComponents[0].description).toBe("16 X 20 - GLASS");
  });
});
